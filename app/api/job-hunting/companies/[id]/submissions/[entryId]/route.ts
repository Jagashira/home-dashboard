import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { entryId } = await params;
    const payload = await request.json();
    const data: { itemType?: string; status?: string; storagePath?: string | null; note?: string | null; submittedAt?: Date | null } = {};
    if (typeof payload.itemType === "string") data.itemType = payload.itemType.trim();
    if (typeof payload.status === "string") data.status = payload.status.trim();
    if (typeof payload.storagePath === "string") data.storagePath = payload.storagePath.trim() || null;
    if (typeof payload.note === "string") data.note = payload.note.trim() || null;
    if (payload.submittedAt === null) data.submittedAt = null;
    if (typeof payload.submittedAt === "string" && payload.submittedAt) {
      const date = new Date(`${payload.submittedAt}T00:00:00.000Z`);
      if (!Number.isNaN(date.getTime())) data.submittedAt = date;
    }
    const item = await prisma.jobSubmission.update({ where: { id: entryId }, data });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { entryId } = await params;
    await prisma.jobSubmission.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
