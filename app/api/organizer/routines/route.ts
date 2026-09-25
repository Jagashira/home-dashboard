import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { createOrganizerRoutine, listOrganizerRoutines } from "@/lib/organizer/repository";
import { validateRoutinePayload } from "@/lib/organizer/validation";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, routines: await listOrganizerRoutines() });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const routine = await createOrganizerRoutine(validateRoutinePayload(await request.json()));
    return NextResponse.json({ ok: true, routine }, { status: 201 });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
