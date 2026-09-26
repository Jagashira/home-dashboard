import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { deleteOrganizerEvent } from "../lib/organizer/repository";
import {
  GoogleOutboundAlreadyExistsError,
  GoogleOutboundConflictError,
  GoogleOutboundNotFoundError
} from "../lib/google-calendar/errors";
import type { GoogleCalendarOutboundClient, GoogleOutboundRemoteEvent } from "../lib/google-calendar/outbound-client";
import { localOutboundHash, type GoogleOutboundEventPayload } from "../lib/google-calendar/outbound-payload";
import {
  buildGoogleCalendarOutboundPlan,
  runGoogleCalendarOutbound
} from "../lib/google-calendar/outbound-service";
import { runGoogleCalendarIncrementalSync } from "../lib/google-calendar/sync-service";
import type { EventPage, GoogleCalendarReadClient } from "../lib/google-calendar/types";

let directory = "";
let db: PrismaClient;

before(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "google-outbound-test-"));
  const databasePath = path.join(directory, "organizer.db");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  for (const migration of [
    "prisma/migrations/20260924000100_add_organizer_system/migration.sql",
    "prisma/migrations/20260925000100_add_google_calendar_import/migration.sql",
    "prisma/migrations/20260927000100_add_google_calendar_outbound/migration.sql"
  ]) {
    sqlite.exec(readFileSync(path.resolve(process.cwd(), migration), "utf8"));
  }
  sqlite.close();
  db = new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });
  await db.$connect();
});

after(async () => {
  await db.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.googleCalendarSyncRun.deleteMany();
  await db.googleCalendarOutboundDeletion.deleteMany();
  await db.googleCalendarSyncCursor.deleteMany();
  await db.googleCalendarMapping.deleteMany();
  await db.organizerEvent.deleteMany();
  await db.organizerTask.deleteMany();
});

class FakeOutboundClient implements GoogleCalendarOutboundClient {
  readonly remotes = new Map<string, GoogleOutboundRemoteEvent>();
  readonly calls = { get: 0, create: 0, update: 0, delete: 0 };
  failCreate = false;
  failUpdate = false;
  failDelete = false;
  alreadyExistsOnCreate = false;

  constructor(private readonly scopes = ["https://www.googleapis.com/auth/calendar.readonly"]) {}

  async getGrantedScopes() { return this.scopes; }
  async getEvent(calendarId: string, eventId: string) {
    this.calls.get += 1;
    const remote = this.remotes.get(`${calendarId}:${eventId}`);
    if (!remote) throw new GoogleOutboundNotFoundError();
    return remote;
  }
  async createEvent(calendarId: string, payload: GoogleOutboundEventPayload) {
    this.calls.create += 1;
    if (this.failCreate) throw new Error("simulated create failure");
    if (this.alreadyExistsOnCreate) throw new GoogleOutboundAlreadyExistsError();
    const remote = remoteFromPayload(payload, '"etag-create"');
    this.remotes.set(`${calendarId}:${remote.id}`, remote);
    return remote;
  }
  async updateEvent(calendarId: string, eventId: string, payload: GoogleOutboundEventPayload, expectedEtag: string) {
    this.calls.update += 1;
    if (this.failUpdate) throw new Error("simulated update failure");
    const current = this.remotes.get(`${calendarId}:${eventId}`);
    if (!current) throw new GoogleOutboundNotFoundError();
    if (current.etag !== expectedEtag) throw new GoogleOutboundConflictError();
    const remote = remoteFromPayload({ ...payload, id: eventId }, '"etag-updated"');
    this.remotes.set(`${calendarId}:${eventId}`, remote);
    return remote;
  }
  async deleteEvent(calendarId: string, eventId: string, expectedEtag: string) {
    this.calls.delete += 1;
    if (this.failDelete) throw new Error("simulated delete failure");
    const current = this.remotes.get(`${calendarId}:${eventId}`);
    if (!current) throw new GoogleOutboundNotFoundError();
    if (current.etag !== expectedEtag) throw new GoogleOutboundConflictError();
    this.remotes.delete(`${calendarId}:${eventId}`);
  }
}

