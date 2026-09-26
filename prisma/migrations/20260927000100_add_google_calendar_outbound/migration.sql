-- Outbound-managed identity is opt-in. Existing Google imports remain protected.
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleOutboundManaged" BOOLEAN NOT NULL DEFAULT false CHECK ("googleOutboundManaged" IN (0, 1));
ALTER TABLE "OrganizerEvent" ADD COLUMN "googleOutboundBaseHash" TEXT;

CREATE INDEX "OrganizerEvent_googleOutboundManaged_googleCalendarId_idx"
  ON "OrganizerEvent"("googleOutboundManaged", "googleCalendarId");

-- A tombstone retains the exact remote identity after an outbound-managed local
-- event is deleted. Local-only and inbound-owned events never create this row.
CREATE TABLE "GoogleCalendarOutboundDeletion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizerEventId" TEXT NOT NULL,
  "googleCalendarId" TEXT NOT NULL,
  "googleCalendarEventId" TEXT NOT NULL,
  "googleEtag" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('university', 'work', 'entertainment', 'life')),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'deleted')),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME
);

CREATE UNIQUE INDEX "GoogleCalendarOutboundDeletion_organizerEventId_key"
  ON "GoogleCalendarOutboundDeletion"("organizerEventId");
CREATE UNIQUE INDEX "GoogleCalendarOutboundDeletion_googleCalendarId_googleCalendarEventId_key"
  ON "GoogleCalendarOutboundDeletion"("googleCalendarId", "googleCalendarEventId");
CREATE INDEX "GoogleCalendarOutboundDeletion_status_category_idx"
  ON "GoogleCalendarOutboundDeletion"("status", "category");
