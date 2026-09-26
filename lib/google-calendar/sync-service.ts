import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ORGANIZER_CATEGORIES, type OrganizerCategory } from "@/lib/organizer/constants";
import { GoogleSyncTokenExpiredError } from "./errors";
import { normalizeGoogleEvent, payloadHash } from "./normalize";
import type { GoogleCalendarEvent, GoogleCalendarReadClient, NormalizedGoogleEvent } from "./types";

export type GoogleCalendarSyncDb = PrismaClient;

type Mapping = {
  googleCalendarId: string;
  displayName: string;
  category: string;
  timeZone: string | null;
};

type FetchedCalendar = {
  events: GoogleCalendarEvent[];
  nextSyncToken: string;
  pages: number;
  fullSyncRecovery: boolean;
};

export type GoogleCalendarSyncCalendarResult = {
  googleCalendarId: string;
  displayName: string;
  category: OrganizerCategory;
  fetched: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  pages: number;
  fullSyncRecovery: boolean;
  warnings: string[];
};

export type GoogleCalendarSyncResult = {
  runId: string | null;
  dryRun: boolean;
  calendars: GoogleCalendarSyncCalendarResult[];
  totals: {
    fetched: number;
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    recoveries: number;
    googleWriteCount: 0;
  };
};

const WRITABLE_SCOPES = new Set([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendars"
]);

function categoryOf(mapping: Mapping): OrganizerCategory {
  if (!ORGANIZER_CATEGORIES.includes(mapping.category as OrganizerCategory)) {
    throw new Error(`Unsupported Organizer category: ${mapping.category}`);
  }
  return mapping.category as OrganizerCategory;
}

async function assertReadOnlyAccess(client: GoogleCalendarReadClient) {
  const scopes = await client.getGrantedScopes();
  const writable = scopes.filter((scope) => WRITABLE_SCOPES.has(scope));
  if (writable.length) throw new Error(`Writable Google Calendar OAuth scope is not allowed: ${writable.join(", ")}`);
  if (!scopes.includes("https://www.googleapis.com/auth/calendar.readonly")) {
    throw new Error("Google Calendar readonly OAuth scope could not be confirmed");
  }
}

async function collectPages(
  getPage: (pageToken?: string) => ReturnType<GoogleCalendarReadClient["listEventsPage"]>
): Promise<Omit<FetchedCalendar, "fullSyncRecovery">> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let pages = 0;
  do {
    const page = await getPage(pageToken);
    pages += 1;
    events.push(...page.items);
    pageToken = page.nextPageToken;
    if (!pageToken) nextSyncToken = page.nextSyncToken;
  } while (pageToken);
  if (!nextSyncToken) throw new Error("Google Calendar final page did not contain nextSyncToken");
  return { events, nextSyncToken, pages };
}

async function fetchCalendarChanges(
  client: GoogleCalendarReadClient,
  mapping: Mapping,
  syncToken: string
): Promise<FetchedCalendar> {
  try {
    const fetched = await collectPages((pageToken) =>
      client.listIncrementalEventsPage(mapping.googleCalendarId, syncToken, pageToken)
    );
    return { ...fetched, fullSyncRecovery: false };
  } catch (error) {
    if (!(error instanceof GoogleSyncTokenExpiredError)) throw error;
    const fetched = await collectPages((pageToken) => client.listEventsPage(mapping.googleCalendarId, pageToken));
    return { ...fetched, fullSyncRecovery: true };
  }
}

function normalizeChanges(mapping: Mapping, rawEvents: GoogleCalendarEvent[]) {
  const category = categoryOf(mapping);
  const active: Array<{ event: NormalizedGoogleEvent; hash: string }> = [];
  const cancelledIds = new Set<string>();
  const seenIds = new Set<string>();
  const warnings: string[] = [];

  for (const rawEvent of rawEvents) {
    const eventId = rawEvent.id?.trim();
    if (!eventId) throw new Error(`${mapping.displayName}: Google event ID is missing`);
    if (seenIds.has(eventId)) throw new Error(`${mapping.displayName}: duplicate Google event ID: ${eventId}`);
    seenIds.add(eventId);

    if ((rawEvent.status ?? "confirmed") === "cancelled") {
      cancelledIds.add(eventId);
      continue;
    }

    const normalized = normalizeGoogleEvent({
      calendarId: mapping.googleCalendarId,
      calendarName: mapping.displayName,
      calendarTimeZone: mapping.timeZone,
      category,
      event: rawEvent
    });
    const blocking = normalized.issues.filter((issue) => issue.severity === "BLOCKING");
    if (blocking.length || !normalized.event?.startAt || !normalized.event.endAt) {
      throw new Error(`${mapping.displayName}/${eventId}: ${blocking.map((issue) => issue.message).join("; ") || "valid start/end is required"}`);
    }
    warnings.push(...normalized.issues.filter((issue) => issue.severity === "WARNING").map((issue) => `${eventId}: ${issue.code}`));
    active.push({ event: normalized.event, hash: payloadHash(normalized.event) });
  }

  return { active, cancelledIds, warnings };
}