function remoteFromPayload(payload: GoogleOutboundEventPayload, etag: string): GoogleOutboundRemoteEvent {
  return {
    id: payload.id!,
    etag,
    updated: "2026-09-27T00:00:00.000Z",
    status: "confirmed",
    summary: payload.summary,
    description: payload.description ?? null,
    location: payload.location ?? null,
    start: payload.start,
    end: payload.end,
    eventType: "default",
    homeDashboardEventId: payload.extendedProperties.private.homeDashboardEventId
  };
}

async function seedMapping(
  category: "university" | "work" | "entertainment" | "life",
  outboundEnabled = false
) {
  const googleCalendarId = `cal-${category}`;
  await db.googleCalendarMapping.create({
    data: {
      category,
      googleCalendarId,
      displayName: { university: "大学", work: "仕事", entertainment: "娯楽", life: "生活" }[category],
      accessRole: "owner",
      timeZone: "Asia/Tokyo",
      importCompletedAt: new Date("2026-09-25T00:00:00.000Z"),
      outboundEnabledAt: outboundEnabled ? new Date("2026-09-27T00:00:00.000Z") : null
    }
  });
  await db.googleCalendarSyncCursor.create({
    data: { googleCalendarId, syncToken: `sync-${category}`, lastFullSyncAt: new Date("2026-09-25T00:00:00.000Z") }
  });
  return googleCalendarId;
}

async function localEvent(category: "university" | "work" | "entertainment" | "life" = "work") {
  return db.organizerEvent.create({
    data: {
      title: "ローカル予定",
      description: "説明",
      category,
      startAt: new Date("2026-10-01T00:00:00.000Z"),
      endAt: new Date("2026-10-01T01:00:00.000Z"),
      location: "自宅",
      shareWithPartner: true,
      timetreeEventId: `tt-local-${category}`,
      timetreeSyncStatus: "synced"
    }
  });
}

async function managedEvent(calendarId: string, eventId = "managed-event") {
  const created = await db.organizerEvent.create({
    data: {
      title: "同期済み",
      category: "work",
      startAt: new Date("2026-10-01T00:00:00.000Z"),
      endAt: new Date("2026-10-01T01:00:00.000Z"),
      googleCalendarId: calendarId,
      googleCalendarEventId: eventId,
      googleEtag: '"etag-base"',
      googleSyncStatus: "updated",
      googleOutboundManaged: true,
      shareWithPartner: true,
      timetreeEventId: `tt-${eventId}`,
      timetreeSyncStatus: "synced"
    }
  });
  return db.organizerEvent.update({
    where: { id: created.id },
    data: { googleOutboundBaseHash: localOutboundHash(created) }
  });
}

function remoteForEvent(event: Awaited<ReturnType<typeof managedEvent>>, etag = event.googleEtag!) {
  return remoteFromPayload({
    ...({} as { id?: string }),
    id: event.googleCalendarEventId!,
    summary: event.title,
    start: { dateTime: event.startAt.toISOString(), timeZone: "Asia/Tokyo" },
    end: { dateTime: event.endAt.toISOString(), timeZone: "Asia/Tokyo" },
    extendedProperties: { private: { homeDashboardEventId: event.id } }
  }, etag);
}

const enabledOptions = {
  dryRun: false,
  confirmation: "WRITE_GOOGLE_CALENDAR",
  writesEnabledByEnvironment: true
} as const;

