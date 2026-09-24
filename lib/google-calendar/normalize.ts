import { createHash } from "node:crypto";
import { isDateOnly } from "@/lib/organizer/dates";
import type { OrganizerCategory } from "@/lib/organizer/constants";
import type { GoogleCalendarEvent, NormalizedGoogleEvent, ValidationIssue } from "./types";

const SUPPORTED_RECURRENCE_PREFIXES = ["RRULE:", "RDATE:", "EXDATE:", "EXRULE:"];

function validInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function tokyoMidnight(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeGoogleEvent(input: {
  calendarId: string;
  calendarName: string;
  calendarTimeZone: string | null;
  category: OrganizerCategory;
  event: GoogleCalendarEvent;
}): { event: NormalizedGoogleEvent | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const raw = input.event;
  const eventId = raw.id?.trim();
  if (!eventId) {
    issues.push({
      severity: "BLOCKING",
      code: "MISSING_EVENT_ID",
      message: "Google event IDがありません。安全な冪等Importができません。",
      calendar: input.calendarName
    });
    return { event: null, issues };
  }

  const status = raw.status ?? "confirmed";
  const eventType = raw.eventType ?? "default";
  if (eventType !== "default") {
    issues.push({
      severity: "WARNING",
      code: "NON_DEFAULT_EVENT_TYPE",
      message: `eventType=${eventType} をそのまま保持します。`,
      calendar: input.calendarName,
      eventId
    });
  }

  const recurrence = raw.recurrence ?? [];
  for (const rule of recurrence) {
    if (!SUPPORTED_RECURRENCE_PREFIXES.some((prefix) => rule.startsWith(prefix))) {
      issues.push({
        severity: "WARNING",
        code: "UNKNOWN_RECURRENCE_RULE",
        message: `未解釈の繰り返しルールを原文のまま保持します: ${rule.slice(0, 80)}`,
        calendar: input.calendarName,
        eventId
      });
    }
  }

  const allDay = Boolean(raw.start?.date || raw.end?.date);
  let startAt: string | null = null;
  let endAt: string | null = null;
  let startDate: string | null = null;
  let endDateExclusive: string | null = null;

  if (allDay) {
    startDate = raw.start?.date ?? null;
    endDateExclusive = raw.end?.date ?? null;
    if (!startDate || !endDateExclusive || !isDateOnly(startDate) || !isDateOnly(endDateExclusive)) {
      issues.push({
        severity: status === "cancelled" ? "WARNING" : "BLOCKING",
        code: "INVALID_ALL_DAY_RANGE",
        message: "終日予定のstart.date/end.date（終了日は排他的）が不正です。",
        calendar: input.calendarName,
        eventId
      });
    } else {
      startAt = tokyoMidnight(startDate);
      endAt = tokyoMidnight(endDateExclusive);
    }
  } else {
    startAt = validInstant(raw.start?.dateTime);
    endAt = validInstant(raw.end?.dateTime);
    if ((!startAt || !endAt) && status !== "cancelled") {
      issues.push({
        severity: "BLOCKING",
        code: "INVALID_TIMED_RANGE",
        message: "時刻予定のstart.dateTime/end.dateTimeが不正です。",
        calendar: input.calendarName,
        eventId
      });
    }
  }

  if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
    issues.push({
      severity: status === "cancelled" ? "WARNING" : "BLOCKING",
      code: "NON_POSITIVE_RANGE",
      message: "終了日時が開始日時より後ではありません。",
      calendar: input.calendarName,
      eventId
    });
  }

  const originalStartDate = raw.originalStartTime?.date ?? null;
  const originalStartTime = validInstant(raw.originalStartTime?.dateTime);
  if (!raw.summary?.trim()) {
    issues.push({
      severity: "WARNING",
      code: "MISSING_TITLE",
      message: "タイトルがないため「(タイトルなし)」としてPreviewします。",
      calendar: input.calendarName,
      eventId
    });
  }

  return {
    event: {
      googleCalendarId: input.calendarId,
      googleCalendarEventId: eventId,
      title: raw.summary?.trim() || "(タイトルなし)",
      description: raw.description?.trim() || null,
      category: input.category,
      startAt,
      endAt,
      allDay,
      startDate,
      endDateExclusive,
      location: raw.location?.trim() || null,
      googleEtag: raw.etag ?? null,
      googleUpdatedAt: validInstant(raw.updated),
      eventTimeZone: raw.start?.timeZone ?? raw.end?.timeZone ?? input.calendarTimeZone,
      googleRecurringEventId: raw.recurringEventId ?? null,
      originalStartTime,
      originalStartDate: originalStartDate && isDateOnly(originalStartDate) ? originalStartDate : null,
      googleEventType: eventType,
      googleStatus: status,
      recurrence,
      transparency: raw.transparency ?? null,
      visibility: raw.visibility ?? null
    },
    issues
  };
}
