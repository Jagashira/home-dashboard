import { NextRequest, NextResponse } from "next/server";
import { requireGoogleCalendarAdmin } from "@/lib/google-calendar/admin-auth";
import { googleCalendarApiError } from "@/lib/google-calendar/api";
import { applyGoogleImportPreview } from "@/lib/google-calendar/import-service";

export async function POST(request: NextRequest) {
  try {
    requireGoogleCalendarAdmin(request);
    const body = (await request.json()) as { runId?: string; confirmationToken?: string; confirm?: string };
    if (!body.runId || !body.confirmationToken || body.confirm !== "IMPORT") {
      throw new Error("runId、confirmationToken、confirm=IMPORT が必要です。");
    }
    return NextResponse.json({ ok: true, ...(await applyGoogleImportPreview({ runId: body.runId, confirmationToken: body.confirmationToken })) });
  } catch (error) { return googleCalendarApiError(error); }
}
