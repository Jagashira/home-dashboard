import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const where = status === "todo" || status === "done" ? { status } : {};

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { targetDate: "asc" },
        { importance: "desc" },
        { urgency: "desc" },
        { createdAt: "desc" }
      ]
    });

    return NextResponse.json({ ok: true, tasks });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const minutes = Number(payload.minutes ?? 30);
    const canSplit = payload.canSplit !== undefined ? Boolean(payload.canSplit) : false;
    const importance = Number(payload.importance ?? 3);
    const dueDateRaw = typeof payload.dueDate === "string" ? payload.dueDate : "";
    const targetDateRaw = typeof payload.targetDate === "string" ? payload.targetDate : "";
    const note = typeof payload.note === "string" ? payload.note : "";

    if (!title || !Number.isFinite(minutes) || minutes <= 0) {
      return NextResponse.json({ ok: false, error: "title/minutes are required" }, { status: 400 });
    }

    const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
    const targetDate = targetDateRaw ? new Date(targetDateRaw) : null;

    const task = await prisma.task.create({
      data: {
        title,
        minutes: Math.max(1, Math.round(minutes)),
        progressMinutes: 0,
        canSplit,
        importance: Math.min(5, Math.max(1, Math.round(importance))),
        fatigue: 0,
        urgency: 3,
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
        targetDate: targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate : null,
        note: note || null,
        status: "todo"
      }
    });

    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
