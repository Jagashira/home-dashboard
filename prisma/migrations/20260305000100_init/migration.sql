-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "publishedAt" DATETIME,
    "dedupHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_dedupHash_key" ON "NewsItem"("dedupHash");

-- CreateIndex
CREATE INDEX "NewsItem_createdAt_idx" ON "NewsItem"("createdAt");
