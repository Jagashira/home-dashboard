import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { completeRoutine, listRoutineCompletions } from "@/lib/organizer/repository";
import { validateRoutineCompletionPayload } from "@/lib/organizer/validation";

export async function GET(request: NextRequest) {
  try {
    const completions = await listRoutineCompletions({
      date: request.nextUrl.searchParams.get("date") ?? undefined,
      routineId: request.nextUrl.searchParams.get("routineId") ?? undefined
    });
    return NextResponse.json({ ok: true, completions });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const completion = await completeRoutine(validateRoutineCompletionPayload(await request.json()));
    return NextResponse.json({ ok: true, completion }, { status: 201 });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