test("migration keeps existing imported events protected and mappings disabled", () => {
  const migrationDirectory = mkdtempSync(path.join(tmpdir(), "google-outbound-migration-"));
  const sqlite = new Database(path.join(migrationDirectory, "migration.db"));
  try {
    sqlite.exec(readFileSync(path.resolve(process.cwd(), "prisma/migrations/20260924000100_add_organizer_system/migration.sql"), "utf8"));
    sqlite.exec(readFileSync(path.resolve(process.cwd(), "prisma/migrations/20260925000100_add_google_calendar_import/migration.sql"), "utf8"));
    sqlite.prepare(`
      INSERT INTO OrganizerEvent (
        id, title, category, startAt, endAt, googleCalendarId, googleCalendarEventId,
        googleSyncStatus, timetreeSyncStatus, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "existing-import", "既存Import", "work", "2026-10-01T00:00:00.000Z", "2026-10-01T01:00:00.000Z",
      "cal-work", "google-existing", "imported", "not_requested", "2026-09-25T00:00:00.000Z", "2026-09-25T00:00:00.000Z"
    );
    sqlite.prepare(`
      INSERT INTO GoogleCalendarMapping (
        id, category, googleCalendarId, displayName, accessRole, enabled,
        importCompletedAt, outboundEnabledAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "mapping-work", "work", "cal-work", "仕事", "owner", 1,
      "2026-09-25T00:00:00.000Z", null, "2026-09-25T00:00:00.000Z", "2026-09-25T00:00:00.000Z"
    );
    sqlite.exec(readFileSync(path.resolve(process.cwd(), "prisma/migrations/20260927000100_add_google_calendar_outbound/migration.sql"), "utf8"));
    assert.deepEqual(
      sqlite.prepare("SELECT googleOutboundManaged, googleOutboundBaseHash FROM OrganizerEvent WHERE id = ?").get("existing-import"),
      { googleOutboundManaged: 0, googleOutboundBaseHash: null }
    );
    assert.deepEqual(
      sqlite.prepare("SELECT outboundEnabledAt FROM GoogleCalendarMapping WHERE id = ?").get("mapping-work"),
      { outboundEnabledAt: null }
    );
  } finally {
    sqlite.close();
    rmSync(migrationDirectory, { recursive: true, force: true });
  }
});

test("dry-run reports local Event CREATE candidates by category and never writes DB or Google", async () => {
  const workCalendarId = await seedMapping("work");
  await seedMapping("life");
  const event = await localEvent("work");
  await db.organizerTask.create({ data: { title: "Task is not an event", category: "work" } });
  await db.organizerEvent.create({
    data: {
      title: "Google由来",
      category: "life",
      startAt: new Date("2026-10-02T00:00:00.000Z"),
      endAt: new Date("2026-10-02T01:00:00.000Z"),
      googleCalendarId: "cal-life",
      googleCalendarEventId: "inbound",
      googleEtag: '"inbound"',
      googleSyncStatus: "imported"
    }
  });
  const before = JSON.stringify({
    events: await db.organizerEvent.findMany({ orderBy: { id: "asc" } }),
    deletions: await db.googleCalendarOutboundDeletion.findMany()
  });
  const client = new FakeOutboundClient();
  const dry = await runGoogleCalendarOutbound(client, { dryRun: true }, db);
  assert.equal(dry.totals.created, 1);
  assert.equal(dry.totals.googleWriteCount, 0);
  assert.equal(client.calls.create + client.calls.update + client.calls.delete, 0);
  const create = dry.items.find((item) => item.action === "CREATE")!;
  assert.equal(create.organizerEventId, event.id);
  assert.equal(create.targetGoogleCalendarId, workCalendarId);
  assert.equal(create.title, "ローカル予定");
  assert.equal(create.description, "説明");
  assert.equal(create.location, "自宅");
  assert.equal(dry.items.some((item) => item.title === "Task is not an event"), false);
  assert.equal(JSON.stringify({
    events: await db.organizerEvent.findMany({ orderBy: { id: "asc" } }),
    deletions: await db.googleCalendarOutboundDeletion.findMany()
  }), before);
});

test("local edits become UPDATE, inbound-owned events stay protected, and remote edits conflict", async () => {
  const calendarId = await seedMapping("work");
  const managed = await managedEvent(calendarId);
  const client = new FakeOutboundClient();
  client.remotes.set(`${calendarId}:${managed.googleCalendarEventId}`, remoteForEvent(managed));
  let plan = await buildGoogleCalendarOutboundPlan(client, db);
  assert.equal(plan.find((item) => item.organizerEventId === managed.id)?.action, "SKIP");

  await db.organizerEvent.update({ where: { id: managed.id }, data: { title: "ローカル編集" } });
  plan = await buildGoogleCalendarOutboundPlan(client, db);
  assert.equal(plan.find((item) => item.organizerEventId === managed.id)?.action, "UPDATE");

  client.remotes.set(`${calendarId}:${managed.googleCalendarEventId}`, remoteForEvent(managed, '"google-edited"'));
  plan = await buildGoogleCalendarOutboundPlan(client, db);
  assert.equal(plan.find((item) => item.organizerEventId === managed.id)?.action, "CONFLICT");

  await db.organizerEvent.create({
    data: {
      title: "Inbound edited locally",
      category: "work",
      startAt: new Date("2026-10-03T00:00:00.000Z"),
      endAt: new Date("2026-10-03T01:00:00.000Z"),
      googleCalendarId: calendarId,
      googleCalendarEventId: "inbound-protected",
      googleEtag: '"etag"',
      googleSyncStatus: "imported"
    }
  });
  plan = await buildGoogleCalendarOutboundPlan(client, db);
  assert.equal(plan.find((item) => item.googleCalendarEventId === "inbound-protected")?.action, "SKIP");
});

test("managed local deletion creates a DELETE tombstone while local-only deletion does not", async () => {
  const calendarId = await seedMapping("work");
  const managed = await managedEvent(calendarId);
  const local = await localEvent();
  await deleteOrganizerEvent(managed.id, db);
  await deleteOrganizerEvent(local.id, db);
  assert.equal(await db.googleCalendarOutboundDeletion.count(), 1);
  const tombstone = await db.googleCalendarOutboundDeletion.findFirstOrThrow();
  assert.equal(tombstone.googleCalendarEventId, managed.googleCalendarEventId);
  const client = new FakeOutboundClient();
  client.remotes.set(`${calendarId}:${managed.googleCalendarEventId}`, remoteForEvent(managed));
  const dry = await runGoogleCalendarOutbound(client, { dryRun: true }, db);
  assert.equal(dry.totals.deleted, 1);
  assert.equal((await db.googleCalendarOutboundDeletion.findUnique({ where: { id: tombstone.id } }))?.status, "pending");
});

test("outbound disabled rejects actual writes even with confirmation and environment guard", async () => {
  await seedMapping("work", false);
  await localEvent();
  const client = new FakeOutboundClient(["https://www.googleapis.com/auth/calendar.events.owned"]);
  await assert.rejects(
    () => runGoogleCalendarOutbound(client, enabledOptions, db),
    /disabled in GoogleCalendarMapping/
  );
  assert.deepEqual(client.calls, { get: 0, create: 0, update: 0, delete: 0 });
});

test("Google create, update and delete failures never confirm synchronized state", async () => {
  const calendarId = await seedMapping("work", true);
  const client = new FakeOutboundClient(["https://www.googleapis.com/auth/calendar.events.owned"]);

  const createCandidate = await localEvent();
  client.failCreate = true;
  await assert.rejects(() => runGoogleCalendarOutbound(client, enabledOptions, db), /simulated create failure/);
  const afterCreateFailure = await db.organizerEvent.findUniqueOrThrow({ where: { id: createCandidate.id } });
  assert.equal(afterCreateFailure.googleCalendarEventId, null);
  assert.equal(afterCreateFailure.googleOutboundManaged, false);
  await db.organizerEvent.delete({ where: { id: createCandidate.id } });

  const updateCandidate = await managedEvent(calendarId, "update-fail");
  client.remotes.set(`${calendarId}:update-fail`, remoteForEvent(updateCandidate));
  await db.organizerEvent.update({ where: { id: updateCandidate.id }, data: { title: "Dirty" } });
  client.failCreate = false;
  client.failUpdate = true;
  await assert.rejects(() => runGoogleCalendarOutbound(client, enabledOptions, db), /simulated update failure/);
  const afterUpdateFailure = await db.organizerEvent.findUniqueOrThrow({ where: { id: updateCandidate.id } });
  assert.equal(afterUpdateFailure.googleEtag, '"etag-base"');
  assert.equal(afterUpdateFailure.googleOutboundBaseHash, updateCandidate.googleOutboundBaseHash);

  client.failUpdate = false;
  await deleteOrganizerEvent(updateCandidate.id, db);
  client.failDelete = true;
  await assert.rejects(() => runGoogleCalendarOutbound(client, enabledOptions, db), /simulated delete failure/);
  assert.equal((await db.googleCalendarOutboundDeletion.findFirstOrThrow()).status, "pending");
});

test("successful UPDATE and DELETE preserve unrelated metadata and affect only the exact calendar event", async () => {
  const workCalendarId = await seedMapping("work", true);
  const lifeCalendarId = await seedMapping("life", true);
  const event = await managedEvent(workCalendarId, "work-managed");
  const client = new FakeOutboundClient(["https://www.googleapis.com/auth/calendar.events.owned"]);
  client.remotes.set(`${workCalendarId}:work-managed`, remoteForEvent(event));
  const otherRemote = { ...remoteForEvent(event), id: "life-other" };
  client.remotes.set(`${lifeCalendarId}:life-other`, otherRemote);
  await db.organizerEvent.update({ where: { id: event.id }, data: { title: "更新後" } });

  const updated = await runGoogleCalendarOutbound(client, enabledOptions, db);
  assert.equal(updated.totals.updated, 1);
  assert.equal(updated.totals.googleWriteCount, 1);
  const stored = await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(stored.title, "更新後");
  assert.equal(stored.googleEtag, '"etag-updated"');
  assert.equal(stored.shareWithPartner, true);
  assert.equal(stored.timetreeEventId, "tt-work-managed");
  assert.equal(stored.timetreeSyncStatus, "synced");
  assert.ok(client.remotes.has(`${lifeCalendarId}:life-other`));

  await deleteOrganizerEvent(event.id, db);
  const deleted = await runGoogleCalendarOutbound(client, enabledOptions, db);
  assert.equal(deleted.totals.deleted, 1);
  assert.equal(deleted.totals.googleWriteCount, 1);
  assert.equal((await db.googleCalendarOutboundDeletion.findFirstOrThrow()).status, "deleted");
  assert.equal(client.remotes.has(`${workCalendarId}:work-managed`), false);
  assert.ok(client.remotes.has(`${lifeCalendarId}:life-other`));
});

test("confirmation, environment, DB enablement, and OAuth write scope are independent guards", async () => {
  await seedMapping("work", true);
  await localEvent();
  const readonly = new FakeOutboundClient();
  await assert.rejects(
    () => runGoogleCalendarOutbound(readonly, { dryRun: false, writesEnabledByEnvironment: true }, db),
    /requires --confirm/
  );
  await assert.rejects(
    () => runGoogleCalendarOutbound(readonly, { dryRun: false, confirmation: "WRITE_GOOGLE_CALENDAR", writesEnabledByEnvironment: false }, db),
    /environment guard/
  );
  await assert.rejects(
    () => runGoogleCalendarOutbound(readonly, enabledOptions, db),
    /write scope/
  );
  assert.equal(readonly.calls.create + readonly.calls.update + readonly.calls.delete, 0);
});

test("successful outbound persists identity, preserves local metadata, and next inbound does not loop", async () => {
  const calendarId = await seedMapping("work", true);
  const event = await localEvent();
  const client = new FakeOutboundClient(["https://www.googleapis.com/auth/calendar.events.owned"]);
  const written = await runGoogleCalendarOutbound(client, enabledOptions, db);
  assert.equal(written.totals.created, 1);
  assert.equal(written.totals.googleWriteCount, 1);
  const linked = await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(linked.googleOutboundManaged, true);
  assert.ok(linked.googleCalendarEventId);
  assert.ok(linked.googleOutboundBaseHash);
  assert.equal(linked.shareWithPartner, true);
  assert.equal(linked.timetreeEventId, "tt-local-work");
  assert.equal(linked.timetreeSyncStatus, "synced");

  const remote = client.remotes.get(`${calendarId}:${linked.googleCalendarEventId}`)!;
  const inbound = new FakeInboundClient(calendarId, {
    items: [{
      id: remote.id,
      etag: remote.etag,
      updated: remote.updated,
      status: remote.status,
      summary: remote.summary,
      description: remote.description,
      location: remote.location,
      eventType: remote.eventType,
      start: remote.start,
      end: remote.end
    }],
    nextSyncToken: "after-outbound"
  });
  await runGoogleCalendarIncrementalSync(inbound, {}, db);
  const afterInbound = await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } });
  assert.equal(afterInbound.shareWithPartner, true);
  assert.equal(afterInbound.timetreeEventId, "tt-local-work");
  const nextPlan = await buildGoogleCalendarOutboundPlan(client, db);
  assert.equal(nextPlan.find((item) => item.organizerEventId === event.id)?.action, "SKIP");
});

