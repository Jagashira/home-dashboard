import { getDb } from "./db";

export function initSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      allocation_percent INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      config_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fetch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      total_requested INTEGER NOT NULL,
      total_fetched INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      fetch_run_id INTEGER NOT NULL,
      external_id TEXT,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      source_label TEXT NOT NULL,
      published_at TEXT,
      fetched_at TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      language TEXT,
      is_japanese INTEGER NOT NULL DEFAULT 0,
      score REAL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_requested INTEGER NOT NULL DEFAULT 30,
      days INTEGER NOT NULL DEFAULT 1,
      prefer_japanese INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type);
    CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id);
    CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
    CREATE INDEX IF NOT EXISTS idx_articles_is_japanese ON articles(is_japanese);
    CREATE INDEX IF NOT EXISTS idx_articles_is_hidden ON articles(is_hidden);
    CREATE INDEX IF NOT EXISTS idx_articles_is_favorite ON articles(is_favorite);
  `);

  const columns = db.prepare("PRAGMA table_info(articles)").all() as Array<{ name: string }>;
  const hasIsHidden = columns.some((c) => c.name === "is_hidden");
  const hasIsFavorite = columns.some((c) => c.name === "is_favorite");
  if (!hasIsHidden) {
    db.exec(`ALTER TABLE articles ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!hasIsFavorite) {
    db.exec(`ALTER TABLE articles ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;`);
  }
}

export function seedDefaults() {
  const db = getDb();
  const now = new Date().toISOString();

  const topicsCount = db.prepare("SELECT COUNT(*) as c FROM topics").get() as { c: number };
  if (topicsCount.c === 0) {
    const insertTopic = db.prepare(`
      INSERT INTO topics(name, query, is_active, allocation_percent, display_order, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `);
    insertTopic.run("半導体", "半導体 日本 最新", 34, 1, now, now);
    insertTopic.run("AI", "AI 日本 最新", 33, 2, now, now);
    insertTopic.run("テック", "テック 日本 最新", 33, 3, now, now);
  }

  const insertSource = db.prepare(`
    INSERT OR IGNORE INTO sources(source_type, source_name, is_active, config_json, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `);
  insertSource.run(
    "rss",
    "RSS",
    JSON.stringify({
      feeds: [
        "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
        "https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf",
        "https://ascii.jp/rss.xml",
        "https://jp.techcrunch.com/feed/"
      ]
    }),
    now,
    now
  );
  insertSource.run("gdelt", "GDELT", JSON.stringify({}), now, now);
  insertSource.run("hackernews", "Hacker News", JSON.stringify({}), now, now);
  insertSource.run("newsapi", "NewsAPI", JSON.stringify({}), now, now);
  insertSource.run("youtube", "YouTube", JSON.stringify({}), now, now);
  insertSource.run("reddit", "Reddit", JSON.stringify({}), now, now);

  db.prepare(
    `
    INSERT INTO app_settings(id, total_requested, days, prefer_japanese, updated_at)
    VALUES (1, 30, 1, 1, ?)
    ON CONFLICT(id) DO NOTHING
  `
  ).run(now);
}
