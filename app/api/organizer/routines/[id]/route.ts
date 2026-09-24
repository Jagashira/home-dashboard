import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { deleteOrganizerRoutine, getOrganizerRoutine, updateOrganizerRoutine } from "@/lib/organizer/repository";
import { validateRoutinePayload } from "@/lib/organizer/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const routine = await getOrganizerRoutine((await params).id);
    if (!routine) return NextResponse.json({ ok: false, error: "Routineが見つかりません。" }, { status: 404 });
    return NextResponse.json({ ok: true, routine });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const routine = await updateOrganizerRoutine((await params).id, validateRoutinePayload(await request.json(), true));
    return NextResponse.json({ ok: true, routine });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await deleteOrganizerRoutine((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
