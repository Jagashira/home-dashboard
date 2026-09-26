import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import {
  applyGoogleImportPreview,
  createGoogleImportPreview,
  discoverGoogleCalendars
} from "../lib/google-calendar/import-service";
import { requireGoogleCalendarAdmin } from "../lib/google-calendar/admin-auth";
import { NextRequest } from "next/server";
import {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  oauthSessionPath,
  sameOAuthRedirectDestination,
  writeRefreshTokenToEnv
} from "../lib/google-calendar/oauth";
import type {
  EventPage,
  GoogleCalendarDescriptor,
  GoogleCalendarReadClient,
  GoogleCalendarEvent
} from "../lib/google-calendar/types";

let directory = "";
let client: PrismaClient;

before(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "google-import-test-"));
  const databasePath = path.join(directory, "organizer.db");
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  for (const migration of [
    "prisma/migrations/20260924000100_add_organizer_system/migration.sql",
    "prisma/migrations/20260925000100_add_google_calendar_import/migration.sql"
  ]) {
    sqlite.exec(readFileSync(path.resolve(process.cwd(), migration), "utf8"));
  }
  sqlite.close();
  client = new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });
  await client.$connect();
});

after(async () => {
  await client.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

const calendars: GoogleCalendarDescriptor[] = [
  { id: "cal-university", displayName: "大学", accessRole: "owner", timeZone: "Asia/Tokyo" },
  { id: "cal-work", displayName: "仕事", accessRole: "owner", timeZone: "Asia/Tokyo" },
  { id: "cal-entertainment", displayName: "娯楽", accessRole: "owner", timeZone: "Asia/Tokyo" },
  { id: "cal-life", displayName: "生活", accessRole: "owner", timeZone: "Asia/Tokyo" },
  { id: "old-work", displayName: "バイト", accessRole: "reader", timeZone: "Asia/Tokyo" },
  { id: "old-life", displayName: "部活", accessRole: "reader", timeZone: "Asia/Tokyo" }
];

const event = (id: string, summary: string, start: string, end: string, extra: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent => ({
  id,
  summary,
  status: "confirmed",
  eventType: "default",
  etag: `etag-${id}`,
  updated: "2026-09-25T00:00:00.000Z",
  start: { dateTime: start, timeZone: "Asia/Tokyo" },
  end: { dateTime: end, timeZone: "Asia/Tokyo" },
  ...extra
});

class FakeReadClient implements GoogleCalendarReadClient {
  readonly calls: Array<{ calendarId: string; pageToken?: string }> = [];
  constructor(
    private readonly calendarItems = calendars,
    private readonly pages: Record<string, EventPage> = {}
  ) {}
  async getGrantedScopes() { return ["https://www.googleapis.com/auth/calendar.readonly"]; }
  async listCalendarsPage() { return { items: this.calendarItems }; }
  async listEventsPage(calendarId: string, pageToken?: string) {
    this.calls.push({ calendarId, pageToken });
    return this.pages[`${calendarId}:${pageToken ?? "first"}`] ?? { items: [], nextSyncToken: `sync-${calendarId}` };
  }
  async listIncrementalEventsPage(calendarId: string, _syncToken: string, pageToken?: string) {
    return this.listEventsPage(calendarId, pageToken);
  }
}

function completeClient() {
  return new FakeReadClient(calendars, {
    "cal-university:first": {
      items: [
        event("u-master", "研究ミーティング", "2026-09-25T09:00:00+09:00", "2026-09-25T10:00:00+09:00", {
          recurrence: ["RRULE:FREQ=WEEKLY", "X-UNKNOWN:KEEP-ME"]
        })
      ],
      nextPageToken: "page-2"
    },
    "cal-university:page-2": {
      items: [
        {
          id: "u-exception",
          summary: "合宿（変更回）",
          status: "confirmed",
          eventType: "default",
          start: { date: "2026-10-01" },
          end: { date: "2026-10-03" },
          recurringEventId: "u-master-all-day",
          originalStartTime: { date: "2026-10-01" }
        },
        { id: "u-cancelled", status: "cancelled", recurringEventId: "u-master", originalStartTime: { dateTime: "2026-10-02T09:00:00+09:00" } },
        event("u-focus", "集中時間", "2026-10-04T12:00:00+09:00", "2026-10-04T13:00:00+09:00", { eventType: "focusTime" })
      ],
      nextSyncToken: "sync-u-final"
    },
    "cal-work:first": { items: [event("w-1", "夜勤", "2026-10-01T22:00:00+09:00", "2026-10-02T06:00:00+09:00")], nextSyncToken: "sync-w" },
    "cal-entertainment:first": { items: [event("e-1", "映画", "2026-10-03T18:00:00+09:00", "2026-10-03T20:00:00+09:00")], nextSyncToken: "sync-e" },
    "cal-life:first": { items: [event("l-1", "病院", "2026-10-05T09:00:00+09:00", "2026-10-05T10:00:00+09:00")], nextSyncToken: "sync-l" }
  });
}

function withDelayedInteractiveTransaction(
  db: PrismaClient,
  delayMs: number,
  captureOptions: (options: { maxWait?: number; timeout?: number } | undefined) => void
) {
  return new Proxy(db, {
    get(target, property) {
      if (property === "$transaction") {
        return (
          operation: (transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<unknown>,
          options?: { maxWait?: number; timeout?: number }
        ) => {
          captureOptions(options);
          return target.$transaction(async (transaction) => {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return operation(transaction);
          }, options);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as PrismaClient;
}

function withFailingMappingUpdateTransaction(db: PrismaClient, failOnUpdate: number) {
  return new Proxy(db, {
    get(target, property) {
      if (property === "$transaction") {
        return (
          operation: (transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<unknown>,
          options?: { maxWait?: number; timeout?: number }
        ) => target.$transaction(async (transaction) => {
          let mappingUpdates = 0;
          const mappingDelegate = new Proxy(transaction.googleCalendarMapping, {
            get(delegate, delegateProperty) {
              if (delegateProperty === "update") {
                return (args: Parameters<typeof delegate.update>[0]) => {
                  mappingUpdates += 1;
                  if (mappingUpdates === failOnUpdate) throw new Error("simulated mapping update failure");
                  return delegate.update(args);
                };
              }
              const value = Reflect.get(delegate, delegateProperty, delegate);
              return typeof value === "function" ? value.bind(delegate) : value;
            }
          });
          const transactionWithFailure = new Proxy(transaction, {
            get(transactionTarget, transactionProperty) {
              if (transactionProperty === "googleCalendarMapping") return mappingDelegate;
              const value = Reflect.get(transactionTarget, transactionProperty, transactionTarget);
              return typeof value === "function" ? value.bind(transactionTarget) : value;
            }
          });
          return operation(transactionWithFailure);
        }, options);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as PrismaClient;
}

test("discovery maps current names and never guesses renamed calendars", async () => {
  const discovery = await discoverGoogleCalendars(new FakeReadClient());
  assert.deepEqual(discovery.resolved.map((item) => [item.displayName, item.category]), [
    ["大学", "university"], ["仕事", "work"], ["娯楽", "entertainment"], ["生活", "life"]
  ]);
  assert.equal(discovery.resolved.some((item) => item.id === "old-work" || item.id === "old-life"), false);

  const missing = await discoverGoogleCalendars(new FakeReadClient(calendars.filter((item) => item.displayName !== "仕事")));
  assert.ok(missing.issues.some((issue) => issue.code === "CALENDAR_NOT_FOUND" && issue.severity === "BLOCKING"));
  assert.ok(missing.issues.some((issue) => issue.code === "PREVIOUS_NAME_PRESENT"));
});

test("preview paginates without importing, then approved apply is idempotent and preserves sharing", async () => {
  const task = await client.organizerTask.create({
    data: { title: "Import対象外", category: "life", status: "inbox", importance: 2, updatedAt: new Date() }
  });
  await client.organizerTimeBlock.create({
    data: {
      taskId: task.id,
      title: task.title,
      startAt: new Date("2026-09-25T00:00:00.000Z"),
      endAt: new Date("2026-09-25T01:00:00.000Z"),
      status: "planned",
      updatedAt: new Date()
    }
  });
  await client.organizerRoutine.create({
    data: { title: "English", category: "life", estimatedMinutes: 20, daysOfWeek: "[1,3,5]", active: true, updatedAt: new Date() }
  });
  const unrelatedCounts = {
    tasks: await client.organizerTask.count(),
    timeBlocks: await client.organizerTimeBlock.count(),
    routines: await client.organizerRoutine.count()
  };
  const localDuplicate = await client.organizerEvent.create({
    data: {
      title: "映画",
      category: "entertainment",
      startAt: new Date("2026-10-03T09:00:00.000Z"),
      endAt: new Date("2026-10-03T11:00:00.000Z"),
      allDay: false,
      shareWithPartner: false,
      updatedAt: new Date()
    }
  });
  const before = await client.organizerEvent.count();
  const fake = completeClient();
  const preview = await createGoogleImportPreview(fake, client);
  assert.equal(preview.status, "preview_ready");
  assert.equal(await client.organizerEvent.count(), before);
  assert.equal(await client.googleCalendarSyncCursor.count(), 0);
  assert.equal(preview.totals.googleWriteCount, 0);
  assert.equal(preview.totals.create, 6);
  assert.equal(preview.totals.skip, 1);
  assert.equal(preview.totals.duplicateCandidates, 1);
  assert.equal(preview.calendars.find((item) => item.category === "university")?.pages, 2);
  assert.ok(preview.issues.some((issue) => issue.code === "UNKNOWN_RECURRENCE_RULE"));
  assert.ok(preview.issues.some((issue) => issue.code === "NON_DEFAULT_EVENT_TYPE"));
  assert.deepEqual(fake.calls.filter((call) => call.calendarId === "cal-university"), [
    { calendarId: "cal-university", pageToken: undefined },
    { calendarId: "cal-university", pageToken: "page-2" }
  ]);

  let transactionOptions: { maxWait?: number; timeout?: number } | undefined;
  const delayedClient = withDelayedInteractiveTransaction(client, 5_100, (options) => {
    transactionOptions = options;
  });
  const applied = await applyGoogleImportPreview(
    { runId: preview.runId, confirmationToken: preview.confirmationToken! },
    delayedClient
  );
  assert.deepEqual(transactionOptions, { maxWait: 10_000, timeout: 60_000 });
  assert.deepEqual({ created: applied.created, updated: applied.updated, skipped: applied.skipped, writes: applied.googleWriteCount }, { created: 6, updated: 0, skipped: 1, writes: 0 });
  assert.equal(await client.googleCalendarSyncCursor.count(), 4);
  assert.equal(await client.organizerTask.count(), 1);
  assert.deepEqual(
    {
      tasks: await client.organizerTask.count(),
      timeBlocks: await client.organizerTimeBlock.count(),
      routines: await client.organizerRoutine.count()
    },
    unrelatedCounts
  );
  assert.equal((await client.organizerTask.findUnique({ where: { id: task.id } }))?.title, "Import対象外");

  const allDay = await client.organizerEvent.findUnique({
    where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-university", googleCalendarEventId: "u-exception" } }
  });
  assert.equal(allDay?.allDay, true);
  assert.equal(allDay?.startDate, "2026-10-01");
  assert.equal(allDay?.endDateExclusive, "2026-10-03");
  assert.equal(allDay?.originalStartDate, "2026-10-01");
  assert.equal(allDay?.category, "university");
  assert.equal(allDay?.shareWithPartner, false);
  assert.equal(await client.organizerEvent.findUnique({ where: { id: localDuplicate.id } }).then((item) => item?.googleCalendarEventId), null);

  const work = await client.organizerEvent.findUnique({
    where: { googleCalendarId_googleCalendarEventId: { googleCalendarId: "cal-work", googleCalendarEventId: "w-1" } }
  });
  assert.equal(work?.category, "work");
  assert.equal(work?.eventTimeZone, "Asia/Tokyo");
  await client.organizerEvent.update({ where: { id: work!.id }, data: { shareWithPartner: true } });

  const secondPreview = await createGoogleImportPreview(completeClient(), client);
  assert.equal(secondPreview.totals.create, 0);
  assert.equal(secondPreview.totals.update, 6);
  const secondApply = await applyGoogleImportPreview({ runId: secondPreview.runId, confirmationToken: secondPreview.confirmationToken! }, client);
  assert.equal(secondApply.updated, 6);
  assert.equal(await client.organizerEvent.count(), before + 6);
  assert.equal((await client.organizerEvent.findUnique({ where: { id: work!.id } }))?.shareWithPartner, true);
  await assert.rejects(() => applyGoogleImportPreview({ runId: preview.runId, confirmationToken: preview.confirmationToken! }, client), /適用可能/);

  const rollbackPreview = await createGoogleImportPreview(completeClient(), client);
  const rollbackMarker = new Date("2020-01-01T00:00:00.000Z");
  await client.googleCalendarSyncCursor.updateMany({
    data: { syncToken: "rollback-sentinel", lastFullSyncAt: rollbackMarker }
  });
  await client.googleCalendarMapping.updateMany({
    data: { importCompletedAt: rollbackMarker, outboundEnabledAt: null }
  });
  const snapshot = async () => JSON.stringify({
    events: await client.organizerEvent.findMany({
      orderBy: { id: "asc" },
      select: { id: true, title: true, googleSyncStatus: true, lastSyncedAt: true, lastSyncedHash: true, updatedAt: true }
    }),
    cursors: await client.googleCalendarSyncCursor.findMany({
      orderBy: { googleCalendarId: "asc" },
      select: { googleCalendarId: true, syncToken: true, lastFullSyncAt: true, updatedAt: true }
    }),
    mappings: await client.googleCalendarMapping.findMany({
      orderBy: { googleCalendarId: "asc" },
      select: { googleCalendarId: true, importCompletedAt: true, outboundEnabledAt: true, updatedAt: true }
    })
  });
  const beforeFailedApply = await snapshot();
  await assert.rejects(
    () => applyGoogleImportPreview(
      { runId: rollbackPreview.runId, confirmationToken: rollbackPreview.confirmationToken! },
      withFailingMappingUpdateTransaction(client, 2)
    ),
    /simulated mapping update failure/
  );
  assert.equal(await snapshot(), beforeFailedApply);
  const rollbackRun = await client.googleCalendarSyncRun.findUnique({ where: { id: rollbackPreview.runId } });
  assert.equal(rollbackRun?.status, "preview_ready");
  assert.ok(rollbackRun?.confirmationTokenHash);
});

test("writable OAuth scope and incomplete final pages block preview", async () => {
  class WritableClient extends FakeReadClient {
    async getGrantedScopes() { return ["https://www.googleapis.com/auth/calendar"]; }
  }
  const scopeBlocked = await createGoogleImportPreview(new WritableClient(), client);
  assert.equal(scopeBlocked.status, "blocked");
  assert.equal(scopeBlocked.confirmationToken, null);
  assert.ok(scopeBlocked.issues.some((issue) => issue.code === "WRITABLE_OAUTH_SCOPE"));

  const missingToken = new FakeReadClient(calendars, {
    "cal-university:first": { items: [] },
    "cal-work:first": { items: [], nextSyncToken: "w" },
    "cal-entertainment:first": { items: [], nextSyncToken: "e" },
    "cal-life:first": { items: [], nextSyncToken: "l" }
  });
  const cursorCountBefore = await client.googleCalendarSyncCursor.count();
  const incomplete = await createGoogleImportPreview(missingToken, client);
  assert.equal(incomplete.status, "blocked");
  assert.equal(await client.googleCalendarSyncCursor.count(), cursorCountBefore);
  assert.ok(incomplete.issues.some((issue) => issue.code === "MISSING_FINAL_SYNC_TOKEN"));
});

test("implementation contains no Google Calendar write calls", () => {
  const source = [
    "lib/google-calendar/read-client.ts",
    "lib/google-calendar/import-service.ts",
    "lib/google-calendar/sync-service.ts",
    "scripts/google-calendar-sync.ts",
    "lib/googleCalendar.ts"
  ].map((file) => readFileSync(path.resolve(process.cwd(), file), "utf8")).join("\n");
  for (const forbidden of ["events.insert", "events.update", "events.patch", "events.delete", "events.move", "calendars.insert", "acl.insert"]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must remain unreachable`);
  }
});

test("Google Calendar management API authentication fails closed", () => {
  const original = process.env.GOOGLE_CALENDAR_ADMIN_SECRET;
  try {
    delete process.env.GOOGLE_CALENDAR_ADMIN_SECRET;
    assert.throws(() => requireGoogleCalendarAdmin(new NextRequest("http://localhost/api")), /not configured/);
    process.env.GOOGLE_CALENDAR_ADMIN_SECRET = "a-long-server-only-secret";
    assert.throws(
      () => requireGoogleCalendarAdmin(new NextRequest("http://localhost/api", { headers: { "x-google-calendar-admin-secret": "wrong" } })),
      /Unauthorized/
    );
    assert.doesNotThrow(() => requireGoogleCalendarAdmin(new NextRequest("http://localhost/api", {
      headers: { "x-google-calendar-admin-secret": "a-long-server-only-secret" }
    })));
  } finally {
    if (original === undefined) delete process.env.GOOGLE_CALENDAR_ADMIN_SECRET;
    else process.env.GOOGLE_CALENDAR_ADMIN_SECRET = original;
  }
});

test("OAuth helper requests read-only scope and updates .env without exposing the token", () => {
  assert.equal(GOOGLE_CALENDAR_READONLY_SCOPE, "https://www.googleapis.com/auth/calendar.readonly");
  assert.equal(
    sameOAuthRedirectDestination("https://developers.google.com/oauthplayground", "https://developers.google.com/oauthplayground/?code=one-time"),
    true
  );
  assert.equal(
    sameOAuthRedirectDestination("https://developers.google.com/oauthplayground", "https://example.com/oauthplayground/?code=one-time"),
    false
  );
  const oauthDirectory = mkdtempSync(path.join(tmpdir(), "google-oauth-test-"));
  try {
    const envPath = path.join(oauthDirectory, ".env");
    writeFileSync(envPath, "GOOGLE_CLIENT_ID=test\nGOOGLE_REFRESH_TOKEN=old-token\nOTHER=value\n");
    writeRefreshTokenToEnv("new-token", envPath);
    const updated = readFileSync(envPath, "utf8");
    assert.match(updated, /^GOOGLE_REFRESH_TOKEN=new-token$/m);
    assert.equal(updated.includes("old-token"), false);
    assert.equal(oauthSessionPath(oauthDirectory), path.join(oauthDirectory, "data", "google-calendar", "oauth-session.json"));
  } finally {
    rmSync(oauthDirectory, { recursive: true, force: true });
  }
});
