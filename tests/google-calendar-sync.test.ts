import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { GoogleSyncTokenExpiredError } from "../lib/google-calendar/errors";
import { payloadHash, normalizeGoogleEvent } from "../lib/google-calendar/normalize";
import {
  runGoogleCalendarIncrementalSync
} from "../lib/google-calendar/sync-service";
import type {
  EventPage,
  GoogleCalendarDescriptor,
  GoogleCalendarEvent,
  GoogleCalendarReadClient
} from "../lib/google-calendar/types";

let directory = "";
let db: PrismaClient;

before(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "google-sync-test-"));
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
  await db.googleCalendarSyncCursor.deleteMany();
  await db.googleCalendarMapping.deleteMany();
  await db.organizerEvent.deleteMany();
});

const timedEvent = (
  id: string,
  summary: string,
  extra: Partial<GoogleCalendarEvent> = {}
): GoogleCalendarEvent => ({
  id,
  summary,
  status: "confirmed",
  eventType: "default",
  etag: `etag-${id}`,
  updated: "2026-09-26T00:00:00.000Z",
  start: { dateTime: "2026-10-01T09:00:00+09:00", timeZone: "Asia/Tokyo" },
  end: { dateTime: "2026-10-01T10:00:00+09:00", timeZone: "Asia/Tokyo" },
  ...extra
});

class SyncClient implements GoogleCalendarReadClient {
  readonly incrementalCalls: Array<{ calendarId: string; syncToken: string; pageToken?: string }> = [];
  readonly fullCalls: Array<{ calendarId: string; pageToken?: string }> = [];

  constructor(
    private readonly incrementalPages: Record<string, EventPage> = {},
    private readonly fullPages: Record<string, EventPage> = {},
    private readonly expiredCalendars = new Set<string>(),
    private readonly failure?: { calendarId: string; pageToken?: string },
    private readonly scopes = ["https://www.googleapis.com/auth/calendar.readonly"]
  ) {}

  async getGrantedScopes() { return this.scopes; }
  async listCalendarsPage(): Promise<{ items: GoogleCalendarDescriptor[] }> { return { items: [] }; }
  async listEventsPage(calendarId: string, pageToken?: string) {
    this.fullCalls.push({ calendarId, pageToken });
    return this.fullPages[`${calendarId}:${pageToken ?? "first"}`] ?? { items: [], nextSyncToken: `full-${calendarId}` };
  }
  async listIncrementalEventsPage(calendarId: string, syncToken: string, pageToken?: string) {
    this.incrementalCalls.push({ calendarId, syncToken, pageToken });
    if (this.expiredCalendars.has(calendarId)) throw new GoogleSyncTokenExpiredError();
    if (this.failure?.calendarId === calendarId && this.failure.pageToken === pageToken) throw new Error("simulated API failure");
    return this.incrementalPages[`${calendarId}:${pageToken ?? "first"}`] ?? { items: [], nextSyncToken: `next-${calendarId}` };
  }
}

async function seedCalendar(
  googleCalendarId: string,
  category: "university" | "work" | "entertainment" | "life",
  displayName: string
) {
  const importedAt = new Date("2026-09-25T00:00:00.000Z");
  await db.googleCalendarMapping.create({
    data: {
      googleCalendarId,
      category,
      displayName,
      accessRole: "owner",
      timeZone: "Asia/Tokyo",
      enabled: true,
      importCompletedAt: importedAt,
      outboundEnabledAt: null
    }
  });
  await db.googleCalendarSyncCursor.create({
    data: { googleCalendarId, syncToken: `old-${googleCalendarId}`, lastFullSyncAt: importedAt }
  });
}

