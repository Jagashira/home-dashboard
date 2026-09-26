import { createHash } from "node:crypto";
import { formatTokyoDate } from "@/lib/organizer/dates";
import type { OrganizerCategory } from "@/lib/organizer/constants";
import type { NormalizedGoogleEvent } from "./types";

export type OutboundEventSource = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  startDate: string | null;
  endDateExclusive: string | null;
  location: string | null;
};

export type GoogleOutboundEventPayload = {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone: "Asia/Tokyo" };
  end: { date: string } | { dateTime: string; timeZone: "Asia/Tokyo" };
  extendedProperties: { private: { homeDashboardEventId: string } };
};

type LocalSnapshot = {
  title: string;
  description: string | null;
  category: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string | null;
};

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function localSnapshot(source: OutboundEventSource): LocalSnapshot {
  return {
    title: source.title,
    description: source.description,
    category: source.category,
    allDay: source.allDay,
    start: source.allDay ? source.startDate ?? formatTokyoDate(source.startAt) : source.startAt.toISOString(),
    end: source.allDay ? source.endDateExclusive ?? formatTokyoDate(source.endAt) : source.endAt.toISOString(),
    location: source.location
  };
}

export function localOutboundHash(source: OutboundEventSource) {
  return hash(localSnapshot(source));
}

export function normalizedGoogleLocalHash(event: NormalizedGoogleEvent) {
  const snapshot: LocalSnapshot = {
    title: event.title,
    description: event.description,
    category: event.category,
    allDay: event.allDay,
    start: event.allDay ? event.startDate! : event.startAt!,
    end: event.allDay ? event.endDateExclusive! : event.endAt!,
    location: event.location
  };
  return hash(snapshot);
}

export function deterministicGoogleEventId(organizerEventId: string) {
  return `hd${createHash("sha256").update(organizerEventId).digest("hex")}`;
}

export function toGoogleOutboundPayload(source: OutboundEventSource, includeId = false): GoogleOutboundEventPayload {
  const snapshot = localSnapshot(source);
  return {
    ...(includeId ? { id: deterministicGoogleEventId(source.id) } : {}),
    summary: snapshot.title,
    ...(snapshot.description ? { description: snapshot.description } : {}),
    ...(snapshot.location ? { location: snapshot.location } : {}),
    start: snapshot.allDay
      ? { date: snapshot.start }
      : { dateTime: snapshot.start, timeZone: "Asia/Tokyo" },
    end: snapshot.allDay
      ? { date: snapshot.end }
      : { dateTime: snapshot.end, timeZone: "Asia/Tokyo" },
    extendedProperties: { private: { homeDashboardEventId: source.id } }
  };
}

export function isOrganizerCategory(value: string): value is OrganizerCategory {
  return ["university", "work", "entertainment", "life"].includes(value);
}
