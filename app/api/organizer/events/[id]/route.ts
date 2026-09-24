import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { deleteOrganizerEvent, getOrganizerEvent, updateOrganizerEvent } from "@/lib/organizer/repository";
import { validateEventPayload } from "@/lib/organizer/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const event = await getOrganizerEvent((await params).id);
    if (!event) return NextResponse.json({ ok: false, error: "予定が見つかりません。" }, { status: 404 });
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const event = await updateOrganizerEvent((await params).id, validateEventPayload(await request.json(), true));
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await deleteOrganizerEvent((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

