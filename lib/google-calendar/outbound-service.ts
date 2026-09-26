import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GoogleOutboundAlreadyExistsError,
  GoogleOutboundConflictError,
  GoogleOutboundNotFoundError
} from "./errors";
import type { GoogleCalendarOutboundClient, GoogleOutboundRemoteEvent } from "./outbound-client";
import {
  isOrganizerCategory,
  localOutboundHash,
  toGoogleOutboundPayload,
  type GoogleOutboundEventPayload
} from "./outbound-payload";
import { payloadHash } from "./normalize";

export type GoogleCalendarOutboundDb = PrismaClient;

type OutboundAction = "CREATE" | "UPDATE" | "DELETE" | "CONFLICT" | "SKIP";

export type GoogleCalendarOutboundPlanItem = {
  action: OutboundAction;
  organizerEventId: string;
  deletionId: string | null;
  googleCalendarEventId: string | null;
  title: string;
  category: string;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean | null;
  description: string | null;
  location: string | null;
  targetGoogleCalendarId: string | null;
  targetGoogleCalendarName: string | null;
  reason: string;
  localHash: string | null;
  expectedEtag: string | null;
  payload: GoogleOutboundEventPayload | null;
};

export type GoogleCalendarOutboundResult = {
  dryRun: boolean;
  items: GoogleCalendarOutboundPlanItem[];
  totals: {
    created: number;
    updated: number;
    deleted: number;
    conflicts: number;
    skipped: number;
    googleWriteCount: number;
  };
};

const WRITE_SCOPES = new Set([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.owned"
]);
const WRITE_CONFIRMATION = "WRITE_GOOGLE_CALENDAR";
const ENVIRONMENT_ENABLE_VALUE = "ENABLED_AFTER_REAUTH";

function result(items: GoogleCalendarOutboundPlanItem[], dryRun: boolean, googleWriteCount = 0): GoogleCalendarOutboundResult {
  return {
    dryRun,
    items,
    totals: {
      created: items.filter((item) => item.action === "CREATE").length,
      updated: items.filter((item) => item.action === "UPDATE").length,
      deleted: items.filter((item) => item.action === "DELETE").length,
      conflicts: items.filter((item) => item.action === "CONFLICT").length,
      skipped: items.filter((item) => item.action === "SKIP").length,
      googleWriteCount
    }
  };
}

function remoteMetadata(remote: GoogleOutboundRemoteEvent, now: Date) {
  return {
    googleCalendarEventId: remote.id,
    googleEtag: remote.etag,
    googleUpdatedAt: remote.updated ? new Date(remote.updated) : null,
    googleSyncStatus: "updated",
    lastSyncedAt: now,
    lastSyncedHash: payloadHash(remote),
    googleEventType: remote.eventType,
    googleStatus: remote.status
  };
}

async function remoteConflictReason(
  client: GoogleCalendarOutboundClient,
  calendarId: string,
  eventId: string,
  expectedEtag: string
) {
  try {
    const remote = await client.getEvent(calendarId, eventId);
    if (remote.status === "cancelled") return "Google event is already cancelled";
    if (!remote.etag || remote.etag !== expectedEtag) return "Google event changed after the last inbound sync";
    return null;
  } catch (error) {
    if (error instanceof GoogleOutboundNotFoundError) return "Google event no longer exists";
    throw error;
  }
}

