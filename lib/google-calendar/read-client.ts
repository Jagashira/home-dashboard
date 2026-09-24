import { google } from "googleapis";
import type { GoogleCalendarReadClient } from "./types";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createGoogleCalendarReadClient(): GoogleCalendarReadClient {
  const auth = new google.auth.OAuth2(
    required("GOOGLE_CLIENT_ID"),
    required("GOOGLE_CLIENT_SECRET"),
    required("GOOGLE_REDIRECT_URI")
  );
  auth.setCredentials({ refresh_token: required("GOOGLE_REFRESH_TOKEN") });
  const calendar = google.calendar({ version: "v3", auth });

  return Object.freeze({
    async getGrantedScopes() {
      const result = await auth.getAccessToken();
      if (!result.token) throw new Error("Google access token could not be refreshed");
      const tokenInfo = await auth.getTokenInfo(result.token);
      return [...(tokenInfo.scopes ?? [])].sort();
    },
    async listCalendarsPage(pageToken) {
      const response = await calendar.calendarList.list({
        maxResults: 250,
        pageToken,
        showHidden: true
      });
      return {
        items: (response.data.items ?? [])
          .filter((item): item is typeof item & { id: string } => Boolean(item.id))
          .map((item) => ({
            id: item.id,
            displayName: item.summaryOverride?.trim() || item.summary?.trim() || "(no name)",
            accessRole: item.accessRole ?? "unknown",
            timeZone: item.timeZone ?? null
          })),
        nextPageToken: response.data.nextPageToken ?? undefined
      };
    },
    async listEventsPage(calendarId, pageToken) {
      const response = await calendar.events.list({
        calendarId,
        maxResults: 2500,
        pageToken,
        showDeleted: true,
        singleEvents: false
      });
      return {
        items: response.data.items ?? [],
        nextPageToken: response.data.nextPageToken ?? undefined,
        nextSyncToken: response.data.nextSyncToken ?? undefined
      };
    }
  });
}
