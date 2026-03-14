export const APP_CONFIG = {
  databasePath: process.env.DATABASE_URL?.replace(/^file:/, "") || "./data/news-aggregator.db",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  fetchSecret: process.env.FETCH_SECRET || "",
  openAiApiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API || "",
  newsApiKey: process.env.NEWS_API_KEY || "",
  totalRequestedDefault: 30,
  daysDefault: 1
};

