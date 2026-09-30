import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { createOrganizerEvent, deleteOrganizerEvent, updateOrganizerEvent } from "../lib/organizer/repository";
import { validateEventPayload } from "../lib/organizer/validation";
import { runTimeTreeOutbound, runTimeTreeOutboundDryRun } from "../lib/timetree/outbound-service";
import type { TimeTreeAdapterResponse } from "../lib/timetree/adapter-client";

const directories: string[] = [];

function database() {
  const directory = mkdtempSync(path.join(tmpdir(), "timetree-worker-"));
  directories.push(directory);
  const databasePath = path.join(directory, "test.db");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  for (const migration of [
    "20260924000100_add_organizer_system",
    "20260925000100_add_google_calendar_import",
    "20260927000100_add_google_calendar_outbound",
    "20260929000100_add_timetree_outbound_foundation",
    "20260930000100_add_timetree_base_payload"
  ]) {
    sqlite.exec(readFileSync(path.resolve("prisma/migrations", migration, "migration.sql"), "utf8"));
  }
  sqlite.close();
  return new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });
}

afterEach(() => {
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

async function seed(db: PrismaClient) {
  await db.timeTreeCalendarMapping.create({
    data: {
      calendarName: "Partner",
      calendarId: "calendar-1",
      calendarUrl: "https://timetreeapp.com/calendars/calendar-1",
      enabled: true,
      outboundEnabledAt: new Date("2026-09-30T00:00:00Z")
    }
  });
  return createOrganizerEvent(validateEventPayload({
    title: "Dinner", category: "life",
    startAt: "2026-10-01T10:00:00.000Z", endAt: "2026-10-01T11:00:00.000Z",
    shareWithPartner: true
  }), db);
}

const status = {
  authenticated: true, storage_state_exists: true, calendar_configured: true,
  calendar_found: true, calendar_name: "Partner", calendar_id: "calendar-1",
  calendar_url: "https://timetreeapp.com/calendars/calendar-1", ready: true,
  adapter_write_count: 0
};

function response(request: any, overrides: Partial<TimeTreeAdapterResponse> = {}): TimeTreeAdapterResponse {
  return {
    outcome: "verified", phase: "remote_verified",
    operation_id: request.operationId, organizer_event_id: request.organizerEventId,
    event_id: "remote-1",
    event_url: "https://timetreeapp.com/calendars/calendar-1/events/remote-1",
    calendar_id: "calendar-1", calendar_url: "https://timetreeapp.com/calendars/calendar-1",
    observed_hash: request.desiredHash, error_code: null, error_message: null,
    artifact_ref: null, adapter_write_count: 1, ...overrides
  };
}

const runOptions = {
  dryRun: false, confirmation: "WRITE_TIMETREE", limit: 1,
  writesEnabledByEnvironment: true, now: new Date("2026-09-30T01:00:00Z")
} as const;

test("guarded CREATE verifies remote identity and stores the exact base payload", async () => {
  const db = database();
  try {
    const event = await seed(db);
    const calls: string[] = [];
    const result = await runTimeTreeOutbound({ ...runOptions, adapter: {
      status: async () => status,
      call: async (action, request) => { calls.push(action); return response(request); }
    } }, db);
    assert.deepEqual(calls, ["create"]);
    assert.equal(result.timeTreeWriteCount, 1);
    const stored = await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } });
    assert.equal(stored.timetreeEventId, "remote-1");
    assert.equal(stored.timetreeSyncStatus, "synced");
    assert.ok(stored.timetreeBasePayloadJson);
    assert.equal((await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } })).status, "succeeded");
  } finally { await db.$disconnect(); }
});

test("uncertain CREATE is never recreated and the next run only reconciles", async () => {
  const db = database();
  try {
    const event = await seed(db);
    const actions: string[] = [];
    const adapter = {
      status: async () => status,
      call: async (action: "create" | "reconcile" | "update" | "delete", request: any) => {
        actions.push(action);
        if (action === "create") return response(request, {
          outcome: "reconcile_required", phase: "save_attempted", event_id: null,
          event_url: null, calendar_id: null, calendar_url: null, observed_hash: null,
          error_code: "resolution_failed", error_message: "save result unknown", adapter_write_count: 1
        });
        return response(request, { adapter_write_count: 0 });
      }
    };
    await runTimeTreeOutbound({ ...runOptions, adapter }, db);
    assert.equal((await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } })).status, "reconcile_required");
    await runTimeTreeOutbound({ ...runOptions, now: new Date("2026-09-30T01:01:00Z"), adapter }, db);
    assert.deepEqual(actions, ["create", "reconcile"]);
    assert.equal((await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } })).timetreeEventId, "remote-1");
  } finally { await db.$disconnect(); }
});

test("before-save failure backs off and dry-run never changes the database", async () => {
  const db = database();
  try {
    const event = await seed(db);
    const before = await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } });
    const dry = await runTimeTreeOutboundDryRun(db);
    assert.equal(dry.timeTreeWriteCount, 0);
    assert.deepEqual(await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } }), before);
    await runTimeTreeOutbound({ ...runOptions, adapter: {
      status: async () => status,
      call: async (_action, request) => response(request, {
        outcome: "retryable_error", phase: "before_save", event_id: null, event_url: null,
        calendar_id: null, calendar_url: null, observed_hash: null,
        error_code: "timeout", error_message: "before save", adapter_write_count: 0
      })
    } }, db);
    const operation = await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } });
    assert.equal(operation.status, "retry_wait");
    assert.equal(operation.nextAttemptAt?.toISOString(), "2026-09-30T01:01:00.000Z");
  } finally { await db.$disconnect(); }
});

