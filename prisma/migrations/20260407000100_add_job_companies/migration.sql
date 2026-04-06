-- CreateTable
CREATE TABLE "JobCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "myPageUrl" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "JobCompany_displayOrder_idx" ON "JobCompany"("displayOrder");
CREATE INDEX "JobCompany_companyName_idx" ON "JobCompany"("companyName");
CREATE INDEX "JobCompany_status_idx" ON "JobCompany"("status");
