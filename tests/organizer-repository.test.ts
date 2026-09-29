import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  createOrganizerEvent,
  createOrganizerRoutine,
  createOrganizerTask,
  createOrganizerTimeBlock,
  completeRoutine,
  deleteOrganizerEvent,
  deleteOrganizerRoutine,
  deleteRoutineCompletion,
  deleteOrganizerTask,
  deleteOrganizerTimeBlock,
  getOrganizerRoutine,
  getRoutineCompletion,
  getOrganizerTask,
  listOrganizerEvents,
  listOrganizerTimeBlocks,
  listUnscheduledTasks,
  updateOrganizerEvent,
  updateOrganizerRoutine,
  updateRoutineCompletion,
  updateOrganizerTask,
  updateOrganizerTimeBlock
} from "../lib/organizer/repository";
import { tokyoDayBounds } from "../lib/organizer/dates";
import { runTimeTreeOutboundDryRun } from "../lib/timetree/outbound-service";
import { timeTreeDesiredPayload } from "../lib/timetree/payload";
import {
  validateEventPayload,
  validateRoutineCompletionPayload,
  validateRoutinePayload,
  validateTaskPayload,
  validateTimeBlockPayload
} from "../lib/organizer/validation";

let directory = "";
let client: PrismaClient;

before(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "organizer-test-"));
  const databasePath = path.join(directory, "organizer.db");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(
    readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20260924000100_add_organizer_system/migration.sql"),
      "utf8"
    )
  );
  sqlite.exec(
    readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20260925000100_add_google_calendar_import/migration.sql"),
      "utf8"
    )
  );
  sqlite.exec(
    readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20260927000100_add_google_calendar_outbound/migration.sql"),
      "utf8"
    )
  );
  sqlite.exec(
    readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20260929000100_add_timetree_outbound_foundation/migration.sql"),
      "utf8"
    )
  );
  sqlite.close();
  client = new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });
  await client.$connect();
});

after(async () => {
  await client.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

test("Task CRUD preserves date-only fields and completion state", async () => {
  const created = await createOrganizerTask(
    validateTaskPayload({
      title: "GitHub学生更新",
      description: "期限前に更新",
      category: "work",
      importance: 2,
      estimatedMinutes: 30,
      targetDate: "2026-09-24",
      dueDate: "2026-09-30"
    }),
    client
  );
  assert.equal(created.targetDate, "2026-09-24");
  const completed = await updateOrganizerTask(created.id, validateTaskPayload({ status: "completed" }, true), client);
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt);
  const reopened = await updateOrganizerTask(created.id, validateTaskPayload({ status: "doing", title: "更新作業" }, true), client);
  assert.equal(reopened.completedAt, null);
  assert.equal((await getOrganizerTask(created.id, client))?.title, "更新作業");
  await deleteOrganizerTask(created.id, client);
  assert.equal(await getOrganizerTask(created.id, client), null);
});

test("Event CRUD validates and returns a Tokyo-day range", async () => {
  const created = await createOrganizerEvent(
    validateEventPayload({
      title: "面接",
      category: "work",
      startAt: "2026-09-24T05:00:00.000Z",
      endAt: "2026-09-24T06:00:00.000Z",
      allDay: false,
      shareWithPartner: false
    }),
    client
  );
  const events = await listOrganizerEvents(tokyoDayBounds("2026-09-24"), client);
  assert.equal(events.some((event) => event.id === created.id), true);
  const updated = await updateOrganizerEvent(created.id, validateEventPayload({ location: "Online" }, true), client);
  assert.equal(updated.location, "Online");
  await deleteOrganizerEvent(created.id, client);
  assert.equal((await listOrganizerEvents(tokyoDayBounds("2026-09-24"), client)).length, 0);
});

test("shared Event writes a transactional TimeTree create operation", async () => {
  const created = await createOrganizerEvent(
    validateEventPayload({
      title: "共有予定",
      category: "life",
      startAt: "2026-09-29T10:00:00.000Z",
      endAt: "2026-09-29T11:00:00.000Z",
      shareWithPartner: true
    }),
    client
  );
  assert.equal(created.timetreeSyncStatus, "pending");
  const operation = await client.timeTreeOutboundOperation.findUnique({ where: { organizerEventId: created.id } });
  assert.equal(operation?.action, "create");
  assert.equal(JSON.parse(operation!.payloadJson).organizerEventId, created.id);
  await deleteOrganizerEvent(created.id, client);
  assert.equal(await client.timeTreeOutboundOperation.findUnique({ where: { organizerEventId: created.id } }), null);
});

test("linked TimeTree Event produces update, unshare, and deletion tombstones", async () => {
  const created = await createOrganizerEvent(
    validateEventPayload({
      title: "同期済み予定",
      category: "life",
      startAt: "2026-09-29T10:00:00.000Z",
      endAt: "2026-09-29T11:00:00.000Z",
      shareWithPartner: false
    }),
    client
  );
  await client.organizerEvent.update({
    where: { id: created.id },
    data: { shareWithPartner: true, timetreeEventId: "tt-event-1", timetreeBaseHash: "old", timetreeSyncStatus: "synced" }
  });
  await updateOrganizerEvent(created.id, validateEventPayload({ title: "変更後" }, true), client);
  assert.equal((await client.timeTreeOutboundOperation.findUnique({ where: { organizerEventId: created.id } }))?.action, "update");
  await updateOrganizerEvent(created.id, validateEventPayload({ shareWithPartner: false }, true), client);
  assert.equal((await client.timeTreeOutboundOperation.findUnique({ where: { organizerEventId: created.id } }))?.action, "delete");
  await deleteOrganizerEvent(created.id, client);
  assert.equal((await client.timeTreeOutboundOperation.findUnique({ where: { organizerEventId: created.id } }))?.action, "delete");
});

test("public Event validation rejects synchronization metadata", () => {
  assert.throws(
    () => validateEventPayload({ title: "x", category: "life", startAt: "2026-09-29T10:00:00Z", endAt: "2026-09-29T11:00:00Z", timetreeEventId: "unsafe" }),
    /同期処理だけ/
  );
});

test("TimeTree outbound dry-run reports candidates without changing the database", async () => {
  const created = await createOrganizerEvent(
    validateEventPayload({
      title: "dry-run共有予定",
      category: "life",
      startAt: "2026-09-30T10:00:00.000Z",
      endAt: "2026-09-30T11:00:00.000Z",
      shareWithPartner: true
    }),
    client
  );
  const before = await client.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: created.id } });
  const result = await runTimeTreeOutboundDryRun(client);
  const after = await client.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: created.id } });
  assert.equal(result.dryRun, true);
  assert.equal(result.timeTreeWriteCount, 0);
  assert.equal(result.items.some((item) => item.organizerEventId === created.id && item.action === "create"), true);
  assert.deepEqual(after, before);
  await deleteOrganizerEvent(created.id, client);
});

