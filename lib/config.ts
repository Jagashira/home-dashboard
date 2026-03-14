import path from "node:path";

function resolveSqlitePath() {
  const explicit = process.env.NEWS_DB_PATH?.trim();
  if (explicit) return explicit;

  const raw = process.env.DATABASE_URL?.replace(/^file:/, "").trim();
  if (!raw) return "./data/news-aggregator.db";

  // Prisma often uses file:../data/app.db (relative to prisma/schema.prisma).
  if (raw.startsWith("../")) {
    return path.resolve(process.cwd(), "prisma", raw);
  }
  return raw;
}

export const APP_CONFIG = {
  databasePath: resolveSqlitePath(),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  fetchSecret: process.env.FETCH_SECRET || "",
  openAiApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API || "",
  newsApiKey: process.env.NEWS_API_KEY || "",
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  totalRequestedDefault: 30,
  daysDefault: 1
};
