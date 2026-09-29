ALTER TABLE "OrganizerEvent" ADD COLUMN "timetreeCalendarId" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "timetreeEventUrl" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "timetreeBaseHash" TEXT;
ALTER TABLE "OrganizerEvent" ADD COLUMN "timetreeLastSyncedAt" DATETIME;

CREATE TABLE "TimeTreeCalendarMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "calendarName" TEXT NOT NULL,
  "calendarId" TEXT,
  "calendarUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true CHECK ("enabled" IN (0, 1)),
  "outboundEnabledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TimeTreeCalendarMapping_calendarName_key" ON "TimeTreeCalendarMapping"("calendarName");
CREATE UNIQUE INDEX "TimeTreeCalendarMapping_calendarId_key" ON "TimeTreeCalendarMapping"("calendarId");

CREATE TABLE "TimeTreeOutboundOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizerEventId" TEXT NOT NULL,
  "action" TEXT NOT NULL CHECK ("action" IN ('create', 'update', 'delete')),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'processing', 'retry_wait', 'reconcile_required', 'conflict', 'failed', 'succeeded')),
  "idempotencyKey" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "desiredHash" TEXT,
  "timetreeCalendarId" TEXT,
  "timetreeEventId" TEXT,
  "timetreeEventUrl" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME,
  "leaseOwner" TEXT,
  "leaseExpiresAt" DATETIME,
  "saveAttemptedAt" DATETIME,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME
);
CREATE UNIQUE INDEX "TimeTreeOutboundOperation_organizerEventId_key" ON "TimeTreeOutboundOperation"("organizerEventId");
CREATE UNIQUE INDEX "TimeTreeOutboundOperation_idempotencyKey_key" ON "TimeTreeOutboundOperation"("idempotencyKey");
CREATE INDEX "TimeTreeOutboundOperation_status_nextAttemptAt_idx" ON "TimeTreeOutboundOperation"("status", "nextAttemptAt");
CREATE INDEX "TimeTreeOutboundOperation_action_status_idx" ON "TimeTreeOutboundOperation"("action", "status");
