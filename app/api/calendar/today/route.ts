import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ ok: true, events, fatigueTotal });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "load failed" },
      { status: 500 }
    );
  }
}