export async function buildGoogleCalendarOutboundPlan(
  client: GoogleCalendarOutboundClient,
  db: GoogleCalendarOutboundDb = prisma
): Promise<GoogleCalendarOutboundPlanItem[]> {
  const [mappings, events, deletions] = await Promise.all([
    db.googleCalendarMapping.findMany({ orderBy: { category: "asc" } }),
    db.organizerEvent.findMany({ orderBy: { createdAt: "asc" } }),
    db.googleCalendarOutboundDeletion.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } })
  ]);
  const mappingByCategory = new Map(mappings.map((mapping) => [mapping.category, mapping]));
  const items: GoogleCalendarOutboundPlanItem[] = [];

  for (const event of events) {
    const mapping = mappingByCategory.get(event.category);
    const base = {
      organizerEventId: event.id,
      deletionId: null,
      googleCalendarEventId: event.googleCalendarEventId,
      title: event.title,
      category: event.category,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      allDay: event.allDay,
      description: event.description,
      location: event.location,
      targetGoogleCalendarId: mapping?.googleCalendarId ?? null,
      targetGoogleCalendarName: mapping?.displayName ?? null
    };
    if (!mapping || !mapping.enabled || !isOrganizerCategory(event.category)) {
      items.push({ ...base, action: "CONFLICT", reason: "Enabled category mapping was not found", localHash: null, expectedEtag: null, payload: null });
      continue;
    }

    const hasCalendarId = Boolean(event.googleCalendarId);
    const hasEventId = Boolean(event.googleCalendarEventId);
    if (!hasCalendarId && !hasEventId && !event.googleOutboundManaged) {
      const localHash = localOutboundHash(event);
      items.push({
        ...base,
        action: "CREATE",
        reason: "Local-only Organizer event",
        localHash,
        expectedEtag: null,
        payload: toGoogleOutboundPayload(event, true)
      });
      continue;
    }
    if (hasCalendarId !== hasEventId || (event.googleOutboundManaged && (!hasCalendarId || !hasEventId))) {
      items.push({ ...base, action: "CONFLICT", reason: "Google identity is incomplete", localHash: null, expectedEtag: event.googleEtag, payload: null });
      continue;
    }
    if (!event.googleOutboundManaged) {
      items.push({ ...base, action: "SKIP", reason: "Inbound-owned Google event is protected from outbound writes", localHash: null, expectedEtag: event.googleEtag, payload: null });
      continue;
    }
    if (event.googleCalendarId !== mapping.googleCalendarId) {
      items.push({ ...base, action: "CONFLICT", reason: "Changing category would move an existing Google event between calendars", localHash: null, expectedEtag: event.googleEtag, payload: null });
      continue;
    }
    const localHash = localOutboundHash(event);
    if (localHash === event.googleOutboundBaseHash) {
      items.push({ ...base, action: "SKIP", reason: "Local content matches the last synchronized state", localHash, expectedEtag: event.googleEtag, payload: null });
      continue;
    }
    if (!event.googleOutboundBaseHash || !event.googleEtag) {
      items.push({ ...base, action: "CONFLICT", reason: "Outbound baseline or Google ETag is missing", localHash, expectedEtag: event.googleEtag, payload: null });
      continue;
    }
    const conflict = await remoteConflictReason(client, event.googleCalendarId!, event.googleCalendarEventId!, event.googleEtag);
    items.push({
      ...base,
      action: conflict ? "CONFLICT" : "UPDATE",
      reason: conflict ?? "Local content changed and Google ETag still matches",
      localHash,
      expectedEtag: event.googleEtag,
      payload: conflict ? null : toGoogleOutboundPayload(event)
    });
  }

  for (const deletion of deletions) {
    const mapping = mappingByCategory.get(deletion.category);
    const base = {
      organizerEventId: deletion.organizerEventId,
      deletionId: deletion.id,
      googleCalendarEventId: deletion.googleCalendarEventId,
      title: deletion.title,
      category: deletion.category,
      startAt: null,
      endAt: null,
      allDay: null,
      description: null,
      location: null,
      targetGoogleCalendarId: mapping?.googleCalendarId ?? null,
      targetGoogleCalendarName: mapping?.displayName ?? null,
      localHash: null,
      expectedEtag: deletion.googleEtag,
      payload: null
    };
    if (!mapping || !mapping.enabled || mapping.googleCalendarId !== deletion.googleCalendarId) {
      items.push({ ...base, action: "CONFLICT", reason: "Deletion calendar mapping does not match the stored Google identity" });
      continue;
    }
    if (!deletion.googleEtag) {
      items.push({ ...base, action: "CONFLICT", reason: "Deletion tombstone has no Google ETag" });
      continue;
    }
    const conflict = await remoteConflictReason(client, deletion.googleCalendarId, deletion.googleCalendarEventId, deletion.googleEtag);
    items.push({
      ...base,
      action: conflict ? (conflict === "Google event no longer exists" || conflict === "Google event is already cancelled" ? "SKIP" : "CONFLICT") : "DELETE",
      reason: conflict ?? "Outbound-managed Organizer event was deleted locally"
    });
  }
  return items;
}

