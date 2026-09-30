import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  callTimeTreeAdapter,
  fetchTimeTreeAdapterStatus,
  type TimeTreeAdapterRequest,
  type TimeTreeAdapterResponse,
  type TimeTreeAdapterStatus
} from "./adapter-client";

export type TimeTreeOutboundPlanItem = {
  organizerEventId: string;
  action: "create" | "update" | "delete";
  status: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  timetreeEventId: string | null;
  reason: string;
};

export async function buildTimeTreeOutboundPlan(db: PrismaClient = prisma) {
  const [operations, sharedWithoutRemoteId] = await Promise.all([
    db.timeTreeOutboundOperation.findMany({
      where: { status: { in: ["pending", "retry_wait", "reconcile_required", "conflict", "failed"] } },
      orderBy: { createdAt: "asc" }
    }),
    db.organizerEvent.findMany({
      where: { shareWithPartner: true, timetreeEventId: null },
      select: { id: true }
    })
  ]);
  const items: TimeTreeOutboundPlanItem[] = operations.map((operation) => {
    const payload = JSON.parse(operation.payloadJson) as {
      title: string;
      startAt: string;
      endAt: string;
      allDay: boolean;
      location: string | null;
    };
    return {
      organizerEventId: operation.organizerEventId,
      action: operation.action as TimeTreeOutboundPlanItem["action"],
      status: operation.status,
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      allDay: payload.allDay,
      location: payload.location,
      timetreeEventId: operation.timetreeEventId,
      reason: operation.status === "reconcile_required"
        ? "TimeTreeへの保存成否を一意に確認する必要があります。"
        : operation.action === "create"
          ? "共有対象のローカル予定がTimeTree未連携です。"
          : operation.action === "update"
            ? "同期済み内容からローカル予定が変更されています。"
            : "共有解除またはローカル削除によりTimeTreeからの削除が必要です。"
    };
  });
  const operationEventIds = new Set(operations.map((operation) => operation.organizerEventId));
  const missingOutbox = sharedWithoutRemoteId.filter((event) => !operationEventIds.has(event.id)).length;
  return { items, missingOutbox };
}

export async function getTimeTreeOutboundStatus(db: PrismaClient = prisma) {
  const [mappingCount, enabledMappingCount, pending, reconcileRequired, conflicts, failed] = await Promise.all([
    db.timeTreeCalendarMapping.count(),
    db.timeTreeCalendarMapping.count({ where: { enabled: true, outboundEnabledAt: { not: null } } }),
    db.timeTreeOutboundOperation.count({ where: { status: { in: ["pending", "retry_wait"] } } }),
    db.timeTreeOutboundOperation.count({ where: { status: "reconcile_required" } }),
    db.timeTreeOutboundOperation.count({ where: { status: "conflict" } }),
    db.timeTreeOutboundOperation.count({ where: { status: "failed" } })
  ]);
  return {
    phase: "production_guarded",
    mappingCount,
    outboundEnabledMappingCount: enabledMappingCount,
    writesEnabled: process.env.TIMETREE_OUTBOUND_WRITES_ENABLED?.trim().toLowerCase() === "true",
    pending,
    reconcileRequired,
    conflicts,
    failed,
    timeTreeWriteCount: 0
  };
}

type TimeTreeAdapterBoundary = {
  status: () => Promise<TimeTreeAdapterStatus>;
  call: (action: "create" | "reconcile" | "update" | "delete", request: TimeTreeAdapterRequest) => Promise<TimeTreeAdapterResponse>;
};

export type RunTimeTreeOutboundOptions = {
  dryRun: boolean;
  confirmation?: string;
  limit?: number;
  writesEnabledByEnvironment?: boolean;
  leaseOwner?: string;
  now?: Date;
  adapter?: TimeTreeAdapterBoundary;
};

const defaultAdapter: TimeTreeAdapterBoundary = {
  status: () => fetchTimeTreeAdapterStatus(),
  call: (action, request) => callTimeTreeAdapter(action, request)
};

async function requireWritableMapping(db: PrismaClient) {
  const mappings = await db.timeTreeCalendarMapping.findMany({
    where: { enabled: true, outboundEnabledAt: { not: null } }
  });
  if (mappings.length !== 1) {
    throw new Error(`Exactly one enabled TimeTree mapping is required; found ${mappings.length}.`);
  }
  const mapping = mappings[0];
  if (!mapping.calendarId || !mapping.calendarUrl) {
    throw new Error("The enabled TimeTree mapping must have a verified calendarId and calendarUrl.");
  }
  return mapping as typeof mapping & { calendarId: string; calendarUrl: string };
}

function retryAt(now: Date, attemptCount: number) {
  const minutes = [1, 5, 15, 60][Math.min(Math.max(attemptCount - 1, 0), 3)];
  return new Date(now.getTime() + minutes * 60_000);
}

