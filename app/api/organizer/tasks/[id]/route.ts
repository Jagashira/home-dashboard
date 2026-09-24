import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { deleteOrganizerTask, getOrganizerTask, updateOrganizerTask } from "@/lib/organizer/repository";
import { validateTaskPayload } from "@/lib/organizer/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const task = await getOrganizerTask((await params).id);
    if (!task) return NextResponse.json({ ok: false, error: "タスクが見つかりません。" }, { status: 404 });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const task = await updateOrganizerTask((await params).id, validateTaskPayload(await request.json(), true));
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await deleteOrganizerTask((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

