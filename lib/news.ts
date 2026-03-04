import crypto from "node:crypto";
import Parser from "rss-parser";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const DEFAULT_NEWS_KEYWORDS = ["半導体", "AI", "テック"];
const DEFAULT_FEED_URLS = [
  "https://gigazine.net/news/rss_2.0/",
  "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
  "https://www.publickey1.jp/atom.xml",
  "https://semiengineering.com/feed/",
  "http://feeds.arstechnica.com/arstechnica/index",
  "https://www.marktechpost.com/feed/"
];
const DEFAULT_MAX_ITEMS_PER_FEED = 120;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 5;
const MAX_SCAN_LIMIT = 2000;
const MIN_SCAN_LIMIT = 50;

export type NewsPreferences = {
  keywords: string[];
  feedUrls: string[];
  maxItemsPerFeed: number;
  defaultPageSize: number;
  preferJapanese: boolean;
};

export type SearchNewsInput = {
  query?: string;
  from?: Date | null;
  to?: Date | null;
  page?: number;
  pageSize?: number;
  scanLimit?: number;
};

type ParsedItem = {
  feedUrl: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  dedupHash: string;
};

type NewsPreferencesRow = {
  keywords: string;
  feedUrls: string;
  maxItemsPerFeed: number;
  defaultPageSize: number;
  preferJapanese: number;
};

const parser = new Parser();
let newsSchemaReady: Promise<void> | null = null;