async function recoverExpiredLeases(db: PrismaClient, now: Date) {
  const expired = await db.timeTreeOutboundOperation.findMany({
    where: { status: "processing", leaseExpiresAt: { lt: now } },
    select: { id: true }
  });
  if (expired.length) {
    await db.timeTreeOutboundOperation.updateMany({
      where: { id: { in: expired.map((item) => item.id) }, status: "processing", leaseExpiresAt: { lt: now } },
      data: {
        status: "reconcile_required",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: "expired_processing_lease",
        lastErrorMessage: "A worker lease expired while the remote result was uncertain."
      }
    });
  }
}

async function leaseNextOperation(db: PrismaClient, owner: string, now: Date) {
  await recoverExpiredLeases(db, now);
  return db.$transaction(async (transaction) => {
    const operation = await transaction.timeTreeOutboundOperation.findFirst({
      where: {
        OR: [
          { status: "pending" },
          { status: "retry_wait", nextAttemptAt: { lte: now } },
          { status: "reconcile_required" }
        ],
        AND: [{ OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] }]
      },
      orderBy: { createdAt: "asc" }
    });
    if (!operation) return null;
    const leased = await transaction.timeTreeOutboundOperation.updateMany({
      where: {
        id: operation.id,
        status: operation.status,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }]
      },
      data: {
        status: "processing",
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + 5 * 60_000),
        attemptCount: { increment: 1 },
        saveAttemptedAt: operation.action === "create" ? now : operation.saveAttemptedAt
      }
    });
    if (leased.count !== 1) return null;
    return { ...operation, priorStatus: operation.status, attemptCount: operation.attemptCount + 1 };
  });
}

function adapterRequest(operation: NonNullable<Awaited<ReturnType<typeof leaseNextOperation>>>, mapping: Awaited<ReturnType<typeof requireWritableMapping>>): TimeTreeAdapterRequest {
  return {
    action: operation.action as "create" | "update" | "delete",
    operationId: operation.id,
    organizerEventId: operation.organizerEventId,
    idempotencyKey: operation.idempotencyKey,
    calendar: { name: mapping.calendarName, calendarId: mapping.calendarId, url: mapping.calendarUrl },
    payload: JSON.parse(operation.payloadJson) as Record<string, unknown>,
    basePayload: operation.basePayloadJson ? JSON.parse(operation.basePayloadJson) as Record<string, unknown> : null,
    desiredHash: operation.desiredHash!,
    eventId: operation.timetreeEventId,
    eventUrl: operation.timetreeEventUrl,
    baseHash: operation.baseHash
  };
}

function assertAdapterResponse(
  operation: NonNullable<Awaited<ReturnType<typeof leaseNextOperation>>>,
  mapping: Awaited<ReturnType<typeof requireWritableMapping>>,
  response: TimeTreeAdapterResponse
) {
  if (response.operation_id !== operation.id || response.organizer_event_id !== operation.organizerEventId) {
    throw new Error("TimeTree adapter response identity does not match the leased operation.");
  }
  if (response.outcome !== "verified") return;
  if (response.calendar_id !== mapping.calendarId || response.calendar_url !== mapping.calendarUrl) {
    throw new Error("Verified TimeTree adapter response has a different calendar identity.");
  }
  if (operation.action !== "create" && response.event_id !== operation.timetreeEventId) {
    throw new Error("Verified TimeTree adapter response has a different event identity.");
  }
  if (operation.action !== "delete" && response.observed_hash !== operation.desiredHash) {
    throw new Error("Verified TimeTree adapter response does not match the desired payload hash.");
  }
}

