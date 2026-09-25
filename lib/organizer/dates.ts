import { TOKYO_TIME_ZONE } from "./constants";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isTimeInput(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function todayInTokyo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function addDateOnlyDays(value: string, days: number): string {
  if (!isDateOnly(value)) throw new Error(`Invalid date-only value: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function tokyoDateTimeToUtc(date: string, time: string): Date {
  if (!isDateOnly(date) || !isTimeInput(time)) throw new Error("日付または時刻の形式が正しくありません。");
  return new Date(`${date}T${time}:00+09:00`);
}

export function tokyoDayBounds(date: string): { start: Date; end: Date } {
  return {
    start: tokyoDateTimeToUtc(date, "00:00"),
    end: tokyoDateTimeToUtc(addDateOnlyDays(date, 1), "00:00")
  };
}

export function formatTokyoDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function formatTokyoTime(value: Date | string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(value));
}

export function dateOnlyWeekEnd(value: string): string {
  if (!isDateOnly(value)) throw new Error(`Invalid date-only value: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDateOnlyDays(value, weekday === 0 ? 0 : 7 - weekday);
}

export function minutesBetween(start: Date | string, end: Date | string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}