async function assertWriteGuards(
  client: GoogleCalendarOutboundClient,
  items: GoogleCalendarOutboundPlanItem[],
  options: { confirmation?: string; writesEnabledByEnvironment?: boolean },
  db: GoogleCalendarOutboundDb
) {
  if (options.confirmation !== WRITE_CONFIRMATION) throw new Error(`Outbound write requires --confirm ${WRITE_CONFIRMATION}`);
  const environmentEnabled = options.writesEnabledByEnvironment
    ?? process.env.GOOGLE_CALENDAR_OUTBOUND_WRITES_ENABLED === ENVIRONMENT_ENABLE_VALUE;
  if (!environmentEnabled) throw new Error("Google Calendar outbound writes are disabled by environment guard");
  const calendarIds = [...new Set(items
    .filter((item) => ["CREATE", "UPDATE", "DELETE"].includes(item.action))
    .map((item) => item.targetGoogleCalendarId)
    .filter((value): value is string => Boolean(value)))];
  const mappings = await db.googleCalendarMapping.findMany({ where: { googleCalendarId: { in: calendarIds } } });
  const anyEnabledMapping = await db.googleCalendarMapping.count({
    where: { enabled: true, outboundEnabledAt: { not: null } }
  });
  if (
    anyEnabledMapping === 0
    || mappings.length !== calendarIds.length
    || mappings.some((mapping) => !mapping.enabled || !mapping.outboundEnabledAt)
  ) {
    throw new Error("Google Calendar outbound writes are disabled in GoogleCalendarMapping");
  }
  const scopes = await client.getGrantedScopes();
  if (!scopes.some((scope) => WRITE_SCOPES.has(scope))) {
    throw new Error("A Google Calendar event write scope is required");
  }
}

async function finishAlreadyDeleted(item: GoogleCalendarOutboundPlanItem, db: GoogleCalendarOutboundDb) {
  if (!item.deletionId || !["Google event no longer exists", "Google event is already cancelled"].includes(item.reason)) return;
  await db.googleCalendarOutboundDeletion.update({
    where: { id: item.deletionId },
    data: { status: "deleted", completedAt: new Date() }
  });
}

