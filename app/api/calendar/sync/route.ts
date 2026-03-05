import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCalendarTitle } from "@/lib/calendarParser";
import { fetchGoogleCalendarTodayEvents } from "@/lib/googleCalendar";

export async function POST() {
  try {
    const events = await fetchGoogleCalendarTodayEvents();

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.calendarEvent.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd }
      },
      select: { startAt: true, title: true }
    });

    const existingKeys = new Set(existing.map((row) => `${row.title}__${row.startAt.toISOString()}`));

    let inserted = 0;
    for (const event of events) {
      const key = `${event.title}__${event.startAt.toISOString()}`;
      if (existingKeys.has(key)) {
        continue;
      }

      const parsed = parseCalendarTitle(event.title);
      await prisma.calendarEvent.create({
        data: {
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt,
          tag: parsed.tag,
          fatigue: parsed.fatigue,
          source: event.source
        }
      });

      existingKeys.add(key);
      inserted += 1;
    }

    return NextResponse.json({ ok: true, totalFetched: events.length, inserted });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "sync failed" },
      { status: 500 }
    );
  }
}
