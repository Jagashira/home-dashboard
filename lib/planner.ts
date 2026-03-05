export type TimeBlock = {
  start: string;
  end: string;
  minutes: number;
};

export type PlannerTask = {
  id: string;
  title: string;
  minutes: number;
  importance: number;
  fatigue: number;
  dueDate: Date | null;
};

export type PlannerPlanBlock = {
  block: TimeBlock;
  items: Array<{
    taskId: string;
    title: string;
    minutes: number;
  }>;
  usedMinutes: number;
  remainingMinutes: number;
};

function toDate(base: Date, hhmm: string): Date {
  const [hourText, minuteText] = hhmm.split(":");
  const result = new Date(base);
  result.setHours(Number(hourText), Number(minuteText), 0, 0);
  return result;
}

function toHm(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function diffMinutes(startAt: Date, endAt: Date): number {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
}

export function buildFreeBlocks(
  events: Array<{ startAt: Date; endAt: Date }>,
  dayStart: Date,
  dayEnd: Date
): TimeBlock[] {
  const merged = events
    .map((event) => ({
      startAt: event.startAt < dayStart ? dayStart : event.startAt,
      endAt: event.endAt > dayEnd ? dayEnd : event.endAt
    }))
    .filter((event) => event.endAt > event.startAt)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const busy: Array<{ startAt: Date; endAt: Date }> = [];
  for (const current of merged) {
    const last = busy[busy.length - 1];
    if (!last || current.startAt > last.endAt) {
      busy.push({ ...current });
      continue;
    }
    if (current.endAt > last.endAt) {
      last.endAt = current.endAt;
    }
  }

  const freeBlocks: TimeBlock[] = [];
  let cursor = dayStart;

  for (const period of busy) {
    if (period.startAt > cursor) {
      const minutes = diffMinutes(cursor, period.startAt);
      if (minutes > 0) {
        freeBlocks.push({
          start: toHm(cursor),
          end: toHm(period.startAt),
          minutes
        });
      }
    }
    if (period.endAt > cursor) {
      cursor = period.endAt;
    }
  }

  if (dayEnd > cursor) {
    const minutes = diffMinutes(cursor, dayEnd);
    if (minutes > 0) {
      freeBlocks.push({
        start: toHm(cursor),
        end: toHm(dayEnd),
        minutes
      });
    }
  }

  return freeBlocks;
}

export function buildPlan(tasks: PlannerTask[], freeBlocks: TimeBlock[], now = new Date()): PlannerPlanBlock[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const sortedTasks = tasks
    .filter((task) => task.minutes > 0)
    .sort((a, b) => {
      const aDueTodayOrBefore = a.dueDate ? a.dueDate.getTime() <= todayStart.getTime() : false;
      const bDueTodayOrBefore = b.dueDate ? b.dueDate.getTime() <= todayStart.getTime() : false;

      if (aDueTodayOrBefore !== bDueTodayOrBefore) {
        return aDueTodayOrBefore ? -1 : 1;
      }

      const aDue = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) {
        return aDue - bDue;
      }

      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }

      return a.minutes - b.minutes;
    })
    .map((task) => ({ ...task, remainingMinutes: task.minutes }));

  const plan: PlannerPlanBlock[] = [];

  for (const block of freeBlocks) {
    let free = block.minutes;
    const items: PlannerPlanBlock["items"] = [];

    for (const task of sortedTasks) {
      if (free <= 0) break;
      if (task.remainingMinutes <= 0) continue;

      const consume = Math.min(free, task.remainingMinutes);
      items.push({
        taskId: task.id,
        title: task.title,
        minutes: consume
      });

      task.remainingMinutes -= consume;
      free -= consume;
    }

    plan.push({
      block,
      items,
      usedMinutes: block.minutes - free,
      remainingMinutes: free
    });
  }

  return plan;
}

export function buildDayRange(base = new Date(), dayStartHm = "08:00", dayEndHm = "24:00") {
  const start = toDate(base, dayStartHm);
  const end = dayEndHm === "24:00" ? new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0, 0) : toDate(base, dayEndHm);
  return { start, end };
}
