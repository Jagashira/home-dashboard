-- CreateTable
CREATE TABLE "JobEssay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobEssay_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "JobCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "JobSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "storagePath" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "JobCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "JobTimeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobTimeline_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "JobCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "JobEssay_companyId_createdAt_idx" ON "JobEssay"("companyId", "createdAt");
CREATE INDEX "JobSubmission_companyId_createdAt_idx" ON "JobSubmission"("companyId", "createdAt");
CREATE INDEX "JobSubmission_status_idx" ON "JobSubmission"("status");
CREATE INDEX "JobTimeline_companyId_eventDate_idx" ON "JobTimeline"("companyId", "eventDate");
CREATE INDEX "JobTimeline_status_idx" ON "JobTimeline"("status");
