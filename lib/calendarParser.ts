import { defaultFatigueWeight, fatigueWeights } from "./fatigueConfig";

const TITLE_TAG_REGEX = /^\[(\w+)(?::(\d+))?\]/;

export function parseCalendarTitle(title: string): { tag: string; fatigue: number } {
  const trimmed = title.trim();
  const matched = TITLE_TAG_REGEX.exec(trimmed);

  if (!matched) {
    return { tag: "OTHER", fatigue: defaultFatigueWeight };
  }

  const tag = (matched[1] ?? "OTHER").toUpperCase();
  const manualFatigue = matched[2] ? Number(matched[2]) : null;

  if (manualFatigue !== null && Number.isFinite(manualFatigue)) {
    return {
      tag,
      fatigue: Math.max(-100, Math.min(100, Math.round(manualFatigue)))
    };
  }

  return {
    tag,
    fatigue: fatigueWeights[tag] ?? defaultFatigueWeight
  };
}