async function seedGoogleEvent(
  calendarId: string,
  eventId: string,
  title: string,
  extra: { shareWithPartner?: boolean; timetreeEventId?: string; timetreeSyncStatus?: string } = {}
) {
  return db.organizerEvent.create({
    data: {
      title,
      category: calendarId === "cal-life" ? "life" : "work",
      startAt: new Date("2026-10-01T00:00:00.000Z"),
      endAt: new Date("2026-10-01T01:00:00.000Z"),
      googleCalendarId: calendarId,
      googleCalendarEventId: eventId,
      googleSyncStatus: "imported",
      lastSyncedHash: "old-hash",
      shareWithPartner: extra.shareWithPartner ?? false,
      timetreeEventId: extra.timetreeEventId,
      timetreeSyncStatus: extra.timetreeSyncStatus ?? "not_requested"
    }
  });
}

function withFailingCursorUpdate(client: PrismaClient) {
  return new Proxy(client, {
    get(target, property) {
      if (property === "$transaction") {
        return (
          operation: (transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<unknown>,
          options?: { maxWait?: number; timeout?: number }
        ) => target.$transaction(async (transaction) => {
          const cursorDelegate = new Proxy(transaction.googleCalendarSyncCursor, {
            get(delegate, delegateProperty) {
              if (delegateProperty === "update") return () => { throw new Error("simulated cursor failure"); };
              const value = Reflect.get(delegate, delegateProperty, delegate);
              return typeof value === "function" ? value.bind(delegate) : value;
            }
          });
          const failingTransaction = new Proxy(transaction, {
            get(transactionTarget, transactionProperty) {
              if (transactionProperty === "googleCalendarSyncCursor") return cursorDelegate;
              const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
              return typeof value === "function" ? value.bind(transactionTarget) : value;
            }
          });
          return operation(failingTransaction);
        }, options);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as PrismaClient;
}

test("incremental sync creates, updates and deletes only matching Google events", async () => {
  await seedCalendar("cal-work", "work", "仕事");
  await seedCalendar("cal-life", "life", "生活");
  const updated = await seedGoogleEvent("cal-work", "update", "更新前", {
    shareWithPartner: true,
    timetreeEventId: "tt-keep",
    timetreeSyncStatus: "synced"
  });
  await seedGoogleEvent("cal-work", "delete", "削除対象");
  await seedGoogleEvent("cal-work", "cancelled-exception", "取り消し例外");
  const otherCalendar = await seedGoogleEvent("cal-life", "same-id", "別カレンダー");
  const local = await db.organizerEvent.create({
    data: {
      title: "ローカル予定",
      category: "work",
      startAt: new Date("2026-10-01T02:00:00.000Z"),
      endAt: new Date("2026-10-01T03:00:00.000Z")
    }
  });

  const client = new SyncClient({
    "cal-work:first": {
      items: [
        timedEvent("update", "更新後"),
        {
          id: "all-day",
          summary: "複数日",
          status: "confirmed",
          eventType: "default",
          start: { date: "2026-10-02" },
          end: { date: "2026-10-05" }
        },
        timedEvent("master", "繰り返し", { recurrence: ["RRULE:FREQ=WEEKLY"] })
      ],
      nextPageToken: "p2"
    },
    "cal-work:p2": {
      items: [
        timedEvent("exception", "変更回", {
          recurringEventId: "master",
          originalStartTime: { dateTime: "2026-10-08T09:00:00+09:00" }
        }),
        { id: "delete", status: "cancelled" },
        {
          id: "cancelled-exception",
          status: "cancelled",
          recurringEventId: "master",
          originalStartTime: { dateTime: "2026-10-15T09:00:00+09:00" }
        },
        { id: "missing-cancelled", status: "cancelled" }
      ],
      nextSyncToken: "next-work"
    },
    "cal-life:first": { items: [], nextSyncToken: "next-life" }
  });

  const result = await runGoogleCalendarIncrementalSync(client, {}, db);
  const work = result.calendars.find((calendar) => calendar.googleCalendarId === "cal-work")!;
  assert.deepEqual(
    { fetched: work.fetched, created: work.created, updated: work.updated, deleted: work.deleted, skipped: work.skipped, pages: work.pages },
    { fetched: 7, created: 3, updated: 1, deleted: 2, skipped: 1, pages: 2 }
  );
  assert.deepEqual(client.incrementalCalls.filter((call) => call.calendarId === "cal-work"), [
    { calendarId: "cal-work", syncToken: "old-cal-work", pageToken: undefined },
    { calendarId: "cal-work", syncToken: "old-cal-work", pageToken: "p2" }
  ]);
  const preserved = await db.organizerEvent.findUnique({ where: { id: updated.id } });
  assert.equal(preserved?.title, "更新後");
  assert.equal(preserved?.shareWithPartner, true);
  assert.equal(preserved?.timetreeEventId, "tt-keep");
  assert.equal(preserved?.timetreeSyncStatus, "synced");
  assert.equal(await db.organizerEvent.findUnique({ where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "delete" } } }), null);
  assert.equal(await db.organizerEvent.findUnique({ where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "cancelled-exception" } } }), null);
  assert.ok(await db.organizerEvent.findUnique({ where: { id: local.id } }));
  assert.ok(await db.organizerEvent.findUnique({ where: { id: otherCalendar.id } }));

  const allDay = await db.organizerEvent.findUnique({
    where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "all-day" } }
  });
  assert.equal(allDay?.allDay, true);
  assert.equal(allDay?.startDate, "2026-10-02");
  assert.equal(allDay?.endDateExclusive, "2026-10-05");
  const master = await db.organizerEvent.findUnique({
    where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "master" } }
  });
  assert.equal(master?.recurrenceJson, '["RRULE:FREQ=WEEKLY"]');
  const exception = await db.organizerEvent.findUnique({
    where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "exception" } }
  });
  assert.equal(exception?.googleRecurringEventId, "master");
  assert.equal(exception?.originalStartTime?.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal((await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } }))?.syncToken, "next-work");
  assert.equal(result.totals.googleWriteCount, 0);
  const run = await db.googleCalendarSyncRun.findUnique({ where: { id: result.runId! } });
  assert.equal(run?.status, "applied");
  assert.equal(JSON.parse(run!.summaryJson).totals.deleted, 2);
});

