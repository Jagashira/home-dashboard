import { getDb } from "@/lib/db";
import { APP_CONFIG } from "@/lib/config";
import { AppSettings } from "@/lib/types";

export function getSettings(): AppSettings {
  const db = getDb();
  const row = db.prepare("SELECT total_requested, days, prefer_japanese, updated_at FROM app_settings WHERE id=1").get() as
    | {
        total_requested: number;
        days: number;
        prefer_japanese: number;
        updated_at: string;
      }
    | undefined;

  if (!row) {
    return {
      totalRequested: APP_CONFIG.totalRequestedDefault,
      days: APP_CONFIG.daysDefault,
      preferJapanese: true,
      updatedAt: new Date().toISOString()
    };
  }
  return {
    totalRequested: row.total_requested,
    days: row.days,
    preferJapanese: row.prefer_japanese === 1,
    updatedAt: row.updated_at
  };
}

export function updateSettings(input: {
  totalRequested: number;
  days: number;
  preferJapanese: boolean;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE app_settings
    SET total_requested=?, days=?, prefer_japanese=?, updated_at=?
    WHERE id=1
  `
  ).run(input.totalRequested, input.days, input.preferJapanese ? 1 : 0, now);
}
