ALTER TABLE "OrganizerEvent" ADD COLUMN "timetreeBasePayloadJson" TEXT;
ALTER TABLE "TimeTreeOutboundOperation" ADD COLUMN "basePayloadJson" TEXT;
ALTER TABLE "TimeTreeOutboundOperation" ADD COLUMN "baseHash" TEXT;
