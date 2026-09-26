import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tokyoDayBounds } from "./dates";
import {
  OrganizerConflictError,
  OrganizerValidationError,
  type EventWrite,
  type RoutineCompletionWrite,
  type RoutineWrite,
  type TaskWrite,
  type TimeBlockWrite
} from "./validation";

export type OrganizerDb = PrismaClient;

export async function listOrganizerTasks(
  filters: { statuses?: string[]; category?: string; sort?: string } = {},
  db: OrganizerDb = prisma
) {
  const orderBy =
    filters.sort === "created"
      ? [{ createdAt: "desc" as const }]
      : filters.sort === "importance"
        ? [{ importance: "desc" as const }, { dueDate: "asc" as const }, { createdAt: "desc" as const }]
        : [{ dueDate: "asc" as const }, { targetDate: "asc" as const }, { importance: "desc" as const }, { createdAt: "desc" as const }];
  return db.organizerTask.findMany({
    where: {
      ...(filters.statuses?.length ? { status: { in: filters.statuses } } : {}),
      ...(filters.category ? { category: filters.category } : {})
    },
    include: { _count: { select: { timeBlocks: true } } },
    orderBy
  });
}

export async function getOrganizerTask(id: string, db: OrganizerDb = prisma) {
  return db.organizerTask.findUnique({
    where: { id },
    include: { timeBlocks: { orderBy: { startAt: "asc" } }, _count: { select: { timeBlocks: true } } }
  });
}

export async function createOrganizerTask(input: TaskWrite, db: OrganizerDb = prisma) {
  return db.organizerTask.create({
    data: {
      title: input.title!,
      description: input.description ?? null,
      category: input.category!,
      status: input.status ?? "inbox",
      importance: input.importance ?? 2,
      estimatedMinutes: input.estimatedMinutes ?? null,
      targetDate: input.targetDate ?? null,
      dueDate: input.dueDate ?? null,
      completedAt: input.status === "completed" ? new Date() : null
    },
    include: { _count: { select: { timeBlocks: true } } }
  });
}

export async function updateOrganizerTask(id: string, input: TaskWrite, db: OrganizerDb = prisma) {
  const current = await db.organizerTask.findUnique({ where: { id } });
  if (!current) throw new OrganizerValidationError("タスクが見つかりません。");
  const nextStatus = input.status ?? current.status;
  return db.organizerTask.update({
    where: { id },
    data: {
      ...input,
      completedAt:
        nextStatus === "completed"
          ? current.completedAt ?? new Date()
          : input.status !== undefined
            ? null
            : current.completedAt
    },
    include: { _count: { select: { timeBlocks: true } } }
  });
}

export async function deleteOrganizerTask(id: string, db: OrganizerDb = prisma) {
  return db.organizerTask.delete({ where: { id } });
}