export async function runGoogleCalendarOutbound(
  client: GoogleCalendarOutboundClient,
  options: {
    dryRun: boolean;
    confirmation?: string;
    writesEnabledByEnvironment?: boolean;
  },
  db: GoogleCalendarOutboundDb = prisma
): Promise<GoogleCalendarOutboundResult> {
  const planned = await buildGoogleCalendarOutboundPlan(client, db);
  if (options.dryRun) return result(planned, true, 0);
  await assertWriteGuards(client, planned, options, db);

  const finalItems: GoogleCalendarOutboundPlanItem[] = [];
  let googleWriteCount = 0;
  for (const item of planned) {
    if (item.action === "CONFLICT") {
      finalItems.push(item);
      continue;
    }
    if (item.action === "SKIP") {
      await finishAlreadyDeleted(item, db);
      finalItems.push(item);
      continue;
    }
    if (!item.targetGoogleCalendarId) throw new Error("Target Google Calendar is missing");
    const targetGoogleCalendarId = item.targetGoogleCalendarId;

    if (item.action === "CREATE") {
      let remote: GoogleOutboundRemoteEvent;
      let createdNow = false;
      try {
        remote = await client.createEvent(targetGoogleCalendarId, item.payload!);
        createdNow = true;
      } catch (error) {
        if (!(error instanceof GoogleOutboundAlreadyExistsError)) throw error;
        remote = await client.getEvent(targetGoogleCalendarId, item.payload!.id!);
        if (remote.homeDashboardEventId !== item.organizerEventId) {
          finalItems.push({ ...item, action: "CONFLICT", reason: "Deterministic Google event ID is owned by another event", payload: null });
          continue;
        }
      }
      if (!remote.etag) throw new Error("Google create response did not contain an ETag");
      if (createdNow) googleWriteCount += 1;
      const now = new Date();
      await db.$transaction(async (transaction) => {
        const current = await transaction.organizerEvent.findUnique({ where: { id: item.organizerEventId } });
        if (current) {
          await transaction.organizerEvent.update({
            where: { id: current.id },
            data: {
              ...remoteMetadata(remote, now),
              googleCalendarId: targetGoogleCalendarId,
              googleOutboundManaged: true,
              googleOutboundBaseHash: item.localHash
            }
          });
        } else {
          await transaction.googleCalendarOutboundDeletion.create({
            data: {
              organizerEventId: item.organizerEventId,
              googleCalendarId: targetGoogleCalendarId,
              googleCalendarEventId: remote.id,
              googleEtag: remote.etag,
              title: item.title,
              category: item.category,
              status: "pending"
            }
          });
        }
      });
      finalItems.push(item);
      continue;
    }

    if (item.action === "UPDATE") {
      try {
        const remote = await client.updateEvent(
          targetGoogleCalendarId,
          item.googleCalendarEventId!,
          item.payload!,
          item.expectedEtag!
        );
        if (!remote.etag) throw new Error("Google update response did not contain an ETag");
        googleWriteCount += 1;
        await db.organizerEvent.update({
          where: { id: item.organizerEventId },
          data: { ...remoteMetadata(remote, new Date()), googleOutboundBaseHash: item.localHash }
        });
        finalItems.push(item);
      } catch (error) {
        if (!(error instanceof GoogleOutboundConflictError) && !(error instanceof GoogleOutboundNotFoundError)) throw error;
        finalItems.push({ ...item, action: "CONFLICT", reason: error.message, payload: null });
      }
      continue;
    }

    const deletion = await db.googleCalendarOutboundDeletion.findUnique({ where: { id: item.deletionId! } });
    if (!deletion) throw new Error("Outbound deletion tombstone disappeared");
    try {
      await client.deleteEvent(deletion.googleCalendarId, deletion.googleCalendarEventId, item.expectedEtag!);
      googleWriteCount += 1;
      await db.googleCalendarOutboundDeletion.update({
        where: { id: deletion.id },
        data: { status: "deleted", completedAt: new Date() }
      });
      finalItems.push(item);
    } catch (error) {
      if (!(error instanceof GoogleOutboundConflictError) && !(error instanceof GoogleOutboundNotFoundError)) throw error;
      finalItems.push({ ...item, action: "CONFLICT", reason: error.message });
    }
  }
  return result(finalItems, false, googleWriteCount);
}

export async function getGoogleCalendarOutboundStatus(db: GoogleCalendarOutboundDb = prisma) {
  const [mappings, localOnly, managed, pendingDeletions] = await Promise.all([
    db.googleCalendarMapping.findMany({ orderBy: { category: "asc" } }),
    db.organizerEvent.count({ where: { googleCalendarId: null, googleCalendarEventId: null, googleOutboundManaged: false } }),
    db.organizerEvent.count({ where: { googleOutboundManaged: true } }),
    db.googleCalendarOutboundDeletion.count({ where: { status: "pending" } })
  ]);
  return {
    outboundEnabled: mappings.some((mapping) => mapping.outboundEnabledAt !== null),
    mappings: mappings.map((mapping) => ({
      category: mapping.category,
      displayName: mapping.displayName,
      enabled: mapping.enabled,
      outboundEnabledAt: mapping.outboundEnabledAt
    })),
    candidates: { localOnly, managed, pendingDeletions }
  };
}
