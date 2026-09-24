import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { deleteRoutineCompletion, getRoutineCompletion, updateRoutineCompletion } from "@/lib/organizer/repository";
import { validateRoutineCompletionPayload } from "@/lib/organizer/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const completion = await getRoutineCompletion((await params).id);
    if (!completion) return NextResponse.json({ ok: false, error: "Routine実績が見つかりません。" }, { status: 404 });
    return NextResponse.json({ ok: true, completion });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const completion = await updateRoutineCompletion(
      (await params).id,
      validateRoutineCompletionPayload(await request.json(), true)
    );
    return NextResponse.json({ ok: true, completion });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await deleteRoutineCompletion((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}
