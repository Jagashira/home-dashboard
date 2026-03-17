import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDayRange, buildFreeBlocks, buildPlan } from "@/lib/planner";

export async function GET() {
  try {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const events = await prisma.calendarEvent.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd }
      },
      orderBy: { startAt: "asc" }
    });

    const fatigueTotal = events.reduce<number>((sum, event) => sum + event.fatigue, 0);

    const { start, end } = buildDayRange(new Date(), "08:00", "24:00");
    const freeBlocks = buildFreeBlocks(
      events.map((event) => ({ startAt: event.startAt, endAt: event.endAt })),
      start,
      end
    );

    const tasksTodo = await prisma.task.findMany({
      where: { status: "todo" },
      orderBy: [{ dueDate: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
    });

    const plan = buildPlan(
      tasksTodo.map((task) => ({
        id: task.id,
        title: task.title,
        minutes: task.minutes,
        importance: task.importance,
        fatigue: task.fatigue,
        dueDate: task.dueDate
      })),
      freeBlocks
    );

    return NextResponse.json({
      ok: true,
      events,
      fatigueTotal,
      freeBlocks,
      tasksTodo,
      plan
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
