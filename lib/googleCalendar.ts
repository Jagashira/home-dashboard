import { google } from "googleapis";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export async function fetchGoogleCalendarTodayEvents() {
  const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getRequiredEnv("GOOGLE_REDIRECT_URI");
  const refreshToken = getRequiredEnv("GOOGLE_REFRESH_TOKEN");
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const response = await calendar.events.list({
    calendarId,
    timeMin: dayStart.toISOString(),
    timeMax: dayEnd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500
  });

  return (response.data.items ?? [])
    .map((item) => {
      const startRaw = item.start?.dateTime ?? item.start?.date;
      const endRaw = item.end?.dateTime ?? item.end?.date;
      if (!startRaw || !endRaw) return null;

      const startAt = new Date(startRaw);
      const endAt = new Date(endRaw);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return null;
      }

      return {
        title: item.summary?.trim() || "(no title)",
        startAt,
        endAt,
        source: "google"
      };
    })
    .filter((item): item is { title: string; startAt: Date; endAt: Date; source: string } => Boolean(item));
}
