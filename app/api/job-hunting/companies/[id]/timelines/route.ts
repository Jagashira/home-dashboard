import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params;
    const payload = await request.json();
    const eventType = typeof payload.eventType === "string" ? payload.eventType.trim() : "";
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const status = typeof payload.status === "string" ? payload.status.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    const eventDateRaw = typeof payload.eventDate === "string" ? payload.eventDate : "";
    if (!eventType || !title || !status || !eventDateRaw) {
      return NextResponse.json({ ok: false, error: "eventType/title/status/eventDate are required" }, { status: 400 });
    }
    const eventDate = new Date(`${eventDateRaw}T00:00:00.000Z`);
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid eventDate" }, { status: 400 });
    }
    const item = await prisma.jobTimeline.create({
      data: { companyId, eventType, title, status, eventDate, note: note || null }
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
