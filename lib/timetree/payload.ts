import { createHash } from "node:crypto";
import { formatTokyoDate } from "@/lib/organizer/dates";

export const TIMETREE_MASTER_MARKER_PREFIX = "HOME_DASHBOARD_EVENT_ID:";

export type TimeTreeEventSource = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  startDate: string | null;
  endDateExclusive: string | null;
};

export type TimeTreeDesiredPayload = {
  organizerEventId: string;
  ownershipMarker: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  startDate: string | null;
  endDateExclusive: string | null;
  location: string | null;
};

export function timeTreeDesiredPayload(event: TimeTreeEventSource): TimeTreeDesiredPayload {
  const startDate = event.startDate ?? (event.allDay ? formatTokyoDate(event.startAt) : null);
  const endDateExclusive = event.endDateExclusive ?? (event.allDay ? formatTokyoDate(event.endAt) : null);
  return {
    organizerEventId: event.id,
    ownershipMarker: `${TIMETREE_MASTER_MARKER_PREFIX}${event.id}`,
    title: event.title,
    description: event.description,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    allDay: event.allDay,
    startDate,
    endDateExclusive,
    location: event.location
  };
}

export function timeTreePayloadHash(payload: TimeTreeDesiredPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
