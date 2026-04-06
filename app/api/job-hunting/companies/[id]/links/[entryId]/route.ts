import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { entryId } = await params;
    const payload = await request.json();
    const data: { label?: string; url?: string; note?: string | null } = {};
    if (typeof payload.label === "string") data.label = payload.label.trim();
    if (typeof payload.url === "string") data.url = payload.url.trim();
    if (typeof payload.note === "string") data.note = payload.note.trim() || null;
    const item = await prisma.jobUsefulLink.update({ where: { id: entryId }, data });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { entryId } = await params;
    await prisma.jobUsefulLink.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