function splitByDelimiters(value: string): string[] {
  return value
    .split(/[\n,、\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function containsJapanese(text: string): boolean {
  return /[ぁ-んァ-ン一-龠々]/.test(text);
}

function normalizeKeywords(raw: string[] | string | undefined): string[] {
  if (!raw) {
    return DEFAULT_NEWS_KEYWORDS;
  }

  const tokens = Array.isArray(raw)
    ? raw.flatMap((value) => splitByDelimiters(value))
    : splitByDelimiters(raw);

  return tokens.length > 0 ? uniqueTokens(tokens) : DEFAULT_NEWS_KEYWORDS;
}

function normalizeFeedUrls(raw: string[] | string | undefined): string[] {
  const fromEnv = process.env.NEWS_FEEDS
    ? splitByDelimiters(process.env.NEWS_FEEDS)
    : DEFAULT_FEED_URLS;

  if (!raw) {
    return fromEnv;
  }

  const urls = Array.isArray(raw)
    ? raw.flatMap((value) => splitByDelimiters(value))
    : splitByDelimiters(raw);

  return urls.length > 0 ? uniqueTokens(urls) : fromEnv;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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

function parseList(raw: string): string[] {
  return normalizeKeywords(raw).filter(Boolean);
}

function toPreferences(row: NewsPreferencesRow): NewsPreferences {
  return {
    keywords: parseList(row.keywords),
    feedUrls: normalizeFeedUrls(row.feedUrls),
    maxItemsPerFeed: clamp(row.maxItemsPerFeed, 20, 300),
    defaultPageSize: clamp(row.defaultPageSize, MIN_PAGE_SIZE, MAX_PAGE_SIZE),
    preferJapanese: row.preferJapanese === 1
  };
}

async function ensureNewsSchema() {
  if (newsSchemaReady) {
    return newsSchemaReady;
  }

  newsSchemaReady = (async () => {
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

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NewsPreferences" (
        "id" INTEGER NOT NULL PRIMARY KEY CHECK("id" = 1),
        "keywords" TEXT NOT NULL,
        "feedUrls" TEXT NOT NULL,
        "maxItemsPerFeed" INTEGER NOT NULL DEFAULT 120,
        "defaultPageSize" INTEGER NOT NULL DEFAULT 20,
        "preferJapanese" INTEGER NOT NULL DEFAULT 1,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  })();

  return newsSchemaReady;
}

export async function getNewsPreferences(): Promise<NewsPreferences> {
  await ensureNewsSchema();

  const rows = await prisma.$queryRaw<NewsPreferencesRow[]>`
    SELECT keywords, feedUrls, maxItemsPerFeed, defaultPageSize, preferJapanese
    FROM "NewsPreferences"
    WHERE id = 1
    LIMIT 1
  `;

  if (rows.length > 0) {
    return toPreferences(rows[0]);
  }

  const keywords = normalizeKeywords(undefined).join(",");
  const feedUrls = normalizeFeedUrls(undefined).join("\n");

  await prisma.$executeRaw`
    INSERT INTO "NewsPreferences" (
      id, keywords, feedUrls, maxItemsPerFeed, defaultPageSize, preferJapanese
    ) VALUES (
      1, ${keywords}, ${feedUrls}, ${DEFAULT_MAX_ITEMS_PER_FEED}, ${DEFAULT_PAGE_SIZE}, 1
    )
  `;

  return {
    keywords: normalizeKeywords(undefined),
    feedUrls: normalizeFeedUrls(undefined),
    maxItemsPerFeed: DEFAULT_MAX_ITEMS_PER_FEED,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    preferJapanese: true
  };
}

export async function updateNewsPreferences(input: {
  keywords?: string;
  feedUrls?: string;
  maxItemsPerFeed?: number;
  defaultPageSize?: number;
  preferJapanese?: boolean;
}) {
  const current = await getNewsPreferences();

  const keywords = normalizeKeywords(input.keywords ?? current.keywords).join(",");
  const feedUrls = normalizeFeedUrls(input.feedUrls ?? current.feedUrls).join("\n");
  const maxItemsPerFeed = clamp(
    input.maxItemsPerFeed ?? current.maxItemsPerFeed,
    20,
    300
  );
  const defaultPageSize = clamp(
    input.defaultPageSize ?? current.defaultPageSize,
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const preferJapanese = input.preferJapanese ?? current.preferJapanese;

  await prisma.$executeRaw`
    INSERT INTO "NewsPreferences" (
      id, keywords, feedUrls, maxItemsPerFeed, defaultPageSize, preferJapanese, updatedAt
    ) VALUES (
      1,
      ${keywords},
      ${feedUrls},
      ${maxItemsPerFeed},
      ${defaultPageSize},
      ${preferJapanese ? 1 : 0},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      keywords = excluded.keywords,
      feedUrls = excluded.feedUrls,
      maxItemsPerFeed = excluded.maxItemsPerFeed,
      defaultPageSize = excluded.defaultPageSize,
      preferJapanese = excluded.preferJapanese,
      updatedAt = CURRENT_TIMESTAMP
  `;

  return getNewsPreferences();
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return true;
  }

  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
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
  matchedByKeyword: number;
}> {
  const preferences = await getNewsPreferences();
  const feedUrls = preferences.feedUrls;

  if (feedUrls.length === 0) {
    throw new Error("No feed URL configured. Update News settings first.");
  }

  const parsedPerFeed = await Promise.all(feedUrls.map((feedUrl) => parseFeed(feedUrl)));
  const limitedItems = parsedPerFeed.flatMap((items) =>
    items.slice(0, preferences.maxItemsPerFeed)
  );

  const filteredItems = limitedItems.filter((item) => {
    const target = `${item.title}\n${item.summary ?? ""}`;
    return matchesAnyKeyword(target, preferences.keywords);
  });

  const uniqueItems = Array.from(
    new Map(filteredItems.map((item) => [item.dedupHash, item])).values()
  );
  const existingHashes = new Set<string>();
  const chunks = chunkArray(
    uniqueItems.map((item) => item.dedupHash),
    300
  );

  for (const dedupHashChunk of chunks) {
    const existingRows = await prisma.newsItem.findMany({
      where: { dedupHash: { in: dedupHashChunk } },
      select: { dedupHash: true }
    });

    for (const row of existingRows) {
      existingHashes.add(row.dedupHash);
    }
  }

  for (const item of uniqueItems) {
    await prisma.newsItem.upsert({
      where: { dedupHash: item.dedupHash },
      update: {
        summary: item.summary,
        publishedAt: item.publishedAt
      },
      create: item
    });
  }

  return {
    inserted: uniqueItems.length - existingHashes.size,
    totalFetched: limitedItems.length,
    matchedByKeyword: filteredItems.length
  };
}

export async function searchNews(input: SearchNewsInput) {
  await ensureNewsSchema();
  const preferences = await getNewsPreferences();

  const page = Math.max(1, input.page ?? 1);
  const pageSize = clamp(input.pageSize ?? preferences.defaultPageSize, MIN_PAGE_SIZE, MAX_PAGE_SIZE);
  const scanLimit = clamp(input.scanLimit ?? 500, MIN_SCAN_LIMIT, MAX_SCAN_LIMIT);

  const fallbackQuery = preferences.keywords.join(" ");
  const appliedQuery = input.query?.trim() ? input.query.trim() : fallbackQuery;
  const queryTerms = uniqueTokens(splitByDelimiters(appliedQuery));

  const where: Prisma.NewsItemWhereInput = {};

  if (input.from || input.to) {
    where.publishedAt = {
      gte: input.from ?? undefined,
      lte: input.to ?? undefined
    };
  }

  const baseItems = await prisma.newsItem.findMany({
    where,
    take: scanLimit,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });

  let filtered = baseItems;

  if (queryTerms.length > 0) {
    filtered = baseItems.filter((item) => {
      const text = `${item.title}\n${item.summary ?? ""}`;
      return matchesAnyKeyword(text, queryTerms);
    });
  }

  if (preferences.preferJapanese) {
    filtered = [...filtered].sort((a, b) => {
      const aJa = containsJapanese(`${a.title}\n${a.summary ?? ""}`) ? 1 : 0;
      const bJa = containsJapanese(`${b.title}\n${b.summary ?? ""}`) ? 1 : 0;
      if (aJa !== bJa) {
        return bJa - aJa;
      }
      return 0;
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    items: filtered.slice(offset, offset + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    appliedQuery,
    preferences,
    scanLimit
  };
}
