import { NextRequest, NextResponse } from "next/server";
import { requireGoogleCalendarAdmin } from "@/lib/google-calendar/admin-auth";
import { googleCalendarApiError } from "@/lib/google-calendar/api";
import { discoverGoogleCalendars } from "@/lib/google-calendar/import-service";
import { createGoogleCalendarReadClient } from "@/lib/google-calendar/read-client";

export async function GET(request: NextRequest) {
  try {
    requireGoogleCalendarAdmin(request);
    return NextResponse.json({ ok: true, ...(await discoverGoogleCalendars(createGoogleCalendarReadClient())) });
  } catch (error) { return googleCalendarApiError(error); }
}