export async function listUnscheduledTasks(db: OrganizerDb = prisma) {
  return db.organizerTask.findMany({
    where: {
      status: { in: ["inbox", "planned", "doing"] },
      timeBlocks: { none: { status: { not: "skipped" } } }
    },
    include: { _count: { select: { timeBlocks: true } } },
    orderBy: [{ dueDate: "asc" }, { targetDate: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
  });
}

export async function listOrganizerEvents(
  range: { start: Date; end: Date },
  db: OrganizerDb = prisma
) {
  return db.organizerEvent.findMany({
    where: { startAt: { lt: range.end }, endAt: { gt: range.start } },
    orderBy: [{ startAt: "asc" }, { endAt: "asc" }]
  });
}

export async function getOrganizerEvent(id: string, db: OrganizerDb = prisma) {
  return db.organizerEvent.findUnique({ where: { id } });
}

export async function createOrganizerEvent(input: EventWrite, db: OrganizerDb = prisma) {
  return db.organizerEvent.create({
    data: {
      title: input.title!,
      description: input.description ?? null,
      category: input.category!,
      startAt: input.startAt!,
      endAt: input.endAt!,
      allDay: input.allDay ?? false,
      location: input.location ?? null,
      shareWithPartner: input.shareWithPartner ?? false,
      googleCalendarEventId: input.googleCalendarEventId ?? null,
      timetreeEventId: input.timetreeEventId ?? null,
      timetreeSyncStatus: input.timetreeSyncStatus ?? "not_requested"
    }
  });
}

export async function updateOrganizerEvent(id: string, input: EventWrite, db: OrganizerDb = prisma) {
  const current = await db.organizerEvent.findUnique({ where: { id } });
  if (!current) throw new OrganizerValidationError("予定が見つかりません。");
  const startAt = input.startAt ?? current.startAt;
  const endAt = input.endAt ?? current.endAt;
  if (endAt <= startAt) {
    throw new OrganizerValidationError("終了日時は開始日時より後にしてください。", { endAt: "開始日時より後にしてください。" });
  }
  return db.organizerEvent.update({ where: { id }, data: input });
}

export async function deleteOrganizerEvent(id: string, db: OrganizerDb = prisma) {
  return db.$transaction(async (transaction) => {
    const event = await transaction.organizerEvent.findUnique({ where: { id } });
    if (!event) throw new OrganizerValidationError("予定が見つかりません。");
    if (event.googleOutboundManaged && event.googleCalendarId && event.googleCalendarEventId) {
      await transaction.googleCalendarOutboundDeletion.create({
        data: {
          organizerEventId: event.id,
          googleCalendarId: event.googleCalendarId,
          googleCalendarEventId: event.googleCalendarEventId,
          googleEtag: event.googleEtag,
          title: event.title,
          category: event.category,
          status: "pending"
        }
      });
    }
    return transaction.organizerEvent.delete({ where: { id } });
  });
}

export async function listOrganizerTimeBlocks(
  range: { start: Date; end: Date },
  db: OrganizerDb = prisma
) {
  return db.organizerTimeBlock.findMany({
    where: { startAt: { lt: range.end }, endAt: { gt: range.start } },
    include: {
      task: { select: { id: true, title: true, category: true, status: true, estimatedMinutes: true } }
    },
    orderBy: [{ startAt: "asc" }, { endAt: "asc" }]
  });
}

export async function getOrganizerTimeBlock(id: string, db: OrganizerDb = prisma) {
  return db.organizerTimeBlock.findUnique({ where: { id }, include: { task: true } });
}

export async function createOrganizerTimeBlock(input: TimeBlockWrite, db: OrganizerDb = prisma) {
  const task = await db.organizerTask.findUnique({ where: { id: input.taskId! } });
  if (!task) throw new OrganizerValidationError("割り当てるタスクが見つかりません。", { taskId: "タスクが見つかりません。" });
  if (["completed", "cancelled"].includes(task.status)) {
    throw new OrganizerConflictError("完了またはキャンセル済みのタスクは割り当てられません。");
  }
  return db.$transaction(async (transaction) => {
    const timeBlock = await transaction.organizerTimeBlock.create({
      data: {
        taskId: input.taskId!,
        title: input.title || task.title,
        startAt: input.startAt!,
        endAt: input.endAt!,
        status: input.status ?? "planned",
        actualStartAt: input.actualStartAt ?? null,
        actualEndAt: input.actualEndAt ?? null
      },
      include: {
        task: { select: { id: true, title: true, category: true, status: true, estimatedMinutes: true } }
      }
    });
    if (task.status === "inbox") {
      await transaction.organizerTask.update({ where: { id: task.id }, data: { status: "planned" } });
    }
    return timeBlock;
  });
}

export async function updateOrganizerTimeBlock(id: string, input: TimeBlockWrite, db: OrganizerDb = prisma) {
  const current = await db.organizerTimeBlock.findUnique({ where: { id } });
  if (!current) throw new OrganizerValidationError("TimeBlockが見つかりません。");
  const startAt = input.startAt ?? current.startAt;
  const endAt = input.endAt ?? current.endAt;
  if (endAt <= startAt) {
    throw new OrganizerValidationError("終了日時は開始日時より後にしてください。", { endAt: "開始日時より後にしてください。" });
  }
  if (input.taskId && input.taskId !== current.taskId) {
    const task = await db.organizerTask.findUnique({ where: { id: input.taskId } });
    if (!task || ["completed", "cancelled"].includes(task.status)) {
      throw new OrganizerConflictError("有効なタスクを選択してください。");
    }
  }
  return db.organizerTimeBlock.update({
    where: { id },
    data: input,
    include: {
      task: { select: { id: true, title: true, category: true, status: true, estimatedMinutes: true } }
    }
  });
}

export async function deleteOrganizerTimeBlock(id: string, db: OrganizerDb = prisma) {
  return db.organizerTimeBlock.delete({ where: { id } });
}

export async function getPlannerDay(date: string, db: OrganizerDb = prisma) {
  const range = tokyoDayBounds(date);
  const [events, timeBlocks, unscheduledTasks] = await Promise.all([
    listOrganizerEvents(range, db),
    listOrganizerTimeBlocks(range, db),
    listUnscheduledTasks(db)
  ]);
  return { date, timeZone: "Asia/Tokyo", events, timeBlocks, unscheduledTasks };
}

function routineView<T extends { daysOfWeek: string }>(routine: T) {
  return { ...routine, daysOfWeek: JSON.parse(routine.daysOfWeek) as number[] };
}

export async function listOrganizerRoutines(db: OrganizerDb = prisma) {
  const routines = await db.organizerRoutine.findMany({ orderBy: [{ active: "desc" }, { title: "asc" }] });
  return routines.map(routineView);
}

export async function getOrganizerRoutine(id: string, db: OrganizerDb = prisma) {
  const routine = await db.organizerRoutine.findUnique({
    where: { id },
    include: { completions: { orderBy: { date: "desc" } } }
  });
  return routine ? routineView(routine) : null;
}

export async function createOrganizerRoutine(input: RoutineWrite, db: OrganizerDb = prisma) {
  return routineView(
    await db.organizerRoutine.create({
      data: {
        title: input.title!,
        category: input.category!,
        estimatedMinutes: input.estimatedMinutes!,
        daysOfWeek: input.daysOfWeek!,
        active: input.active ?? true
      }
    })
  );
}

export async function updateOrganizerRoutine(id: string, input: RoutineWrite, db: OrganizerDb = prisma) {
  return routineView(await db.organizerRoutine.update({ where: { id }, data: input }));
}

export async function deleteOrganizerRoutine(id: string, db: OrganizerDb = prisma) {
  return db.organizerRoutine.delete({ where: { id } });
}

export async function listRoutineCompletions(
  filters: { date?: string; routineId?: string } = {},
  db: OrganizerDb = prisma
) {
  return db.organizerRoutineCompletion.findMany({
    where: { ...(filters.date ? { date: filters.date } : {}), ...(filters.routineId ? { routineId: filters.routineId } : {}) },
    include: { routine: true },
    orderBy: [{ date: "desc" }, { completedAt: "desc" }]
  });
}

export async function completeRoutine(
  input: RoutineCompletionWrite,
  db: OrganizerDb = prisma
) {
  const routineId = input.routineId!;
  const date = input.date!;
  const routine = await db.organizerRoutine.findUnique({ where: { id: routineId } });
  if (!routine) throw new OrganizerValidationError("Routineが見つかりません。");
  return db.organizerRoutineCompletion.upsert({
    where: { routineId_date: { routineId, date } },
    create: { routineId, date, completedAt: input.completedAt },
    update: { completedAt: input.completedAt ?? new Date() },
    include: { routine: true }
  });
}

export async function getRoutineCompletion(id: string, db: OrganizerDb = prisma) {
  return db.organizerRoutineCompletion.findUnique({ where: { id }, include: { routine: true } });
}

export async function updateRoutineCompletion(
  id: string,
  input: RoutineCompletionWrite,
  db: OrganizerDb = prisma
) {
  const current = await db.organizerRoutineCompletion.findUnique({ where: { id } });
  if (!current) throw new OrganizerValidationError("Routine実績が見つかりません。");
  if (input.routineId && input.routineId !== current.routineId) {
    const routine = await db.organizerRoutine.findUnique({ where: { id: input.routineId } });
    if (!routine) throw new OrganizerValidationError("Routineが見つかりません。", { routineId: "Routineが見つかりません。" });
  }
  return db.organizerRoutineCompletion.update({
    where: { id },
    data: input,
    include: { routine: true }
  });
}

export async function deleteRoutineCompletion(id: string, db: OrganizerDb = prisma) {
  return db.organizerRoutineCompletion.delete({ where: { id } });
}