async function finishOperation(
  db: PrismaClient,
  operation: NonNullable<Awaited<ReturnType<typeof leaseNextOperation>>>,
  response: TimeTreeAdapterResponse,
  now: Date
) {
  const ownership = { id: operation.id, status: "processing", leaseOwner: operation.leaseOwner! };
  if (response.outcome === "verified") {
    await db.$transaction(async (transaction) => {
      if (operation.action === "delete") {
        await transaction.organizerEvent.updateMany({
          where: { id: operation.organizerEventId },
          data: {
            timetreeEventId: null,
            timetreeEventUrl: null,
            timetreeCalendarId: null,
            timetreeBaseHash: null,
            timetreeBasePayloadJson: null,
            timetreeLastSyncedAt: now,
            timetreeSyncStatus: "not_requested"
          }
        });
      } else {
        if (!response.event_id || !response.event_url || !response.calendar_id || !response.observed_hash) {
          throw new Error("Verified adapter response is missing remote identity.");
        }
        const updated = await transaction.organizerEvent.updateMany({
          where: { id: operation.organizerEventId, shareWithPartner: true },
          data: {
            timetreeEventId: response.event_id,
            timetreeEventUrl: response.event_url,
            timetreeCalendarId: response.calendar_id,
            timetreeBaseHash: response.observed_hash,
            timetreeBasePayloadJson: operation.payloadJson,
            timetreeLastSyncedAt: now,
            timetreeSyncStatus: "synced"
          }
        });
        if (updated.count !== 1) throw new Error("OrganizerEvent disappeared or sharing was disabled during sync.");
      }
      const completed = await transaction.timeTreeOutboundOperation.updateMany({
        where: ownership,
        data: {
          status: "succeeded",
          timetreeCalendarId: response.calendar_id,
          timetreeEventId: response.event_id,
          timetreeEventUrl: response.event_url,
          leaseOwner: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          completedAt: now
        }
      });
      if (completed.count !== 1) throw new Error("TimeTree operation lease ownership was lost.");
    });
    return;
  }

  const createIsUncertain = operation.action === "create" && response.phase === "save_attempted";
  const status = response.outcome === "conflict"
    ? "conflict"
    : response.outcome === "reconcile_required" || response.outcome === "not_found" || createIsUncertain
      ? "reconcile_required"
      : response.outcome === "retryable_error" && response.phase !== "save_attempted"
        ? "retry_wait"
        : "failed";
  await db.$transaction(async (transaction) => {
    const changed = await transaction.timeTreeOutboundOperation.updateMany({
      where: ownership,
      data: {
        status,
        nextAttemptAt: status === "retry_wait" ? retryAt(now, operation.attemptCount) : null,
        saveAttemptedAt: response.phase === "save_attempted" ? now : operation.saveAttemptedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: response.error_code ?? response.outcome,
        lastErrorMessage: response.error_message?.slice(0, 2000) ?? null
      }
    });
    if (changed.count !== 1) throw new Error("TimeTree operation lease ownership was lost.");
    await transaction.organizerEvent.updateMany({
      where: { id: operation.organizerEventId },
      data: { timetreeSyncStatus: status === "retry_wait" || status === "reconcile_required" ? "pending" : "error" }
    });
  });
}

export async function runTimeTreeOutbound(
  options: RunTimeTreeOutboundOptions,
  db: PrismaClient = prisma
) {
  if (options.dryRun) return runTimeTreeOutboundDryRun(db);
  if (options.confirmation !== "WRITE_TIMETREE") throw new Error("TimeTree writes require --confirm WRITE_TIMETREE.");
  if (!(options.writesEnabledByEnvironment ?? (process.env.TIMETREE_OUTBOUND_WRITES_ENABLED?.trim().toLowerCase() === "true"))) {
    throw new Error("TIMETREE_OUTBOUND_WRITES_ENABLED=true is required.");
  }
  if (options.limit !== 1) throw new Error("The production canary requires --limit 1.");
  const mapping = await requireWritableMapping(db);
  const adapter = options.adapter ?? defaultAdapter;
  const status = await adapter.status();
  if (!status.ready || status.calendar_name !== mapping.calendarName || status.calendar_id !== mapping.calendarId || status.calendar_url !== mapping.calendarUrl) {
    throw new Error("TimeTree adapter status does not exactly match the enabled calendar mapping.");
  }
  const now = options.now ?? new Date();
  const owner = options.leaseOwner ?? `timetree-worker-${randomUUID()}`;
  const operation = await leaseNextOperation(db, owner, now);
  if (!operation) return { processed: 0, timeTreeWriteCount: 0, results: [] };
  const action = operation.priorStatus === "reconcile_required" ? "reconcile" : operation.action as "create" | "update" | "delete";
  let response: TimeTreeAdapterResponse;
  try {
    response = await adapter.call(action, {
      ...adapterRequest(operation, mapping),
      baseHash: operation.baseHash
    });
    assertAdapterResponse(operation, mapping, response);
  } catch (error) {
    response = {
      // Once the HTTP request has left this process, a lost response cannot
      // prove that the adapter failed before clicking Save/Delete. Reconcile
      // every action instead of replaying an uncertain remote mutation.
      outcome: "reconcile_required",
      phase: "save_attempted",
      operation_id: operation.id,
      organizer_event_id: operation.organizerEventId,
      event_id: null,
      event_url: null,
      calendar_id: null,
      calendar_url: null,
      observed_hash: null,
      error_code: "adapter_unavailable",
      error_message: error instanceof Error ? error.message : "Adapter request failed.",
      artifact_ref: null,
      adapter_write_count: 0
    };
  }
  await finishOperation(db, { ...operation, leaseOwner: owner }, response, now);
  return { processed: 1, timeTreeWriteCount: response.adapter_write_count, results: [response] };
}

export async function runTimeTreeOutboundDryRun(db: PrismaClient = prisma) {
  const plan = await buildTimeTreeOutboundPlan(db);
  return {
    dryRun: true,
    created: plan.items.filter((item) => item.action === "create").length,
    updated: plan.items.filter((item) => item.action === "update").length,
    deleted: plan.items.filter((item) => item.action === "delete").length,
    reconcileRequired: plan.items.filter((item) => item.status === "reconcile_required").length,
    conflicts: plan.items.filter((item) => item.status === "conflict").length,
    skipped: plan.missingOutbox,
    timeTreeWriteCount: 0,
    items: plan.items
  };
}
