-- Google Calendar is an inbound-only source. This migration adds import identity,
-- preview/run state, and a per-calendar cursor without changing legacy tables.

DROP INDEX IF EXISTS "OrganizerEvent_googleCalendarEventId_key";

ALTER TABLE "OrganizerEvent" ADD COLUMN "googleCalendarId" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleEtag" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleUpdatedAt" DATETIME;
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleSyncStatus" TEXT NOT NULL DEFAULT 'local_only' CHECK ("googleSyncStatus" IN ('local_only', 'imported', 'updated', 'cancelled', 'error'));
ALTER TABLE "OrganizerEvent" ADD COLUMN "lastSyncedAt" DATETIME;
ALTER TABLE "OrganizerEvent" ADD COLUMN "lastSyncedHash" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "eventTimeZone" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleRecurringEventId" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "originalStartTime" DATETIME;
ALTER TABLE "OrganizerEvent" ADD COLUMN "originalStartDate" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleEventType" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleStatus" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "recurrenceJson" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "startDate" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "endDateExclusive" TEXT;

CREATE UNIQUE INDEX "OrganizerEvent_googleCalendarId_googleCalendarEventId_key"
  ON "OrganizerEvent"("googleCalendarId", "googleCalendarEventId");
CREATE INDEX "OrganizerEvent_googleCalendarId_googleSyncStatus_idx"
  ON "OrganizerEvent"("googleCalendarId", "googleSyncStatus");

CREATE TABLE "GoogleCalendarMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "googleCalendarId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "accessRole" TEXT NOT NULL,
  "timeZone" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true CHECK ("enabled" IN (0, 1)),
  "importCompletedAt" DATETIME,
  "outboundEnabledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "GoogleCalendarMapping_category_key" ON "GoogleCalendarMapping"("category");
CREATE UNIQUE INDEX "GoogleCalendarMapping_googleCalendarId_key" ON "GoogleCalendarMapping"("googleCalendarId");

CREATE TABLE "GoogleCalendarSyncCursor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "googleCalendarId" TEXT NOT NULL,
  "syncToken" TEXT NOT NULL,
  "lastFullSyncAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "GoogleCalendarSyncCursor_googleCalendarId_key" ON "GoogleCalendarSyncCursor"("googleCalendarId");

CREATE TABLE "GoogleCalendarSyncRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('preview', 'apply')),
  "status" TEXT NOT NULL CHECK ("status" IN ('running', 'preview_ready', 'blocked', 'applied', 'failed', 'expired')),
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "previewExpiresAt" DATETIME,
  "confirmationTokenHash" TEXT,
  "fingerprint" TEXT,
  "summaryJson" TEXT NOT NULL,
  "blockingIssueCount" INTEGER NOT NULL DEFAULT 0,
  "googleWriteCount" INTEGER NOT NULL DEFAULT 0 CHECK ("googleWriteCount" = 0),
  "errorMessage" TEXT
);
CREATE INDEX "GoogleCalendarSyncRun_startedAt_idx" ON "GoogleCalendarSyncRun"("startedAt");
CREATE INDEX "GoogleCalendarSyncRun_status_idx" ON "GoogleCalendarSyncRun"("status");

CREATE TABLE "GoogleCalendarSyncRunCalendar" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "googleCalendarId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "warnings" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "pages" INTEGER NOT NULL DEFAULT 0,
  "nextSyncToken" TEXT,
  CONSTRAINT "GoogleCalendarSyncRunCalendar_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GoogleCalendarSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GoogleCalendarSyncRunCalendar_runId_googleCalendarId_key" ON "GoogleCalendarSyncRunCalendar"("runId", "googleCalendarId");
CREATE INDEX "GoogleCalendarSyncRunCalendar_googleCalendarId_idx" ON "GoogleCalendarSyncRunCalendar"("googleCalendarId");

CREATE TABLE "GoogleCalendarImportItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "googleCalendarId" TEXT NOT NULL,
  "googleEventId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "duplicateCandidate" BOOLEAN NOT NULL DEFAULT false CHECK ("duplicateCandidate" IN (0, 1)),
  CONSTRAINT "GoogleCalendarImportItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GoogleCalendarSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GoogleCalendarImportItem_runId_googleCalendarId_googleEventId_key"
  ON "GoogleCalendarImportItem"("runId", "googleCalendarId", "googleEventId");
CREATE INDEX "GoogleCalendarImportItem_googleCalendarId_googleEventId_idx"
  ON "GoogleCalendarImportItem"("googleCalendarId", "googleEventId");
