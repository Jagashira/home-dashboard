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
      progressMinutes?: number;
      canSplit?: boolean;
      importance?: number;
      fatigue?: number;
      urgency?: number;
      status?: string;
      dueDate?: Date | null;
      targetDate?: Date | null;
      note?: string | null;
    } = {};

    if (typeof payload.title === "string") data.title = payload.title.trim();
    if (payload.minutes !== undefined) data.minutes = Math.max(1, Math.round(Number(payload.minutes)));
    if (payload.progressMinutes !== undefined) {
      data.progressMinutes = Math.max(0, Math.round(Number(payload.progressMinutes)));
    }
    if (payload.canSplit !== undefined) data.canSplit = Boolean(payload.canSplit);
    if (payload.importance !== undefined) data.importance = Math.min(5, Math.max(1, Math.round(Number(payload.importance))));
    if (payload.fatigue !== undefined) data.fatigue = Math.min(100, Math.max(0, Math.round(Number(payload.fatigue))));
    if (payload.urgency !== undefined) data.urgency = Math.min(5, Math.max(1, Math.round(Number(payload.urgency))));
    if (payload.status === "todo" || payload.status === "done") data.status = payload.status;
    if (payload.dueDate === null) data.dueDate = null;
    if (typeof payload.dueDate === "string" && payload.dueDate) {
      const dueDate = new Date(payload.dueDate);
      if (!Number.isNaN(dueDate.getTime())) {
        data.dueDate = dueDate;
      }
    }
    if (payload.targetDate === null) data.targetDate = null;
    if (typeof payload.targetDate === "string" && payload.targetDate) {
      const targetDate = new Date(payload.targetDate);
      if (!Number.isNaN(targetDate.getTime())) {
        data.targetDate = targetDate;
      }
    }
    if (typeof payload.note === "string") data.note = payload.note;

    const currentTask = await prisma.task.findUnique({ where: { id } });
    if (!currentTask) {
      return NextResponse.json({ ok: false, error: "task not found" }, { status: 404 });
    }

    const nextMinutes = data.minutes ?? currentTask.minutes;
    const nextProgress = Math.min(data.progressMinutes ?? currentTask.progressMinutes, nextMinutes);
    data.progressMinutes = nextProgress;
    if (payload.status !== "todo" && payload.status !== "done") {
      data.status = nextProgress >= nextMinutes ? "done" : currentTask.status;
    }

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
