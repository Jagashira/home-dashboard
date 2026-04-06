CREATE TABLE "JobUsefulLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobUsefulLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "JobCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "JobUsefulLink_companyId_createdAt_idx" ON "JobUsefulLink"("companyId", "createdAt");
