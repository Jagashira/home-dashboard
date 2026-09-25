import { NextRequest, NextResponse } from "next/server";
import { tokyoDayBounds } from "@/lib/organizer/dates";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { createOrganizerTimeBlock, listOrganizerTimeBlocks } from "@/lib/organizer/repository";
import { OrganizerValidationError, validateTimeBlockPayload } from "@/lib/organizer/validation";

function rangeFromRequest(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (date) return tokyoDayBounds(date);
  const start = new Date(request.nextUrl.searchParams.get("start") ?? "");
  const end = new Date(request.nextUrl.searchParams.get("end") ?? "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new OrganizerValidationError("date、または有効なstart/end範囲を指定してください。");
  }
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, timeBlocks: await listOrganizerTimeBlocks(rangeFromRequest(request)) });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const timeBlock = await createOrganizerTimeBlock(validateTimeBlockPayload(await request.json()));
    return NextResponse.json({ ok: true, timeBlock }, { status: 201 });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
