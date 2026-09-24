import {
  ORGANIZER_CATEGORIES,
  ORGANIZER_TASK_STATUSES,
  ORGANIZER_TIME_BLOCK_STATUSES,
  TIMETREE_SYNC_STATUSES,
  type OrganizerCategory,
  type OrganizerTaskStatus,
  type OrganizerTimeBlockStatus,
  type TimeTreeSyncStatus
} from "./constants";
import { isDateOnly } from "./dates";

type JsonRecord = Record<string, unknown>;

export class OrganizerValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = "OrganizerValidationError";
  }
}

export class OrganizerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizerConflictError";
  }
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganizerValidationError("入力形式が正しくありません。");
  }
  return value as JsonRecord;
}

function text(value: unknown, field: string, required = false): string | null {
  if (value === undefined || value === null) {
    if (required) throw new OrganizerValidationError(`${field}は必須です。`, { [field]: "必須です。" });
    return null;
  }
  if (typeof value !== "string") {
    throw new OrganizerValidationError(`${field}は文字列で入力してください。`, { [field]: "文字列で入力してください。" });
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new OrganizerValidationError(`${field}は必須です。`, { [field]: "必須です。" });
  if (trimmed.length > 5000) throw new OrganizerValidationError(`${field}が長すぎます。`, { [field]: "長すぎます。" });
  return trimmed || null;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, field: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new OrganizerValidationError(`${field}の値が正しくありません。`, { [field]: "選択肢から選んでください。" });
  }
  return value as T[number];
}

function optionalPositiveInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1440) {
    throw new OrganizerValidationError(`${field}は1〜1440の整数で入力してください。`, {
      [field]: "1〜1440分で入力してください。"
    });
  }
  return parsed;
}

function dateOnly(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!isDateOnly(value)) {
    throw new OrganizerValidationError(`${field}はYYYY-MM-DD形式の実在する日付で入力してください。`, {
      [field]: "正しい日付を入力してください。"
    });
  }
  return value;
}

function dateTime(value: unknown, field: string, required = false): Date | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new OrganizerValidationError(`${field}は必須です。`, { [field]: "必須です。" });
    return null;
  }
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new OrganizerValidationError(`${field}の日時が正しくありません。`, { [field]: "正しい日時を入力してください。" });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new OrganizerValidationError(`${field}の日時が正しくありません。`, { [field]: "正しい日時を入力してください。" });
  }
  return parsed;
}

function strictBoolean(value: unknown, field: string, defaultValue?: boolean): boolean {
  if (value === undefined && defaultValue !== undefined) return defaultValue;
  if (typeof value !== "boolean") {
    throw new OrganizerValidationError(`${field}はbooleanで指定してください。`, { [field]: "ON/OFFを指定してください。" });
  }
  return value;
}

export type TaskWrite = {
  title?: string;
  description?: string | null;
  category?: OrganizerCategory;
  status?: OrganizerTaskStatus;
  importance?: number;
  estimatedMinutes?: number | null;
  targetDate?: string | null;
  dueDate?: string | null;
};

export function validateTaskPayload(value: unknown, partial = false): TaskWrite {
  const input = record(value);
  const output: TaskWrite = {};
  if (!partial || "title" in input) output.title = text(input.title, "title", true)!;
  if (!partial || "category" in input) output.category = oneOf(input.category, ORGANIZER_CATEGORIES, "category");
  if (!partial || "description" in input) output.description = text(input.description, "description");
  if (!partial || "status" in input) {
    output.status = input.status === undefined && !partial ? "inbox" : oneOf(input.status, ORGANIZER_TASK_STATUSES, "status");
  }
  if (!partial || "importance" in input) {
    const importance = input.importance === undefined && !partial ? 2 : Number(input.importance);
    if (![1, 2, 3].includes(importance)) {
      throw new OrganizerValidationError("importanceは1、2、3のいずれかです。", { importance: "1〜3を選んでください。" });
    }
    output.importance = importance;
  }
  if (!partial || "estimatedMinutes" in input) output.estimatedMinutes = optionalPositiveInteger(input.estimatedMinutes, "estimatedMinutes");
  if (!partial || "targetDate" in input) output.targetDate = dateOnly(input.targetDate, "targetDate");
  if (!partial || "dueDate" in input) output.dueDate = dateOnly(input.dueDate, "dueDate");
  return output;
}

export type EventWrite = {
  title?: string;
  description?: string | null;
  category?: OrganizerCategory;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  location?: string | null;
  shareWithPartner?: boolean;
  googleCalendarEventId?: string | null;
  timetreeEventId?: string | null;
  timetreeSyncStatus?: TimeTreeSyncStatus;
};

