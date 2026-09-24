import assert from "node:assert/strict";
import test from "node:test";
import {
  addDateOnlyDays,
  formatTokyoDate,
  formatTokyoTime,
  isDateOnly,
  tokyoDateTimeToUtc,
  tokyoDayBounds
} from "../lib/organizer/dates";
import { layoutTimelineItems } from "../lib/organizer/timeline";
import {
  OrganizerValidationError,
  validateEventPayload,
  validateRoutinePayload,
  validateTaskPayload,
  validateTimeBlockPayload
} from "../lib/organizer/validation";

test("date-only values remain separate from Tokyo instants", () => {
  assert.equal(isDateOnly("2026-09-24"), true);
  assert.equal(isDateOnly("2026-02-30"), false);
  assert.equal(tokyoDateTimeToUtc("2026-09-24", "09:30").toISOString(), "2026-09-24T00:30:00.000Z");
  assert.equal(formatTokyoDate("2026-09-24T00:30:00.000Z"), "2026-09-24");
  assert.equal(formatTokyoTime("2026-09-24T00:30:00.000Z"), "09:30");
  assert.equal(addDateOnlyDays("2026-12-31", 1), "2027-01-01");
  const bounds = tokyoDayBounds("2026-09-24");
  assert.equal(bounds.start.toISOString(), "2026-09-23T15:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-09-24T15:00:00.000Z");
});

test("task validation enforces category, importance, and positive estimates", () => {
  const valid = validateTaskPayload({
    title: "ESを修正",
    category: "work",
    importance: 3,
    estimatedMinutes: 90,
    targetDate: "2026-09-24",
    dueDate: "2026-09-28"
  });
  assert.equal(valid.title, "ESを修正");
  assert.throws(() => validateTaskPayload({ title: "x", category: "unknown" }), OrganizerValidationError);
  assert.throws(() => validateTaskPayload({ title: "x", category: "work", importance: 4 }), OrganizerValidationError);
  assert.throws(() => validateTaskPayload({ title: "x", category: "work", estimatedMinutes: 0 }), OrganizerValidationError);
});

test("event and time-block validation require an end after start", () => {
  const invalidRange = {
    title: "面接",
    category: "work",
    startAt: "2026-09-24T02:00:00.000Z",
    endAt: "2026-09-24T01:00:00.000Z",
    allDay: false,
    shareWithPartner: false
  };
  assert.throws(() => validateEventPayload(invalidRange), OrganizerValidationError);
  assert.throws(
    () => validateTimeBlockPayload({ taskId: "task", title: "作業", startAt: invalidRange.startAt, endAt: invalidRange.endAt }),
    OrganizerValidationError
  );
});

test("routine weekdays must be unique values from Sunday 0 through Saturday 6", () => {
  const routine = validateRoutinePayload({
    title: "English",
    category: "life",
    estimatedMinutes: 20,
    daysOfWeek: [1, 3, 3, 5],
    active: true
  });
  assert.equal(routine.daysOfWeek, "[1,3,5]");
  assert.throws(
    () => validateRoutinePayload({ title: "x", category: "life", estimatedMinutes: 10, daysOfWeek: [7] }),
    OrganizerValidationError
  );
});

test("overlapping planner items receive separate columns", () => {
  const layout = layoutTimelineItems([
    { id: "a", start: 540, end: 600 },
    { id: "b", start: 570, end: 630 },
    { id: "c", start: 660, end: 720 }
  ]);
  assert.equal(layout.find((item) => item.id === "a")?.columnCount, 2);
  assert.equal(layout.find((item) => item.id === "b")?.column, 1);
  assert.equal(layout.find((item) => item.id === "c")?.columnCount, 1);
});

