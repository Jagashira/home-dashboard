import { NextRequest, NextResponse } from "next/server";
import { isDateOnly, todayInTokyo } from "@/lib/organizer/dates";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { getPlannerDay } from "@/lib/organizer/repository";
import { OrganizerValidationError } from "@/lib/organizer/validation";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") ?? todayInTokyo();
    if (!isDateOnly(date)) throw new OrganizerValidationError("dateはYYYY-MM-DD形式で指定してください。");
    return NextResponse.json({ ok: true, ...(await getPlannerDay(date)) });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
