import type { CalendarMappingSpec } from "./types";

export const GOOGLE_CALENDAR_MAPPING: readonly CalendarMappingSpec[] = [
  { displayName: "大学", category: "university", sanityBaseline: 470 },
  { displayName: "仕事", category: "work", previousName: "バイト" },
  { displayName: "娯楽", category: "entertainment", sanityBaseline: 72 },
  { displayName: "生活", category: "life", previousName: "部活" }
] as const;

export const PREVIEW_TTL_MS = 30 * 60 * 1000;
