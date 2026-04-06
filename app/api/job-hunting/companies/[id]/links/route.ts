import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params;
    const payload = await request.json();
    const label = typeof payload.label === "string" ? payload.label.trim() : "";
    const url = typeof payload.url === "string" ? payload.url.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";

    if (!label || !url) {
      return NextResponse.json({ ok: false, error: "label/url are required" }, { status: 400 });
    }

    const item = await prisma.jobUsefulLink.create({
      data: {
        companyId,
        label,
        url,
        note: note || null
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
