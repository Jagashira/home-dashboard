import { NextRequest, NextResponse } from "next/server";
import { requireGoogleCalendarAdmin } from "@/lib/google-calendar/admin-auth";
import { googleCalendarApiError } from "@/lib/google-calendar/api";
import { getGoogleImportStatus } from "@/lib/google-calendar/import-service";

export async function GET(request: NextRequest) {
  try {
    requireGoogleCalendarAdmin(request);
    return NextResponse.json({ ok: true, ...(await getGoogleImportStatus()) });
  } catch (error) { return googleCalendarApiError(error); }
}
