-- The Organizer tables intentionally coexist with the legacy Task and CalendarEvent tables.
-- Date-only values are stored as YYYY-MM-DD TEXT. DateTime values are stored as UTC instants.

CREATE TABLE "OrganizerTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL CHECK ("category" IN ('university', 'work', 'entertainment', 'life')),
    "status" TEXT NOT NULL DEFAULT 'inbox' CHECK ("status" IN ('inbox', 'planned', 'doing', 'completed', 'cancelled')),
    "importance" INTEGER NOT NULL DEFAULT 2 CHECK ("importance" IN (1, 2, 3)),
    "estimatedMinutes" INTEGER CHECK ("estimatedMinutes" IS NULL OR "estimatedMinutes" > 0),
    "targetDate" TEXT CHECK ("targetDate" IS NULL OR (length("targetDate") = 10 AND substr("targetDate", 5, 1) = '-' AND substr("targetDate", 8, 1) = '-')),
    "dueDate" TEXT CHECK ("dueDate" IS NULL OR (length("dueDate") = 10 AND substr("dueDate", 5, 1) = '-' AND substr("dueDate", 8, 1) = '-')),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

CREATE TABLE "OrganizerEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL CHECK ("category" IN ('university', 'work', 'entertainment', 'life')),
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false CHECK ("allDay" IN (0, 1)),
    "location" TEXT,
    "shareWithPartner" BOOLEAN NOT NULL DEFAULT false CHECK ("shareWithPartner" IN (0, 1)),
    "googleCalendarEventId" TEXT,
    "timetreeEventId" TEXT,
    "timetreeSyncStatus" TEXT NOT NULL DEFAULT 'not_requested' CHECK ("timetreeSyncStatus" IN ('not_requested', 'pending', 'synced', 'error')),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CHECK ("endAt" > "startAt")
);

CREATE TABLE "OrganizerTimeBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned' CHECK ("status" IN ('planned', 'doing', 'completed', 'skipped')),
    "actualStartAt" DATETIME,
    "actualEndAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizerTimeBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OrganizerTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK ("endAt" > "startAt"),
    CHECK ("actualStartAt" IS NULL OR "actualEndAt" IS NULL OR "actualEndAt" > "actualStartAt")
);

CREATE TABLE "OrganizerRoutine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL CHECK ("category" IN ('university', 'work', 'entertainment', 'life')),
    "estimatedMinutes" INTEGER NOT NULL CHECK ("estimatedMinutes" > 0),
    "daysOfWeek" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true CHECK ("active" IN (0, 1)),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "OrganizerRoutineCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "date" TEXT NOT NULL CHECK (length("date") = 10 AND substr("date", 5, 1) = '-' AND substr("date", 8, 1) = '-'),
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizerRoutineCompletion_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "OrganizerRoutine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrganizerTask_status_idx" ON "OrganizerTask"("status");
CREATE INDEX "OrganizerTask_targetDate_idx" ON "OrganizerTask"("targetDate");
CREATE INDEX "OrganizerTask_dueDate_idx" ON "OrganizerTask"("dueDate");
CREATE INDEX "OrganizerTask_category_status_idx" ON "OrganizerTask"("category", "status");

CREATE UNIQUE INDEX "OrganizerEvent_googleCalendarEventId_key" ON "OrganizerEvent"("googleCalendarEventId");
CREATE UNIQUE INDEX "OrganizerEvent_timetreeEventId_key" ON "OrganizerEvent"("timetreeEventId");
CREATE INDEX "OrganizerEvent_startAt_idx" ON "OrganizerEvent"("startAt");
CREATE INDEX "OrganizerEvent_endAt_idx" ON "OrganizerEvent"("endAt");
CREATE INDEX "OrganizerEvent_startAt_endAt_idx" ON "OrganizerEvent"("startAt", "endAt");
CREATE INDEX "OrganizerEvent_shareWithPartner_timetreeSyncStatus_idx" ON "OrganizerEvent"("shareWithPartner", "timetreeSyncStatus");

CREATE INDEX "OrganizerTimeBlock_taskId_idx" ON "OrganizerTimeBlock"("taskId");
CREATE INDEX "OrganizerTimeBlock_startAt_idx" ON "OrganizerTimeBlock"("startAt");
CREATE INDEX "OrganizerTimeBlock_endAt_idx" ON "OrganizerTimeBlock"("endAt");
CREATE INDEX "OrganizerTimeBlock_taskId_startAt_idx" ON "OrganizerTimeBlock"("taskId", "startAt");

CREATE INDEX "OrganizerRoutine_active_idx" ON "OrganizerRoutine"("active");
CREATE INDEX "OrganizerRoutine_category_active_idx" ON "OrganizerRoutine"("category", "active");

CREATE UNIQUE INDEX "OrganizerRoutineCompletion_routineId_date_key" ON "OrganizerRoutineCompletion"("routineId", "date");
CREATE INDEX "OrganizerRoutineCompletion_date_idx" ON "OrganizerRoutineCompletion"("date");
CREATE INDEX "OrganizerRoutineCompletion_routineId_date_idx" ON "OrganizerRoutineCompletion"("routineId", "date");
