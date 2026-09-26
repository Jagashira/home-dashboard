import type { GoogleOutboundEventPayload } from "./outbound-payload";

export type GoogleOutboundRemoteEvent = {
  id: string;
  etag: string | null;
  updated: string | null;
  status: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  start: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null;
  end: { date?: string | null; dateTime?: string | null; timeZone?: string | null } | null;
  eventType: string;
  homeDashboardEventId: string | null;
};

export interface GoogleCalendarOutboundClient {
  getGrantedScopes(): Promise<string[]>;
  getEvent(calendarId: string, eventId: string): Promise<GoogleOutboundRemoteEvent>;
  createEvent(calendarId: string, payload: GoogleOutboundEventPayload): Promise<GoogleOutboundRemoteEvent>;
  updateEvent(
    calendarId: string,
    eventId: string,
    payload: GoogleOutboundEventPayload,
    expectedEtag: string
  ): Promise<GoogleOutboundRemoteEvent>;
  deleteEvent(calendarId: string, eventId: string, expectedEtag: string): Promise<void>;
}