test("deterministic CREATE retry re-links only the matching Home Dashboard event", async () => {
  const calendarId = await seedMapping("work", true);
  const event = await localEvent();
  const client = new FakeOutboundClient(["https://www.googleapis.com/auth/calendar.events.owned"]);
  const plan = await buildGoogleCalendarOutboundPlan(client, db);
  const create = plan.find((item) => item.organizerEventId === event.id)!;
  const existing = remoteFromPayload(create.payload!, '"etag-existing"');
  client.remotes.set(`${calendarId}:${existing.id}`, existing);
  client.alreadyExistsOnCreate = true;
  const retried = await runGoogleCalendarOutbound(client, enabledOptions, db);
  assert.equal(retried.totals.googleWriteCount, 0);
  assert.equal((await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } })).googleCalendarEventId, existing.id);

  const collision = await localEvent("life");
  await seedMapping("life", true);
  const collisionPlan = await buildGoogleCalendarOutboundPlan(client, db);
  const collisionCreate = collisionPlan.find((item) => item.organizerEventId === collision.id)!;
  const foreign = { ...remoteFromPayload(collisionCreate.payload!, '"etag-foreign"'), homeDashboardEventId: "another-event" };
  client.remotes.set(`cal-life:${foreign.id}`, foreign);
  const collisionResult = await runGoogleCalendarOutbound(client, enabledOptions, db);
  assert.equal(collisionResult.items.find((item) => item.organizerEventId === collision.id)?.action, "CONFLICT");
  assert.equal((await db.organizerEvent.findUniqueOrThrow({ where: { id: collision.id } })).googleCalendarEventId, null);
});