test("zero changes advances only the sync token and dry-run changes nothing", async () => {
  await seedCalendar("cal-work", "work", "仕事");
  const empty = new SyncClient({ "cal-work:first": { items: [], nextSyncToken: "next-empty" } });
  const result = await runGoogleCalendarIncrementalSync(empty, {}, db);
  assert.deepEqual(result.totals, { fetched: 0, created: 0, updated: 0, deleted: 0, skipped: 0, recoveries: 0, googleWriteCount: 0 });
  assert.equal((await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } }))?.syncToken, "next-empty");

  const runsBefore = await db.googleCalendarSyncRun.count();
  const dryClient = new SyncClient({ "cal-work:first": { items: [timedEvent("dry-new", "Dry run")], nextSyncToken: "dry-token" } });
  const dry = await runGoogleCalendarIncrementalSync(dryClient, { dryRun: true }, db);
  assert.equal(dry.runId, null);
  assert.equal(dry.totals.created, 1);
  assert.equal(await db.organizerEvent.count(), 0);
  assert.equal(await db.googleCalendarSyncRun.count(), runsBefore);
  assert.equal((await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } }))?.syncToken, "next-empty");
});

test("API and transaction failures never advance the cursor or partially apply the current calendar", async () => {
  await seedCalendar("cal-work", "work", "仕事");
  const apiFailure = new SyncClient(
    { "cal-work:first": { items: [timedEvent("first-page", "First")], nextPageToken: "p2" } },
    {},
    new Set(),
    { calendarId: "cal-work", pageToken: "p2" }
  );
  await assert.rejects(() => runGoogleCalendarIncrementalSync(apiFailure, {}, db), /simulated API failure/);
  assert.equal(await db.organizerEvent.count(), 0);
  assert.equal((await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } }))?.syncToken, "old-cal-work");

  const transactionClient = new SyncClient({
    "cal-work:first": { items: [timedEvent("transaction", "Transaction")], nextSyncToken: "next-transaction" }
  });
  await assert.rejects(
    () => runGoogleCalendarIncrementalSync(transactionClient, {}, withFailingCursorUpdate(db)),
    /simulated cursor failure/
  );
  assert.equal(await db.organizerEvent.count(), 0);
  assert.equal((await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } }))?.syncToken, "old-cal-work");
  const failedRun = await db.googleCalendarSyncRun.findFirst({ orderBy: { startedAt: "desc" }, include: { calendars: true } });
  assert.equal(failedRun?.status, "failed");
  assert.equal(failedRun?.calendars[0]?.errors, 1);
});

