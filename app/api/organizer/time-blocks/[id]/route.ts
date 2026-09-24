import { NextRequest, NextResponse } from "next/server";
import { organizerErrorResponse } from "@/lib/organizer/http";
import { deleteOrganizerTimeBlock, getOrganizerTimeBlock, updateOrganizerTimeBlock } from "@/lib/organizer/repository";
import { validateTimeBlockPayload } from "@/lib/organizer/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const timeBlock = await getOrganizerTimeBlock((await params).id);
    if (!timeBlock) return NextResponse.json({ ok: false, error: "TimeBlockが見つかりません。" }, { status: 404 });
    return NextResponse.json({ ok: true, timeBlock });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const timeBlock = await updateOrganizerTimeBlock((await params).id, validateTimeBlockPayload(await request.json(), true));
    return NextResponse.json({ ok: true, timeBlock });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await deleteOrganizerTimeBlock((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return organizerErrorResponse(error);
  }
}