test("inbound preserves a dirty managed event so concurrent Google edits become outbound conflicts", async () => {
  const calendarId = await seedMapping("work");
  const event = await managedEvent(calendarId, "concurrent");
  await db.organizerEvent.update({ where: { id: event.id }, data: { title: "ローカル変更" } });
  const inbound = new FakeInboundClient(calendarId, {
    items: [{
      id: "concurrent",
      etag: '"google-new"',
      updated: "2026-09-27T01:00:00.000Z",
      status: "confirmed",
      summary: "Google変更",
      eventType: "default",
      start: { dateTime: "2026-10-01T09:00:00+09:00", timeZone: "Asia/Tokyo" },
      end: { dateTime: "2026-10-01T10:00:00+09:00", timeZone: "Asia/Tokyo" }
    }],
    nextSyncToken: "concurrent-next"
  });
  await runGoogleCalendarIncrementalSync(inbound, {}, db);
  assert.equal((await db.organizerEvent.findUniqueOrThrow({ where: { id: event.id } })).title, "ローカル変更");

  const outbound = new FakeOutboundClient();
  outbound.remotes.set(`${calendarId}:concurrent`, remoteForEvent(event, '"google-new"'));
  const plan = await buildGoogleCalendarOutboundPlan(outbound, db);
  assert.equal(plan.find((item) => item.organizerEventId === event.id)?.action, "CONFLICT");
});

class FakeInboundClient implements GoogleCalendarReadClient {
  constructor(private readonly calendarId: string, private readonly page: EventPage) {}
  async getGrantedScopes() { return ["https://www.googleapis.com/auth/calendar.readonly"]; }
  async listCalendarsPage() { return { items: [] }; }
  async listEventsPage() { return this.page; }
  async listIncrementalEventsPage(calendarId: string) {
    assert.equal(calendarId, this.calendarId);
    return this.page;
  }
}
