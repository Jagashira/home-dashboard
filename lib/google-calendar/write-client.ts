import { google, type calendar_v3 } from "googleapis";
import {
  GoogleOutboundAlreadyExistsError,
  GoogleOutboundConflictError,
  GoogleOutboundNotFoundError
} from "./errors";
import type { GoogleCalendarOutboundClient, GoogleOutboundRemoteEvent } from "./outbound-client";
import type { GoogleOutboundEventPayload } from "./outbound-payload";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function statusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  const value = Number(candidate.code ?? candidate.status ?? candidate.response?.status);
  return Number.isFinite(value) ? value : null;
}

function translateWriteError(error: unknown): never {
  if (statusCode(error) === 404) throw new GoogleOutboundNotFoundError();
  if (statusCode(error) === 409) throw new GoogleOutboundAlreadyExistsError();
  if (statusCode(error) === 412) throw new GoogleOutboundConflictError();
  throw error;
}

function remoteEvent(event: calendar_v3.Schema$Event): GoogleOutboundRemoteEvent {
  if (!event.id) throw new Error("Google Calendar response did not contain an event ID");
  return {
    id: event.id,
    etag: event.etag ?? null,
    updated: event.updated ?? null,
    status: event.status ?? "confirmed",
    summary: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    start: event.start ?? null,
    end: event.end ?? null,
    eventType: event.eventType ?? "default",
    homeDashboardEventId: event.extendedProperties?.private?.homeDashboardEventId ?? null
  };
}

export function createGoogleCalendarOutboundClient(options: { allowReadOnlyFallbackForDryRun?: boolean } = {}): GoogleCalendarOutboundClient {
  const outboundRefreshToken = process.env.GOOGLE_OUTBOUND_REFRESH_TOKEN?.trim() || undefined;
  const refreshToken = outboundRefreshToken
    ?? (options.allowReadOnlyFallbackForDryRun ? required("GOOGLE_REFRESH_TOKEN") : required("GOOGLE_OUTBOUND_REFRESH_TOKEN"));
  const auth = new google.auth.OAuth2(
    required("GOOGLE_CLIENT_ID"),
    required("GOOGLE_CLIENT_SECRET"),
    required("GOOGLE_REDIRECT_URI")
  );
  auth.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth });

  function requireDedicatedOutboundToken() {
    if (!outboundRefreshToken) {
      throw new Error("GOOGLE_OUTBOUND_REFRESH_TOKEN is required for Google Calendar writes");
    }
  }

  return Object.freeze({
    async getGrantedScopes() {
      const result = await auth.getAccessToken();
      if (!result.token) throw new Error("Google access token could not be refreshed");
      const tokenInfo = await auth.getTokenInfo(result.token);
      return [...(tokenInfo.scopes ?? [])].sort();
    },
    async getEvent(calendarId, eventId) {
      try {
        const response = await calendar.events.get({ calendarId, eventId });
        return remoteEvent(response.data);
      } catch (error) {
        return translateWriteError(error);
      }
    },
    async createEvent(calendarId, payload) {
      requireDedicatedOutboundToken();
      try {
        const response = await calendar.events.insert({
          calendarId,
          requestBody: payload,
          sendUpdates: "none"
        });
        return remoteEvent(response.data);
      } catch (error) {
        return translateWriteError(error);
      }
    },
    async updateEvent(calendarId, eventId, payload, expectedEtag) {
      requireDedicatedOutboundToken();
      try {
        const response = await calendar.events.patch(
          { calendarId, eventId, requestBody: payload, sendUpdates: "none" },
          { headers: { "If-Match": expectedEtag } }
        );
        return remoteEvent(response.data);
      } catch (error) {
        return translateWriteError(error);
      }
    },
    async deleteEvent(calendarId, eventId, expectedEtag) {
      requireDedicatedOutboundToken();
      try {
        await calendar.events.delete(
          { calendarId, eventId, sendUpdates: "none" },
          { headers: { "If-Match": expectedEtag } }
        );
      } catch (error) {
        return translateWriteError(error);
      }
    }
  });
}