export function validateEventPayload(value: unknown, partial = false): EventWrite {
  const input = record(value);
  const output: EventWrite = {};
  if (!partial || "title" in input) output.title = text(input.title, "title", true)!;
  if (!partial || "category" in input) output.category = oneOf(input.category, ORGANIZER_CATEGORIES, "category");
  if (!partial || "description" in input) output.description = text(input.description, "description");
  if (!partial || "startAt" in input) output.startAt = dateTime(input.startAt, "startAt", true)!;
  if (!partial || "endAt" in input) output.endAt = dateTime(input.endAt, "endAt", true)!;
  if (!partial || "allDay" in input) output.allDay = strictBoolean(input.allDay, "allDay", false);
  if (!partial || "location" in input) output.location = text(input.location, "location");
  if (!partial || "shareWithPartner" in input) {
    output.shareWithPartner = strictBoolean(input.shareWithPartner, "shareWithPartner", false);
  }
  if ("googleCalendarEventId" in input) output.googleCalendarEventId = text(input.googleCalendarEventId, "googleCalendarEventId");
  if ("timetreeEventId" in input) output.timetreeEventId = text(input.timetreeEventId, "timetreeEventId");
  if ("timetreeSyncStatus" in input) {
    output.timetreeSyncStatus = oneOf(input.timetreeSyncStatus, TIMETREE_SYNC_STATUSES, "timetreeSyncStatus");
  } else if (!partial) {
    output.timetreeSyncStatus = "not_requested";
  }
  if (output.startAt && output.endAt && output.endAt <= output.startAt) {
    throw new OrganizerValidationError("終了日時は開始日時より後にしてください。", { endAt: "開始日時より後にしてください。" });
  }
  return output;
}

export type TimeBlockWrite = {
  taskId?: string;
  title?: string;
  startAt?: Date;
  endAt?: Date;
  status?: OrganizerTimeBlockStatus;
  actualStartAt?: Date | null;
  actualEndAt?: Date | null;
};

export function validateTimeBlockPayload(value: unknown, partial = false): TimeBlockWrite {
  const input = record(value);
  const output: TimeBlockWrite = {};
  if (!partial || "taskId" in input) output.taskId = text(input.taskId, "taskId", true)!;
  if (!partial || "title" in input) output.title = text(input.title, "title", true)!;
  if (!partial || "startAt" in input) output.startAt = dateTime(input.startAt, "startAt", true)!;
  if (!partial || "endAt" in input) output.endAt = dateTime(input.endAt, "endAt", true)!;
  if (!partial || "status" in input) {
    output.status = input.status === undefined && !partial ? "planned" : oneOf(input.status, ORGANIZER_TIME_BLOCK_STATUSES, "status");
  }
  if (!partial || "actualStartAt" in input) output.actualStartAt = dateTime(input.actualStartAt, "actualStartAt");
  if (!partial || "actualEndAt" in input) output.actualEndAt = dateTime(input.actualEndAt, "actualEndAt");
  if (output.startAt && output.endAt && output.endAt <= output.startAt) {
    throw new OrganizerValidationError("終了日時は開始日時より後にしてください。", { endAt: "開始日時より後にしてください。" });
  }
  if (output.actualStartAt && output.actualEndAt && output.actualEndAt <= output.actualStartAt) {
    throw new OrganizerValidationError("実績終了日時は実績開始日時より後にしてください。", {
      actualEndAt: "実績開始日時より後にしてください。"
    });
  }
  return output;
}

export type RoutineWrite = {
  title?: string;
  category?: OrganizerCategory;
  estimatedMinutes?: number;
  daysOfWeek?: string;
  active?: boolean;
};

export function validateRoutinePayload(value: unknown, partial = false): RoutineWrite {
  const input = record(value);
  const output: RoutineWrite = {};
  if (!partial || "title" in input) output.title = text(input.title, "title", true)!;
  if (!partial || "category" in input) output.category = oneOf(input.category, ORGANIZER_CATEGORIES, "category");
  if (!partial || "estimatedMinutes" in input) {
    const minutes = optionalPositiveInteger(input.estimatedMinutes, "estimatedMinutes");
    if (minutes === null) throw new OrganizerValidationError("estimatedMinutesは必須です。", { estimatedMinutes: "必須です。" });
    output.estimatedMinutes = minutes;
  }
  if (!partial || "daysOfWeek" in input) {
    if (!Array.isArray(input.daysOfWeek)) {
      throw new OrganizerValidationError("daysOfWeekは曜日番号の配列で指定してください。", { daysOfWeek: "曜日を選んでください。" });
    }
    const days = [...new Set(input.daysOfWeek.map(Number))].sort((a, b) => a - b);
    if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new OrganizerValidationError("daysOfWeekは0（日）〜6（土）の配列です。", { daysOfWeek: "1日以上選んでください。" });
    }
    output.daysOfWeek = JSON.stringify(days);
  }
  if (!partial || "active" in input) output.active = strictBoolean(input.active, "active", true);
  return output;
}

export type RoutineCompletionWrite = {
  routineId?: string;
  date?: string;
  completedAt?: Date;
};

export function validateRoutineCompletionPayload(value: unknown, partial = false): RoutineCompletionWrite {
  const input = record(value);
  const output: RoutineCompletionWrite = {};
  if (!partial || "routineId" in input) output.routineId = text(input.routineId, "routineId", true)!;
  if (!partial || "date" in input) {
    const date = dateOnly(input.date, "date");
    if (!date) throw new OrganizerValidationError("dateは必須です。", { date: "必須です。" });
    output.date = date;
  }
  if ("completedAt" in input) output.completedAt = dateTime(input.completedAt, "completedAt", true)!;
  return output;
}
