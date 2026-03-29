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

function splitCsv(value: string | undefined, fallback: string[]) {
  const tokens = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return tokens.length > 0 ? tokens : fallback;
}

export const APP_CONFIG = {
  databasePath: resolveSqlitePath(),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  fetchSecret: process.env.FETCH_SECRET || "",
  haSecret: process.env.HA_SECRET || "",
  haHomeUri: process.env.HA_HOME_URI || "/dashboard-mobile/home",
  haExpenseUri: process.env.HA_EXPENSE_URI || "/dashboard-mobile/expense",
  haTaskUri: process.env.HA_TASK_URI || "/dashboard-mobile/tasks",
  haNewsUri: process.env.HA_NEWS_URI || "/dashboard-mobile/news",
  haWeeklyReviewUri:
    process.env.HA_WEEKLY_REVIEW_URI || `${process.env.APP_BASE_URL || "http://localhost:3000"}/review/week`,
  immichBaseUrl: process.env.IMMICH_BASE_URL || process.env.NEXT_PUBLIC_IMMICH_URL || "",
  immichApiKey: process.env.IMMICH_API_KEY || "",
  openAiApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API || "",
  newsApiKey: process.env.NEWS_API_KEY || "",
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  totalRequestedDefault: 30,
  daysDefault: 1
};
