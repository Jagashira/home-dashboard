import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GOOGLE_CALENDAR_MAPPING, PREVIEW_TTL_MS } from "./mapping";
import { normalizeGoogleEvent, payloadHash } from "./normalize";
import type {
  GoogleCalendarDescriptor,
  GoogleCalendarEvent,
  GoogleCalendarReadClient,
  GoogleImportPreview,
  NormalizedGoogleEvent,
  PreviewCalendarSummary,
  ValidationIssue
} from "./types";

export type GoogleImportDb = PrismaClient;

const WRITABLE_SCOPES = new Set([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendars"
]);

type ResolvedCalendar = GoogleCalendarDescriptor & {
  category: "university" | "work" | "entertainment" | "life";
  sanityBaseline?: number;
};

type StoredItem = {
  calendarId: string;
  eventId: string;
  action: "CREATE" | "UPDATE" | "SKIP_CANCELLED" | "BLOCKED";
  severity: "BLOCKING" | "WARNING" | "INFO";
  payload: NormalizedGoogleEvent;
  hash: string;
  duplicateCandidate: boolean;
};

export async function discoverGoogleCalendars(client: GoogleCalendarReadClient) {
  const scopes = await client.getGrantedScopes();
  const calendars: GoogleCalendarDescriptor[] = [];
  let pageToken: string | undefined;
  do {
    const page = await client.listCalendarsPage(pageToken);
    calendars.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);

  const issues: ValidationIssue[] = [];
  const writable = scopes.filter((scope) => WRITABLE_SCOPES.has(scope));
  if (writable.length) {
    issues.push({
      severity: "BLOCKING",
      code: "WRITABLE_OAUTH_SCOPE",
      message: `現在のOAuth tokenに書き込み可能scopeが含まれます: ${writable.join(", ")}. read-only scopeで再認証してください。`
    });
  }
  if (!scopes.some((scope) => scope.includes("calendar") && scope.endsWith("readonly"))) {
    issues.push({
      severity: "BLOCKING",
      code: "READONLY_SCOPE_NOT_CONFIRMED",
      message: "Google Calendarのread-only scopeを確認できません。"
    });
  }

  const resolved: ResolvedCalendar[] = [];
  for (const spec of GOOGLE_CALENDAR_MAPPING) {
    const matches = calendars.filter((calendar) => calendar.displayName === spec.displayName);
    if (matches.length === 0) {
      issues.push({
        severity: "BLOCKING",
        code: "CALENDAR_NOT_FOUND",
        message: `カレンダー「${spec.displayName}」が見つかりません。IDを推測せず停止します。`,
        calendar: spec.displayName
      });
      if (spec.previousName && calendars.some((calendar) => calendar.displayName === spec.previousName)) {
        issues.push({
          severity: "INFO",
          code: "PREVIOUS_NAME_PRESENT",
          message: `旧名称「${spec.previousName}」は存在しますが、自動対応付けしません。現在名「${spec.displayName}」を正とします。`,
          calendar: spec.displayName
        });
      }
      continue;
    }
    if (matches.length > 1) {
      issues.push({
        severity: "BLOCKING",
        code: "DUPLICATE_CALENDAR_NAME",
        message: `カレンダー「${spec.displayName}」が${matches.length}件あります。IDを推測せず停止します。`,
        calendar: spec.displayName
      });
      continue;
    }
    resolved.push({ ...matches[0], category: spec.category, sanityBaseline: spec.sanityBaseline });
  }
  return { scopes, calendars, resolved, issues };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function equalToken(token: string, expectedHash: string) {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function emptyTotals() {
  return { fetched: 0, create: 0, update: 0, skip: 0, duplicateCandidates: 0, googleWriteCount: 0 as const };
}

async function saveBlockedPreview(
  scopes: string[],
  issues: ValidationIssue[],
  db: GoogleImportDb
): Promise<GoogleImportPreview> {
  const body = { scopes, calendars: [], issues, totals: emptyTotals() };
  const run = await db.googleCalendarSyncRun.create({
    data: {
      mode: "preview",
      status: "blocked",
      finishedAt: new Date(),
      summaryJson: JSON.stringify(body),
      blockingIssueCount: issues.filter((issue) => issue.severity === "BLOCKING").length,
      googleWriteCount: 0
    }
  });
  return { runId: run.id, confirmationToken: null, expiresAt: null, status: "blocked", ...body };
}

export async function createGoogleImportPreview(
  client: GoogleCalendarReadClient,
  db: GoogleImportDb = prisma
): Promise<GoogleImportPreview> {
  const discovery = await discoverGoogleCalendars(client);
  if (discovery.issues.some((issue) => issue.severity === "BLOCKING")) {
    return saveBlockedPreview(discovery.scopes, discovery.issues, db);
  }

  const issues = [...discovery.issues];
  const summaries: PreviewCalendarSummary[] = [];
  const storedItems: StoredItem[] = [];
  const runCalendars: Array<{
    calendar: ResolvedCalendar;
    summary: PreviewCalendarSummary;
    nextSyncToken: string;
  }> = [];

  for (const calendar of discovery.resolved) {
    const rawEvents: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let pages = 0;
    do {
      const page = await client.listEventsPage(calendar.id, pageToken);
      pages += 1;
      rawEvents.push(...page.items);
      pageToken = page.nextPageToken;
      if (!pageToken) nextSyncToken = page.nextSyncToken;
    } while (pageToken);

    if (!nextSyncToken) {
      issues.push({
        severity: "BLOCKING",
        code: "MISSING_FINAL_SYNC_TOKEN",
        message: "最終ページにnextSyncTokenがないため、完全取得を証明できません。",
        calendar: calendar.displayName
      });
    }

    const duplicateIds = new Set<string>();
    const seenIds = new Set<string>();
    const unknownEventTypes: Record<string, number> = {};
    const normalized: NormalizedGoogleEvent[] = [];
    for (const rawEvent of rawEvents) {
      if (rawEvent.id) {
        if (seenIds.has(rawEvent.id)) duplicateIds.add(rawEvent.id);
        seenIds.add(rawEvent.id);
      }
      const result = normalizeGoogleEvent({
        calendarId: calendar.id,
        calendarName: calendar.displayName,
        calendarTimeZone: calendar.timeZone,
        category: calendar.category,
        event: rawEvent
      });
      issues.push(...result.issues);
      if (result.event) {
        normalized.push(result.event);
        if (result.event.googleEventType !== "default") {
          unknownEventTypes[result.event.googleEventType] = (unknownEventTypes[result.event.googleEventType] ?? 0) + 1;
        }
      }
    }
    for (const id of duplicateIds) {
      issues.push({
        severity: "BLOCKING",
        code: "DUPLICATE_EVENT_ID",
        message: "同一カレンダー内でGoogle event IDが重複しました。",
        calendar: calendar.displayName,
        eventId: id
      });
    }

    const imported = await db.organizerEvent.findMany({
      where: { googleCalendarId: calendar.id, googleCalendarEventId: { in: [...seenIds] } },
      select: { googleCalendarEventId: true }
    });
    const importedIds = new Set(imported.map((event) => event.googleCalendarEventId));
    let create = 0;
    let update = 0;
    let skip = 0;
    let duplicateCandidates = 0;

    for (const event of normalized) {
      let action: StoredItem["action"];
      let severity: StoredItem["severity"] = "INFO";
      let duplicateCandidate = false;
      if (event.googleStatus === "cancelled") {
        action = "SKIP_CANCELLED";
        skip += 1;
      } else if (!event.startAt || !event.endAt) {
        action = "BLOCKED";
        severity = "BLOCKING";
        skip += 1;
      } else if (importedIds.has(event.googleCalendarEventId)) {
        action = "UPDATE";
        update += 1;
      } else {
        action = "CREATE";
        create += 1;
        const candidate = await db.organizerEvent.findFirst({
          where: {
            googleCalendarEventId: null,
            title: event.title,
            startAt: new Date(event.startAt),
            endAt: new Date(event.endAt)
          },
          select: { id: true }
        });
        if (candidate) {
          duplicateCandidate = true;
          duplicateCandidates += 1;
          severity = "WARNING";
          issues.push({
            severity: "WARNING",
            code: "LOCAL_DUPLICATE_CANDIDATE",
            message: "同じタイトルと時間のローカルEventがありますが、自動リンクや統合はしません。",
            calendar: calendar.displayName,
            eventId: event.googleCalendarEventId
          });
        }
      }
      storedItems.push({
        calendarId: calendar.id,
        eventId: event.googleCalendarEventId,
        action,
        severity,
        payload: event,
        hash: payloadHash(event),
        duplicateCandidate
      });
    }

    const starts = normalized
      .map((event) => event.startDate ?? event.startAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const ends = normalized
      .map((event) => event.endDateExclusive ?? event.endAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const summary: PreviewCalendarSummary = {
      displayName: calendar.displayName,
      category: calendar.category,
      googleCalendarId: calendar.id,
      accessRole: calendar.accessRole,
      timeZone: calendar.timeZone,
      resourceCount: rawEvents.length,
      normal: normalized.filter((event) => event.googleEventType === "default").length,
      allDay: normalized.filter((event) => event.allDay).length,
      timed: normalized.filter((event) => !event.allDay).length,
      recurringMasters: normalized.filter((event) => event.recurrence.length > 0 && !event.googleRecurringEventId).length,
      recurringExceptions: normalized.filter((event) => Boolean(event.googleRecurringEventId)).length,
      cancelled: normalized.filter((event) => event.googleStatus === "cancelled").length,
      earliest: starts[0] ?? null,
      latest: ends.at(-1) ?? null,
      pages,
      unknownEventTypes,
      create,
      update,
      skip,
      duplicateCandidates,
      sanityBaseline: calendar.sanityBaseline ?? null,
      baselineDifference: calendar.sanityBaseline === undefined ? null : rawEvents.length - calendar.sanityBaseline
    };
    summaries.push(summary);
    runCalendars.push({ calendar, summary, nextSyncToken: nextSyncToken ?? "" });
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === "BLOCKING").length;
  const totals = summaries.reduce(
    (total, summary) => ({
      fetched: total.fetched + summary.resourceCount,
      create: total.create + summary.create,
      update: total.update + summary.update,
      skip: total.skip + summary.skip,
      duplicateCandidates: total.duplicateCandidates + summary.duplicateCandidates,
      googleWriteCount: 0 as const
    }),
    emptyTotals()
  );
  const token = blockingIssueCount ? null : randomBytes(24).toString("base64url");
  const expiresAt = token ? new Date(Date.now() + PREVIEW_TTL_MS) : null;
  const status = blockingIssueCount ? "blocked" : "preview_ready";
  const fingerprint = payloadHash(storedItems.map((item) => [item.calendarId, item.eventId, item.hash]));
  const summaryBody = { scopes: discovery.scopes, calendars: summaries, issues, totals };

  const run = await db.$transaction(async (transaction) => {
    for (const calendar of discovery.resolved) {
      await transaction.googleCalendarMapping.upsert({
        where: { category: calendar.category },
        create: {
          category: calendar.category,
          googleCalendarId: calendar.id,
          displayName: calendar.displayName,
          accessRole: calendar.accessRole,
          timeZone: calendar.timeZone,
          outboundEnabledAt: null
        },
        update: {
          googleCalendarId: calendar.id,
          displayName: calendar.displayName,
          accessRole: calendar.accessRole,
          timeZone: calendar.timeZone,
          enabled: true,
          outboundEnabledAt: null
        }
      });
    }
    const createdRun = await transaction.googleCalendarSyncRun.create({
      data: {
        mode: "preview",
        status,
        finishedAt: new Date(),
        previewExpiresAt: expiresAt,
        confirmationTokenHash: token ? hashToken(token) : null,
        fingerprint,
        summaryJson: JSON.stringify(summaryBody),
        blockingIssueCount,
        googleWriteCount: 0
      }
    });
    for (const entry of runCalendars) {
      await transaction.googleCalendarSyncRunCalendar.create({
        data: {
          runId: createdRun.id,
          googleCalendarId: entry.calendar.id,
          category: entry.calendar.category,
          displayName: entry.calendar.displayName,
          fetched: entry.summary.resourceCount,
          created: entry.summary.create,
          updated: entry.summary.update,
          skipped: entry.summary.skip,
          warnings: issues.filter((issue) => issue.calendar === entry.calendar.displayName && issue.severity === "WARNING").length,
          errors: issues.filter((issue) => issue.calendar === entry.calendar.displayName && issue.severity === "BLOCKING").length,
          pages: entry.summary.pages,
          nextSyncToken: entry.nextSyncToken || null
        }
      });
    }
    for (const item of storedItems) {
      await transaction.googleCalendarImportItem.create({
        data: {
          runId: createdRun.id,
          googleCalendarId: item.calendarId,
          googleEventId: item.eventId,
          action: item.action,
          severity: item.severity,
          payloadJson: JSON.stringify(item.payload),
          payloadHash: item.hash,
          duplicateCandidate: item.duplicateCandidate
        }
      });
    }
    return createdRun;
  });

  return {
    runId: run.id,
    confirmationToken: token,
    expiresAt: expiresAt?.toISOString() ?? null,
    status,
    ...summaryBody
  };
}

export async function applyGoogleImportPreview(
  input: { runId: string; confirmationToken: string },
  db: GoogleImportDb = prisma
) {
  const preview = await db.googleCalendarSyncRun.findUnique({
    where: { id: input.runId },
    include: { calendars: true, items: true }
  });
  if (!preview || preview.mode !== "preview") throw new Error("Preview runが見つかりません。");
  if (preview.status !== "preview_ready" || preview.blockingIssueCount > 0) throw new Error("適用可能なPreviewではありません。");
  if (!preview.previewExpiresAt || preview.previewExpiresAt <= new Date()) {
    await db.googleCalendarSyncRun.update({ where: { id: preview.id }, data: { status: "expired" } });
    throw new Error("Previewの有効期限が切れています。再度Previewしてください。");
  }
  if (!preview.confirmationTokenHash || !equalToken(input.confirmationToken, preview.confirmationTokenHash)) {
    throw new Error("確認トークンが一致しません。");
  }
  if (preview.calendars.some((calendar) => !calendar.nextSyncToken)) {
    throw new Error("全カレンダーの最終syncTokenが揃っていません。");
  }

  const applyRun = await db.googleCalendarSyncRun.create({
    data: {
      mode: "apply",
      status: "running",
      summaryJson: preview.summaryJson,
      blockingIssueCount: 0,
      googleWriteCount: 0
    }
  });
  try {
    const counts = await db.$transaction(async (transaction) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const syncedAt = new Date();
      for (const item of preview.items) {
        if (item.action === "SKIP_CANCELLED" || item.action === "BLOCKED") {
          skipped += 1;
          continue;
        }
        const event = JSON.parse(item.payloadJson) as NormalizedGoogleEvent;
        if (!event.startAt || !event.endAt) throw new Error(`日時のないEventはImportできません: ${item.googleEventId}`);
        const common = {
          title: event.title,
          description: event.description,
          category: event.category,
          startAt: new Date(event.startAt),
          endAt: new Date(event.endAt),
          allDay: event.allDay,
          startDate: event.startDate,
          endDateExclusive: event.endDateExclusive,
          location: event.location,
          googleEtag: event.googleEtag,
          googleUpdatedAt: event.googleUpdatedAt ? new Date(event.googleUpdatedAt) : null,
          lastSyncedAt: syncedAt,
          lastSyncedHash: item.payloadHash,
          eventTimeZone: event.eventTimeZone,
          googleRecurringEventId: event.googleRecurringEventId,
          originalStartTime: event.originalStartTime ? new Date(event.originalStartTime) : null,
          originalStartDate: event.originalStartDate,
          googleEventType: event.googleEventType,
          googleStatus: event.googleStatus,
          recurrenceJson: JSON.stringify(event.recurrence)
        };
        const existing = await transaction.organizerEvent.findUnique({
          where: {
            googleCalendarId_googleCalendarEventId: {
              googleCalendarId: event.googleCalendarId,
              googleCalendarEventId: event.googleCalendarEventId
            }
          },
          select: { id: true }
        });
        await transaction.organizerEvent.upsert({
          where: {
            googleCalendarId_googleCalendarEventId: {
              googleCalendarId: event.googleCalendarId,
              googleCalendarEventId: event.googleCalendarEventId
            }
          },
          create: {
            ...common,
            googleCalendarId: event.googleCalendarId,
            googleCalendarEventId: event.googleCalendarEventId,
            googleSyncStatus: "imported",
            shareWithPartner: false,
            timetreeSyncStatus: "not_requested"
          },
          update: { ...common, googleSyncStatus: "updated" }
        });
        if (existing) updated += 1;
        else created += 1;
      }

      for (const calendar of preview.calendars) {
        await transaction.googleCalendarSyncCursor.upsert({
          where: { googleCalendarId: calendar.googleCalendarId },
          create: {
            googleCalendarId: calendar.googleCalendarId,
            syncToken: calendar.nextSyncToken!,
            lastFullSyncAt: syncedAt
          },
          update: { syncToken: calendar.nextSyncToken!, lastFullSyncAt: syncedAt }
        });
        await transaction.googleCalendarMapping.update({
          where: { googleCalendarId: calendar.googleCalendarId },
          data: { importCompletedAt: syncedAt, outboundEnabledAt: null }
        });
        await transaction.googleCalendarSyncRunCalendar.create({
          data: {
            runId: applyRun.id,
            googleCalendarId: calendar.googleCalendarId,
            category: calendar.category,
            displayName: calendar.displayName,
            fetched: calendar.fetched,
            created: preview.items.filter((item) => item.googleCalendarId === calendar.googleCalendarId && item.action === "CREATE").length,
            updated: preview.items.filter((item) => item.googleCalendarId === calendar.googleCalendarId && item.action === "UPDATE").length,
            skipped: preview.items.filter((item) => item.googleCalendarId === calendar.googleCalendarId && item.action.startsWith("SKIP")).length,
            warnings: calendar.warnings,
            errors: 0,
            pages: calendar.pages,
            nextSyncToken: null
          }
        });
      }
      await transaction.googleCalendarSyncRun.update({
        where: { id: preview.id },
        data: { status: "applied", confirmationTokenHash: null }
      });
      await transaction.googleCalendarSyncRun.update({
        where: { id: applyRun.id },
        data: { status: "applied", finishedAt: syncedAt }
      });
      return { created, updated, skipped, googleWriteCount: 0 as const };
    });
    return { applyRunId: applyRun.id, previewRunId: preview.id, ...counts };
  } catch (error) {
    await db.googleCalendarSyncRun.update({
      where: { id: applyRun.id },
      data: { status: "failed", finishedAt: new Date(), errorMessage: error instanceof Error ? error.message : String(error) }
    });
    throw error;
  }
}

export async function getGoogleImportStatus(db: GoogleImportDb = prisma) {
  const [mappings, cursors, lastRun] = await Promise.all([
    db.googleCalendarMapping.findMany({ orderBy: { category: "asc" } }),
    db.googleCalendarSyncCursor.findMany({ select: { googleCalendarId: true, lastFullSyncAt: true, updatedAt: true } }),
    db.googleCalendarSyncRun.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true, mode: true, status: true, startedAt: true, finishedAt: true, googleWriteCount: true } })
  ]);
  return { mappings, cursors, lastRun, outboundEnabled: mappings.some((mapping) => mapping.outboundEnabledAt !== null) };
}

export async function listGoogleImportRuns(db: GoogleImportDb = prisma) {
  return db.googleCalendarSyncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      mode: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      blockingIssueCount: true,
      googleWriteCount: true,
      errorMessage: true,
      calendars: {
        select: { displayName: true, category: true, fetched: true, created: true, updated: true, skipped: true, warnings: true, errors: true, pages: true }
      }
    }
  });
}
