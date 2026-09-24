import type { OrganizerCategory } from "@/lib/organizer/constants";

export type GoogleCalendarDescriptor = {
  id: string;
  displayName: string;
  accessRole: string;
  timeZone: string | null;
};

export type GoogleEventDateTime = {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
};

export type GoogleCalendarEvent = {
  id?: string | null;
  etag?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  updated?: string | null;
  eventType?: string | null;
  start?: GoogleEventDateTime | null;
  end?: GoogleEventDateTime | null;
  recurrence?: string[] | null;
  recurringEventId?: string | null;
  originalStartTime?: GoogleEventDateTime | null;
  transparency?: string | null;
  visibility?: string | null;
};

export type CalendarPage = {
  items: GoogleCalendarDescriptor[];
  nextPageToken?: string;
};

export type EventPage = {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

// Deliberately read-only. The concrete Google client is never exposed to callers.
export interface GoogleCalendarReadClient {
  getGrantedScopes(): Promise<string[]>;
  listCalendarsPage(pageToken?: string): Promise<CalendarPage>;
  listEventsPage(calendarId: string, pageToken?: string): Promise<EventPage>;
}

export type CalendarMappingSpec = {
  displayName: string;
  category: OrganizerCategory;
  previousName?: string;
  sanityBaseline?: number;
};

export type ValidationIssue = {
  severity: "BLOCKING" | "WARNING" | "INFO";
  code: string;
  message: string;
  calendar?: string;
  eventId?: string;
};

export type NormalizedGoogleEvent = {
  googleCalendarId: string;
  googleCalendarEventId: string;
  title: string;
  description: string | null;
  category: OrganizerCategory;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  startDate: string | null;
  endDateExclusive: string | null;
  location: string | null;
  googleEtag: string | null;
  googleUpdatedAt: string | null;
  eventTimeZone: string | null;
  googleRecurringEventId: string | null;
  originalStartTime: string | null;
  originalStartDate: string | null;
  googleEventType: string;
  googleStatus: string;
  recurrence: string[];
  transparency: string | null;
  visibility: string | null;
};

export type PreviewCalendarSummary = {
  displayName: string;
  category: OrganizerCategory;
  googleCalendarId: string;
  accessRole: string;
  timeZone: string | null;
  resourceCount: number;
  normal: number;
  allDay: number;
  timed: number;
  recurringMasters: number;
  recurringExceptions: number;
  cancelled: number;
  earliest: string | null;
  latest: string | null;
  pages: number;
  unknownEventTypes: Record<string, number>;
  create: number;
  update: number;
  skip: number;
  duplicateCandidates: number;
  sanityBaseline: number | null;
  baselineDifference: number | null;
};

export type GoogleImportPreview = {
  runId: string;
  confirmationToken: string | null;
  expiresAt: string | null;
  status: "preview_ready" | "blocked";
  scopes: string[];
  calendars: PreviewCalendarSummary[];
  issues: ValidationIssue[];
  totals: {
    fetched: number;
    create: number;
    update: number;
    skip: number;
    duplicateCandidates: number;
    googleWriteCount: 0;
  };
};
