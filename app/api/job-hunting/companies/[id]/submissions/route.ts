import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params;
    const payload = await request.json();
    const itemType = typeof payload.itemType === "string" ? payload.itemType.trim() : "";
    const status = typeof payload.status === "string" ? payload.status.trim() : "";
    const storagePath = typeof payload.storagePath === "string" ? payload.storagePath.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    const submittedAtRaw = typeof payload.submittedAt === "string" ? payload.submittedAt : "";

    if (!itemType || !status) {
      return NextResponse.json({ ok: false, error: "itemType/status are required" }, { status: 400 });
    }
    const submittedAt = submittedAtRaw ? new Date(`${submittedAtRaw}T00:00:00.000Z`) : null;
    const item = await prisma.jobSubmission.create({
      data: {
        companyId,
        itemType,
        status,
        storagePath: storagePath || null,
        note: note || null,
        submittedAt: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt : null
      }
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