function googleFields(event: NormalizedGoogleEvent, hash: string, syncedAt: Date) {
  return {
    title: event.title,
    description: event.description,
    category: event.category,
    startAt: new Date(event.startAt!),
    endAt: new Date(event.endAt!),
    allDay: event.allDay,
    startDate: event.startDate,
    endDateExclusive: event.endDateExclusive,
    location: event.location,
    googleEtag: event.googleEtag,
    googleUpdatedAt: event.googleUpdatedAt ? new Date(event.googleUpdatedAt) : null,
    lastSyncedAt: syncedAt,
    lastSyncedHash: hash,
    eventTimeZone: event.eventTimeZone,
    googleRecurringEventId: event.googleRecurringEventId,
    originalStartTime: event.originalStartTime ? new Date(event.originalStartTime) : null,
    originalStartDate: event.originalStartDate,
    googleEventType: event.googleEventType,
    googleStatus: event.googleStatus,
    recurrenceJson: JSON.stringify(event.recurrence)
  };
}

type DbExecutor = PrismaClient | Prisma.TransactionClient;

async function applyCalendarChanges(
  db: DbExecutor,
  mapping: Mapping,
  fetched: FetchedCalendar,
  dryRun: boolean
): Promise<GoogleCalendarSyncCalendarResult> {
  const normalized = normalizeChanges(mapping, fetched.events);
  const existing = await db.organizerEvent.findMany({
    where: { googleCalendarId: mapping.googleCalendarId, googleCalendarEventId: { not: null } },
    select: { googleCalendarEventId: true, lastSyncedHash: true }
  });
  const existingById = new Map(existing.map((event) => [event.googleCalendarEventId!, event]));
  const activeIds = new Set(normalized.active.map(({ event }) => event.googleCalendarEventId));
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  const syncedAt = new Date();

  for (const item of normalized.active) {
    const current = existingById.get(item.event.googleCalendarEventId);
    if (current?.lastSyncedHash === item.hash) {
      skipped += 1;
      continue;
    }
    if (current) updated += 1;
    else created += 1;
    if (dryRun) continue;
    const common = googleFields(item.event, item.hash, syncedAt);
    await db.organizerEvent.upsert({
      where: {
        googleCalendarId_googleCalendarEventId: {
          googleCalendarId: mapping.googleCalendarId,
          googleCalendarEventId: item.event.googleCalendarEventId
        }
      },
      create: {
        ...common,
        googleCalendarId: mapping.googleCalendarId,
        googleCalendarEventId: item.event.googleCalendarEventId,
        googleSyncStatus: "imported",
        shareWithPartner: false,
        timetreeSyncStatus: "not_requested"
      },
      update: { ...common, googleSyncStatus: "updated" }
    });
  }

  const idsToDelete = fetched.fullSyncRecovery
    ? existing.map((event) => event.googleCalendarEventId!).filter((id) => !activeIds.has(id))
    : [...normalized.cancelledIds].filter((id) => existingById.has(id));
  deleted = idsToDelete.length;
  skipped += [...normalized.cancelledIds].filter((id) => !existingById.has(id)).length;

  if (!dryRun && idsToDelete.length) {
    await db.organizerEvent.deleteMany({
      where: {
        googleCalendarId: mapping.googleCalendarId,
        googleCalendarEventId: { in: idsToDelete }
      }
    });
  }

  return {
    googleCalendarId: mapping.googleCalendarId,
    displayName: mapping.displayName,
    category: categoryOf(mapping),
    fetched: fetched.events.length,
    created,
    updated,
    deleted,
    skipped,
    pages: fetched.pages,
    fullSyncRecovery: fetched.fullSyncRecovery,
    warnings: normalized.warnings
  };
}

function totals(calendars: GoogleCalendarSyncCalendarResult[]) {
  return calendars.reduce(
    (total, calendar) => ({
      fetched: total.fetched + calendar.fetched,
      created: total.created + calendar.created,
      updated: total.updated + calendar.updated,
      deleted: total.deleted + calendar.deleted,
      skipped: total.skipped + calendar.skipped,
      recoveries: total.recoveries + Number(calendar.fullSyncRecovery),
      googleWriteCount: 0 as const
    }),
    { fetched: 0, created: 0, updated: 0, deleted: 0, skipped: 0, recoveries: 0, googleWriteCount: 0 as const }
  );
}

function summary(calendars: GoogleCalendarSyncCalendarResult[], dryRun: boolean) {
  return { operation: "incremental_sync", dryRun, calendars, totals: totals(calendars), googleWriteCount: 0 as const };
}