test("TimeTree payload keeps Tokyo all-day dates separate from instants", () => {
  const payload = timeTreeDesiredPayload({
    id: "event-all-day",
    title: "終日予定",
    description: null,
    startAt: new Date("2026-09-29T15:00:00.000Z"),
    endAt: new Date("2026-09-30T15:00:00.000Z"),
    allDay: true,
    location: null,
    startDate: null,
    endDateExclusive: null
  });
  assert.equal(payload.startDate, "2026-09-30");
  assert.equal(payload.endDateExclusive, "2026-10-01");
});

test("Task-TimeBlock relation supports multiple blocks and unscheduled detection", async () => {
  const task = await createOrganizerTask(
    validateTaskPayload({ title: "CFRP解析", category: "university", importance: 3, estimatedMinutes: 120 }),
    client
  );
  assert.equal((await listUnscheduledTasks(client)).some((item) => item.id === task.id), true);
  const first = await createOrganizerTimeBlock(
    validateTimeBlockPayload({
      taskId: task.id,
      title: task.title,
      startAt: "2026-09-24T00:00:00.000Z",
      endAt: "2026-09-24T01:30:00.000Z"
    }),
    client
  );
  const second = await createOrganizerTimeBlock(
    validateTimeBlockPayload({
      taskId: task.id,
      title: `${task.title} 続き`,
      startAt: "2026-09-25T00:00:00.000Z",
      endAt: "2026-09-25T00:30:00.000Z"
    }),
    client
  );
  assert.equal((await listUnscheduledTasks(client)).some((item) => item.id === task.id), false);
  const dayBlocks = await listOrganizerTimeBlocks(tokyoDayBounds("2026-09-24"), client);
  assert.equal(dayBlocks.length, 1);
  assert.equal(dayBlocks[0].task.id, task.id);
  const updated = await updateOrganizerTimeBlock(first.id, validateTimeBlockPayload({ status: "completed" }, true), client);
  assert.equal(updated.status, "completed");
  await deleteOrganizerTimeBlock(first.id, client);
  await deleteOrganizerTimeBlock(second.id, client);
  assert.equal((await listUnscheduledTasks(client)).some((item) => item.id === task.id), true);
  await deleteOrganizerTask(task.id, client);
});

test("Routine and RoutineCompletion support CRUD and date-only uniqueness", async () => {
  const routine = await createOrganizerRoutine(
    validateRoutinePayload({
      title: "English",
      category: "life",
      estimatedMinutes: 20,
      daysOfWeek: [1, 3, 5],
      active: true
    }),
    client
  );
  assert.deepEqual(routine.daysOfWeek, [1, 3, 5]);
  const updatedRoutine = await updateOrganizerRoutine(
    routine.id,
    validateRoutinePayload({ estimatedMinutes: 25 }, true),
    client
  );
  assert.equal(updatedRoutine.estimatedMinutes, 25);
  assert.equal((await getOrganizerRoutine(routine.id, client))?.title, "English");

  const completion = await completeRoutine(
    validateRoutineCompletionPayload({ routineId: routine.id, date: "2026-09-24" }),
    client
  );
  const sameCompletion = await completeRoutine(
    validateRoutineCompletionPayload({ routineId: routine.id, date: "2026-09-24" }),
    client
  );
  assert.equal(sameCompletion.id, completion.id);
  const changedAt = new Date("2026-09-24T12:00:00.000Z");
  const updatedCompletion = await updateRoutineCompletion(
    completion.id,
    validateRoutineCompletionPayload({ completedAt: changedAt.toISOString() }, true),
    client
  );
  assert.equal(updatedCompletion.completedAt.toISOString(), changedAt.toISOString());
  assert.equal((await getRoutineCompletion(completion.id, client))?.date, "2026-09-24");

  await deleteRoutineCompletion(completion.id, client);
  assert.equal(await getRoutineCompletion(completion.id, client), null);
  await deleteOrganizerRoutine(routine.id, client);
  assert.equal(await getOrganizerRoutine(routine.id, client), null);
});
