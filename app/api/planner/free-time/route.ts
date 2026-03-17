import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDayRange, buildFreeBlocks } from "@/lib/planner";

type CalendarBlockEvent = {
  startAt: Date;
  endAt: Date;
};

export async function GET() {
  try {
    const { start, end } = buildDayRange(new Date(), "08:00", "24:00");

    const events = await prisma.calendarEvent.findMany({
      where: {
        OR: [
          { startAt: { gte: start, lt: end } },
          { endAt: { gt: start, lte: end } },
          { startAt: { lte: start }, endAt: { gte: end } }
        ]
      },
      orderBy: { startAt: "asc" }
    });

    const freeBlocks = buildFreeBlocks(
      events.map((event: CalendarBlockEvent) => ({ startAt: event.startAt, endAt: event.endAt })),
      start,
      end
    );

    return NextResponse.json({ ok: true, freeBlocks });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