test("UPDATE and physical-delete tombstone keep the verified remote base", async () => {
  const db = database();
  try {
    const event = await seed(db);
    const adapter = { status: async () => status, call: async (_action: any, request: any) => response(request) };
    await runTimeTreeOutbound({ ...runOptions, adapter }, db);
    await updateOrganizerEvent(event.id, validateEventPayload({ title: "Dinner updated" }, true), db);
    const update = await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } });
    assert.equal(update.action, "update");
    assert.ok(update.basePayloadJson);
    await runTimeTreeOutbound({ ...runOptions, now: new Date("2026-09-30T01:02:00Z"), adapter }, db);
    await deleteOrganizerEvent(event.id, db);
    const tombstone = await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } });
    assert.equal(tombstone.action, "delete");
    assert.ok(tombstone.timetreeEventId);
    assert.ok(tombstone.basePayloadJson);
  } finally { await db.$disconnect(); }
});

test("write guards and exact adapter calendar identity fail closed", async () => {
  const db = database();
  try {
    await seed(db);
    const adapter = { status: async () => ({ ...status, calendar_id: "wrong" }), call: async () => { throw new Error("must not call"); } };
    await assert.rejects(runTimeTreeOutbound({ ...runOptions, confirmation: "wrong", adapter }, db), /confirm/);
    await assert.rejects(runTimeTreeOutbound({ ...runOptions, writesEnabledByEnvironment: false, adapter }, db), /ENABLED/);
    await assert.rejects(runTimeTreeOutbound({ ...runOptions, adapter }, db), /does not exactly match/);
    assert.equal((await db.timeTreeOutboundOperation.findFirstOrThrow()).attemptCount, 0);
  } finally { await db.$disconnect(); }
});

test("mapping cardinality, disabled mapping, and null outbound enablement refuse writes", async () => {
  const db = database();
  try {
    const event = await createOrganizerEvent(validateEventPayload({
      title: "No mapping", category: "life", startAt: "2026-10-01T10:00:00Z",
      endAt: "2026-10-01T11:00:00Z", shareWithPartner: true
    }), db);
    const adapter = { status: async () => status, call: async () => { throw new Error("must not call"); } };
    await assert.rejects(runTimeTreeOutbound({ ...runOptions, adapter }, db), /found 0/);
    await db.timeTreeCalendarMapping.create({ data: { calendarName: "disabled", enabled: false } });
    await db.timeTreeCalendarMapping.create({ data: { calendarName: "not-enabled-yet", calendarId: "x", calendarUrl: "https://timetreeapp.com/calendars/x", enabled: true } });
    await assert.rejects(runTimeTreeOutbound({ ...runOptions, adapter }, db), /found 0/);
    await db.timeTreeCalendarMapping.update({ where: { calendarName: "not-enabled-yet" }, data: { outboundEnabledAt: new Date() } });
    await db.timeTreeCalendarMapping.create({ data: { calendarName: "second", calendarId: "y", calendarUrl: "https://timetreeapp.com/calendars/y", enabled: true, outboundEnabledAt: new Date() } });
    await assert.rejects(runTimeTreeOutbound({ ...runOptions, adapter }, db), /found 2/);
    assert.equal((await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } })).attemptCount, 0);
  } finally { await db.$disconnect(); }
});

test("an active lease prevents a duplicate worker from acquiring the operation", async () => {
  const db = database();
  try {
    const event = await seed(db);
    await db.timeTreeOutboundOperation.update({
      where: { organizerEventId: event.id },
      data: { status: "processing", leaseOwner: "worker-one", leaseExpiresAt: new Date("2026-09-30T01:10:00Z") }
    });
    let calls = 0;
    const result = await runTimeTreeOutbound({ ...runOptions, leaseOwner: "worker-two", adapter: {
      status: async () => status,
      call: async () => { calls += 1; throw new Error("must not call"); }
    } }, db);
    assert.ok("processed" in result);
    assert.equal(result.processed, 0);
    assert.equal(calls, 0);
    assert.equal((await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } })).leaseOwner, "worker-one");
  } finally { await db.$disconnect(); }
});

test("remote conflict is retained for review and never updates sync metadata", async () => {
  const db = database();
  try {
    const event = await seed(db);
    await runTimeTreeOutbound({ ...runOptions, adapter: {
      status: async () => status,
      call: async (_action, request) => response(request, {
        outcome: "conflict", phase: "before_save", event_id: null, event_url: null,
        calendar_id: null, calendar_url: null, observed_hash: null,
        error_code: "ambiguous_candidates", error_message: "multiple candidates", adapter_write_count: 0
      })
    } }, db);
    const operation = await db.timeTreeOutboundOperation.findUniqueOrThrow({ where: { organizerEventId: event.id } });
    const stored = await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } });
    assert.equal(operation.status, "conflict");
    assert.equal(stored.timetreeEventId, null);
    assert.equal(stored.timetreeSyncStatus, "error");
  } finally { await db.$disconnect(); }
});
