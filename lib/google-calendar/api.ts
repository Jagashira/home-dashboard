import { NextResponse } from "next/server";
import { GoogleCalendarAdminAuthError } from "./admin-auth";

export function googleCalendarApiError(error: unknown) {
  if (error instanceof GoogleCalendarAdminAuthError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.message === "Unauthorized" ? 401 : 503 });
  }
  console.error("GOOGLE_CALENDAR_IMPORT_ERROR", error);
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : "Google Calendar import failed" },
    { status: 400 }
  );
}
