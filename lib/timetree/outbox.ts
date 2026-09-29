import type { Prisma } from "@prisma/client";
import { timeTreeDesiredPayload, timeTreePayloadHash, type TimeTreeEventSource } from "./payload";

type TimeTreeEventState = TimeTreeEventSource & {
  shareWithPartner: boolean;
  timetreeCalendarId: string | null;
  timetreeEventId: string | null;
  timetreeEventUrl: string | null;
  timetreeBaseHash: string | null;
};

function operationData(event: TimeTreeEventState, action: "create" | "update" | "delete") {
  const payload = timeTreeDesiredPayload(event);
  const desiredHash = timeTreePayloadHash(payload);
  return {
    action,
    status: "pending",
    idempotencyKey: `${event.id}:${action}:${desiredHash}`,
    payloadJson: JSON.stringify(payload),
    desiredHash,
    timetreeCalendarId: event.timetreeCalendarId,
    timetreeEventId: event.timetreeEventId,
    timetreeEventUrl: event.timetreeEventUrl,
    attemptCount: 0,
    nextAttemptAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    saveAttemptedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null
  };
}

async function upsertOperation(
  transaction: Prisma.TransactionClient,
  event: TimeTreeEventState,
  action: "create" | "update" | "delete"
) {
  const data = operationData(event, action);
  await transaction.timeTreeOutboundOperation.upsert({
    where: { organizerEventId: event.id },
    create: { organizerEventId: event.id, ...data },
    update: data
  });
}

export async function reconcileTimeTreeOutbox(
  transaction: Prisma.TransactionClient,
  event: TimeTreeEventState
) {
  if (!event.shareWithPartner) {
    if (event.timetreeEventId) {
      await upsertOperation(transaction, event, "delete");
      await transaction.organizerEvent.update({ where: { id: event.id }, data: { timetreeSyncStatus: "pending" } });
    } else {
      await transaction.timeTreeOutboundOperation.deleteMany({ where: { organizerEventId: event.id } });
      await transaction.organizerEvent.update({ where: { id: event.id }, data: { timetreeSyncStatus: "not_requested" } });
    }
    return;
  }

  const payloadHash = timeTreePayloadHash(timeTreeDesiredPayload(event));
  if (!event.timetreeEventId) {
    await upsertOperation(transaction, event, "create");
    await transaction.organizerEvent.update({ where: { id: event.id }, data: { timetreeSyncStatus: "pending" } });
  } else if (payloadHash !== event.timetreeBaseHash) {
    await upsertOperation(transaction, event, "update");
    await transaction.organizerEvent.update({ where: { id: event.id }, data: { timetreeSyncStatus: "pending" } });
  } else {
    await transaction.timeTreeOutboundOperation.deleteMany({ where: { organizerEventId: event.id, status: "pending" } });
    await transaction.organizerEvent.update({ where: { id: event.id }, data: { timetreeSyncStatus: "synced" } });
  }
}

export async function createTimeTreeDeletionTombstone(
  transaction: Prisma.TransactionClient,
  event: TimeTreeEventState
) {
  if (event.timetreeEventId) await upsertOperation(transaction, event, "delete");
  else await transaction.timeTreeOutboundOperation.deleteMany({ where: { organizerEventId: event.id } });
}