export async function getGoogleCalendarSyncStatus(db: GoogleCalendarSyncDb = prisma) {
  const [mappings, cursors, lastRun] = await Promise.all([
    db.googleCalendarMapping.findMany({ where: { enabled: true }, orderBy: { category: "asc" } }),
    db.googleCalendarSyncCursor.findMany({ orderBy: { googleCalendarId: "asc" } }),
    db.googleCalendarSyncRun.findFirst({
      where: { summaryJson: { contains: "incremental_sync" } },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, startedAt: true, finishedAt: true, errorMessage: true, summaryJson: true }
    })
  ]);
  const cursorByCalendar = new Map(cursors.map((cursor) => [cursor.googleCalendarId, cursor]));
  return {
    calendars: mappings.map((mapping) => ({
      category: mapping.category,
      displayName: mapping.displayName,
      googleCalendarId: mapping.googleCalendarId,
      importCompletedAt: mapping.importCompletedAt,
      ready: Boolean(mapping.importCompletedAt && cursorByCalendar.has(mapping.googleCalendarId)),
      cursorUpdatedAt: cursorByCalendar.get(mapping.googleCalendarId)?.updatedAt ?? null,
      lastFullSyncAt: cursorByCalendar.get(mapping.googleCalendarId)?.lastFullSyncAt ?? null
    })),
    lastRun,
    outboundEnabled: mappings.some((mapping) => mapping.outboundEnabledAt !== null)
  };
}

export async function runGoogleCalendarIncrementalSync(
  client: GoogleCalendarReadClient,
  options: { dryRun?: boolean } = {},
  db: GoogleCalendarSyncDb = prisma
): Promise<GoogleCalendarSyncResult> {
  const dryRun = options.dryRun ?? false;
  await assertReadOnlyAccess(client);
  const mappings = await db.googleCalendarMapping.findMany({
    where: { enabled: true, importCompletedAt: { not: null } },
    orderBy: { category: "asc" }
  });
  if (!mappings.length) throw new Error("No enabled, imported Google Calendar mappings were found");
  const cursors = await db.googleCalendarSyncCursor.findMany({
    where: { googleCalendarId: { in: mappings.map((mapping) => mapping.googleCalendarId) } }
  });
  const cursorByCalendar = new Map(cursors.map((cursor) => [cursor.googleCalendarId, cursor]));
  for (const mapping of mappings) {
    if (!cursorByCalendar.has(mapping.googleCalendarId)) {
      throw new Error(`Sync cursor is missing for ${mapping.displayName}`);
    }
  }

  const run = dryRun ? null : await db.googleCalendarSyncRun.create({
    data: {
      mode: "apply",
      status: "running",
      summaryJson: JSON.stringify(summary([], false)),
      blockingIssueCount: 0,
      googleWriteCount: 0
    }
  });
  const results: GoogleCalendarSyncCalendarResult[] = [];

  try {
    for (const mapping of mappings) {
      const cursor = cursorByCalendar.get(mapping.googleCalendarId)!;
      let fetched: FetchedCalendar;
      try {
        fetched = await fetchCalendarChanges(client, mapping, cursor.syncToken);
      } catch (error) {
        if (run) {
          await db.googleCalendarSyncRunCalendar.create({
            data: {
              runId: run.id,
              googleCalendarId: mapping.googleCalendarId,
              category: mapping.category,
              displayName: mapping.displayName,
              errors: 1
            }
          });
        }
        throw error;
      }

      if (dryRun) {
        results.push(await applyCalendarChanges(db, mapping, fetched, true));
        continue;
      }

      const runId = run!.id;
      let result: GoogleCalendarSyncCalendarResult;
      try {
        result = await db.$transaction(async (transaction) => {
          const applied = await applyCalendarChanges(transaction, mapping, fetched, false);
          await transaction.googleCalendarSyncCursor.update({
            where: { googleCalendarId: mapping.googleCalendarId },
            data: {
              syncToken: fetched.nextSyncToken,
              ...(fetched.fullSyncRecovery ? { lastFullSyncAt: new Date() } : {})
            }
          });
          await transaction.googleCalendarSyncRunCalendar.create({
            data: {
              runId,
              googleCalendarId: mapping.googleCalendarId,
              category: mapping.category,
              displayName: mapping.displayName,
              fetched: applied.fetched,
              created: applied.created,
              updated: applied.updated,
              skipped: applied.skipped,
              warnings: applied.warnings.length,
              errors: 0,
              pages: applied.pages,
              nextSyncToken: null
            }
          });
          return applied;
        }, { maxWait: 10_000, timeout: 60_000 });
      } catch (error) {
        await db.googleCalendarSyncRunCalendar.create({
          data: {
            runId,
            googleCalendarId: mapping.googleCalendarId,
            category: mapping.category,
            displayName: mapping.displayName,
            fetched: fetched.events.length,
            errors: 1,
            pages: fetched.pages
          }
        });
        throw error;
      }
      results.push(result);
    }

    const result = { runId: run?.id ?? null, dryRun, calendars: results, totals: totals(results) };
    if (run) {
      await db.googleCalendarSyncRun.update({
        where: { id: run.id },
        data: { status: "applied", finishedAt: new Date(), summaryJson: JSON.stringify(summary(results, false)) }
      });
    }
    return result;
  } catch (error) {
    if (run) {
      await db.googleCalendarSyncRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
          summaryJson: JSON.stringify(summary(results, false))
        }
      });
    }
    throw error;
  }
}