test("410 recovery fully reconciles one calendar without deleting local or other-calendar events", async () => {
  await seedCalendar("cal-work", "work", "仕事");
  await seedCalendar("cal-life", "life", "生活");
  const keep = await seedGoogleEvent("cal-work", "keep", "Keep old");
  await seedGoogleEvent("cal-work", "stale", "Stale");
  const other = await seedGoogleEvent("cal-life", "other", "Other");
  const local = await db.organizerEvent.create({
    data: {
      title: "Local",
      category: "work",
      startAt: new Date("2026-10-01T02:00:00.000Z"),
      endAt: new Date("2026-10-01T03:00:00.000Z")
    }
  });
  const oldLastFullSyncAt = (await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } }))!.lastFullSyncAt!;
  const client = new SyncClient(
    { "cal-life:first": { items: [], nextSyncToken: "next-life" } },
    {
      "cal-work:first": {
        items: [timedEvent("keep", "Keep updated"), timedEvent("recovered-new", "Recovered new"), { id: "cancelled-instance", status: "cancelled", recurringEventId: "master", originalStartTime: { date: "2026-10-10" } }],
        nextSyncToken: "recovered-token"
      }
    },
    new Set(["cal-work"])
  );

  const result = await runGoogleCalendarIncrementalSync(client, {}, db);
  const work = result.calendars.find((calendar) => calendar.googleCalendarId === "cal-work")!;
  assert.equal(work.fullSyncRecovery, true);
  assert.equal(work.created, 1);
  assert.equal(work.updated, 1);
  assert.equal(work.deleted, 1);
  assert.equal(work.skipped, 1);
  assert.equal((await db.organizerEvent.findUnique({ where: { id: keep.id } }))?.title, "Keep updated");
  assert.equal(await db.organizerEvent.findUnique({ where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "stale" } } }), null);
  assert.ok(await db.organizerEvent.findUnique({ where: { id: other.id } }));
  assert.ok(await db.organizerEvent.findUnique({ where: { id: local.id } }));
  const cursor = await db.googleCalendarSyncCursor.findUnique({ where: { googleCalendarId: "cal-work" } });
  assert.equal(cursor?.syncToken, "recovered-token");
  assert.ok(cursor!.lastFullSyncAt! > oldLastFullSyncAt);
  assert.equal(client.fullCalls.length, 1);
});

test("writable scope fails closed before creating a sync run", async () => {
  await seedCalendar("cal-work", "work", "仕事");
  const client = new SyncClient({}, {}, new Set(), undefined, ["https://www.googleapis.com/auth/calendar"]);
  await assert.rejects(() => runGoogleCalendarIncrementalSync(client, {}, db), /Writable Google Calendar OAuth scope/);
  assert.equal(await db.googleCalendarSyncRun.count(), 0);
});

test("normalization hash used by sync includes recurring and all-day metadata", () => {
  const normalized = normalizeGoogleEvent({
    calendarId: "cal-work",
    calendarName: "仕事",
    calendarTimeZone: "Asia/Tokyo",
    category: "work",
    event: timedEvent("hash", "Hash", { recurrence: ["RRULE:FREQ=DAILY"] })
  }).event!;
  assert.equal(payloadHash(normalized).length, 64);
});
