import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    phase: "foundation_dry_run_only",
    mappingCount,
    outboundEnabledMappingCount: enabledMappingCount,
    writesEnabled: false,
    pending,
    reconcileRequired,
    conflicts,
    failed,
    timeTreeWriteCount: 0
  };
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
