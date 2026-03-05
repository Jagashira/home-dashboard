import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payload = await request.json();

    const data: {
      title?: string;
      minutes?: number;
      importance?: number;
      fatigue?: number;
      status?: string;
      dueDate?: Date | null;
      note?: string | null;
    } = {};

    if (typeof payload.title === "string") data.title = payload.title.trim();
    if (payload.minutes !== undefined) data.minutes = Math.max(1, Math.round(Number(payload.minutes)));
    if (payload.importance !== undefined) data.importance = Math.min(5, Math.max(1, Math.round(Number(payload.importance))));
    if (payload.fatigue !== undefined) data.fatigue = Math.min(100, Math.max(0, Math.round(Number(payload.fatigue))));
    if (payload.status === "todo" || payload.status === "done") data.status = payload.status;
    if (payload.dueDate === null) data.dueDate = null;
    if (typeof payload.dueDate === "string" && payload.dueDate) {
      const dueDate = new Date(payload.dueDate);
      if (!Number.isNaN(dueDate.getTime())) {
        data.dueDate = dueDate;
      }
    }
    if (typeof payload.note === "string") data.note = payload.note;

    const task = await prisma.task.update({
      where: { id },
      data
    });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
