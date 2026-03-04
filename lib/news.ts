import crypto from "node:crypto";
import Parser from "rss-parser";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type ParsedItem = {
  feedUrl: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  dedupHash: string;
};

const parser = new Parser();
let newsTableReady: Promise<void> | null = null;

async function ensureNewsTable() {
  if (newsTableReady) {
    return newsTableReady;
  }

  newsTableReady = (async () => {
    // Critical startup safety: self-heal local SQLite when migration was not run yet.
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NewsItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "feedUrl" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "summary" TEXT,
        "publishedAt" DATETIME,
        "dedupHash" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_dedupHash_key" ON "NewsItem"("dedupHash");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "NewsItem_createdAt_idx" ON "NewsItem"("createdAt");
    `);
  })();

  return newsTableReady;
}

export function getFeedUrls(): string[] {
  const rawFeeds = process.env.NEWS_FEEDS ?? "";

  return rawFeeds
    .split(",")
    .map((feed) => feed.trim())
    .filter(Boolean);
}

function parseItemDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDedupHash(url: string, title: string): string {
  // Critical dedup logic: keep a stable hash from URL + title to avoid duplicate rows.
  return crypto.createHash("sha256").update(`${url}::${title}`).digest("hex");
}

async function parseFeed(feedUrl: string): Promise<ParsedItem[]> {
  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? [])
    .map((item) => {
      const title = item.title?.trim() ?? "";
      const url = item.link?.trim() ?? "";

      if (!title || !url) {
        return null;
      }

      return {
        feedUrl,
        title,
        url,
        summary: item.contentSnippet?.trim() || item.content?.trim() || null,
        publishedAt: parseItemDate(item.isoDate ?? item.pubDate),
        dedupHash: buildDedupHash(url, title)
      } satisfies ParsedItem;
    })
    .filter((item): item is ParsedItem => item !== null);
}

export async function refreshNewsFromFeeds(): Promise<{
  inserted: number;
  totalFetched: number;
}> {
  await ensureNewsTable();

  const feedUrls = getFeedUrls();

  if (feedUrls.length === 0) {
    throw new Error("NEWS_FEEDS is empty. Add at least one RSS feed URL.");
  }

  const parsedPerFeed = await Promise.all(feedUrls.map((feedUrl) => parseFeed(feedUrl)));
  const items = parsedPerFeed.flat();

  let inserted = 0;

  for (const item of items) {
    try {
      await prisma.newsItem.create({ data: item });
      inserted += 1;
    } catch (error) {
      // If unique hash already exists, update mutable fields and keep going.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        await prisma.newsItem.update({
          where: { dedupHash: item.dedupHash },
          data: {
            summary: item.summary,
            publishedAt: item.publishedAt
          }
        });
        continue;
      }

      throw error;
    }
  }

  return {
    inserted,
    totalFetched: items.length
  };
}

export async function getLatestNews(limit = 50) {
  await ensureNewsTable();

  return prisma.newsItem.findMany({
    take: limit,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });
}
