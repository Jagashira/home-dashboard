import { getDb } from "./db";
import { DEFAULT_NEWS_TOPICS, DEFAULT_RSS_FEEDS, dedupeFeedUrls } from "./news-defaults";

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
      semiconductor_analysis TEXT,
      semiconductor_analysis_model TEXT,
      semiconductor_analysis_cost_usd REAL,
      semiconductor_analysis_cost_jpy REAL,
      semiconductor_analyzed_at TEXT,
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
  `);

  const columns = db.prepare("PRAGMA table_info(articles)").all() as Array<{ name: string }>;
  const hasIsHidden = columns.some((c) => c.name === "is_hidden");
  const hasIsFavorite = columns.some((c) => c.name === "is_favorite");
  const hasSemiconductorAnalysis = columns.some((c) => c.name === "semiconductor_analysis");
  const hasSemiconductorAnalysisModel = columns.some((c) => c.name === "semiconductor_analysis_model");
  const hasSemiconductorAnalysisCostUsd = columns.some((c) => c.name === "semiconductor_analysis_cost_usd");
  const hasSemiconductorAnalysisCostJpy = columns.some((c) => c.name === "semiconductor_analysis_cost_jpy");
  const hasSemiconductorAnalyzedAt = columns.some((c) => c.name === "semiconductor_analyzed_at");
  if (!hasIsHidden) {
    db.exec(`ALTER TABLE articles ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!hasIsFavorite) {
    db.exec(`ALTER TABLE articles ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!hasSemiconductorAnalysis) {
    db.exec(`ALTER TABLE articles ADD COLUMN semiconductor_analysis TEXT;`);
  }
  if (!hasSemiconductorAnalysisModel) {
    db.exec(`ALTER TABLE articles ADD COLUMN semiconductor_analysis_model TEXT;`);
  }
  if (!hasSemiconductorAnalysisCostUsd) {
    db.exec(`ALTER TABLE articles ADD COLUMN semiconductor_analysis_cost_usd REAL;`);
  }
  if (!hasSemiconductorAnalysisCostJpy) {
    db.exec(`ALTER TABLE articles ADD COLUMN semiconductor_analysis_cost_jpy REAL;`);
  }
  if (!hasSemiconductorAnalyzedAt) {
    db.exec(`ALTER TABLE articles ADD COLUMN semiconductor_analyzed_at TEXT;`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_is_hidden ON articles(is_hidden);
    CREATE INDEX IF NOT EXISTS idx_articles_is_favorite ON articles(is_favorite);
  `);
}

export function seedDefaults() {
  const db = getDb();
  const now = new Date().toISOString();

  const topicRows = db
    .prepare("SELECT id, name FROM topics")
    .all() as Array<{ id: number; name: string }>;
  const topicByName = new Map(topicRows.map((row) => [row.name, row]));
  const insertTopic = db.prepare(`
    INSERT INTO topics(name, query, is_active, allocation_percent, display_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateTopic = db.prepare(`
    UPDATE topics
    SET name=?, query=?, is_active=?, allocation_percent=?, display_order=?, updated_at=?
    WHERE id=?
  `);

  const syncTopics = db.transaction(() => {
    const desiredNames = new Set(DEFAULT_NEWS_TOPICS.map((topic) => topic.name));

    for (const topic of DEFAULT_NEWS_TOPICS) {
      const existing =
        topicByName.get(topic.name) ??
        (topic.name === "社会人必須" ? topicByName.get("IT") ?? topicByName.get("テック") : undefined);

      if (existing) {
        updateTopic.run(
          topic.name,
          topic.query,
          topic.isActive === false ? 0 : 1,
          topic.allocationPercent,
          topic.displayOrder,
          now,
          existing.id
        );
        topicByName.set(topic.name, { id: existing.id, name: topic.name });
        continue;
      }

      const result = insertTopic.run(
        topic.name,
        topic.query,
        topic.isActive === false ? 0 : 1,
        topic.allocationPercent,
        topic.displayOrder,
        now,
        now
      );
      topicByName.set(topic.name, { id: Number(result.lastInsertRowid), name: topic.name });
    }

    for (const row of topicRows) {
      if (desiredNames.has(row.name)) continue;
      db.prepare(
        `
        UPDATE topics
        SET is_active=0, allocation_percent=0, updated_at=?
        WHERE id=?
      `
      ).run(now, row.id);
    }
  });
  syncTopics();

  const insertSource = db.prepare(`
    INSERT OR IGNORE INTO sources(source_type, source_name, is_active, config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const rssSource = db
    .prepare("SELECT id, is_active, config_json FROM sources WHERE source_type = ? LIMIT 1")
    .get("rss") as { id: number; is_active: number; config_json: string | null } | undefined;

  if (rssSource) {
    db.prepare(
      `
      UPDATE sources
      SET source_name=?, config_json=?, updated_at=?
      WHERE id=?
    `
    ).run(
      "RSS",
      JSON.stringify({ feeds: dedupeFeedUrls(DEFAULT_RSS_FEEDS) }),
      now,
      rssSource.id
    );
  } else {
    insertSource.run(
      "rss",
      "RSS",
      1,
      JSON.stringify({ feeds: DEFAULT_RSS_FEEDS }),
      now,
      now
    );
  }
  const desiredSources = [
    { sourceType: "gdelt", sourceName: "GDELT", isActive: true, configJson: JSON.stringify({}) },
    { sourceType: "hackernews", sourceName: "Hacker News", isActive: true, configJson: JSON.stringify({}) },
    { sourceType: "newsapi", sourceName: "NewsAPI", isActive: true, configJson: JSON.stringify({}) },
    { sourceType: "youtube", sourceName: "YouTube", isActive: false, configJson: JSON.stringify({}) },
    { sourceType: "reddit", sourceName: "Reddit", isActive: false, configJson: JSON.stringify({}) }
  ] as const;

  for (const source of desiredSources) {
    insertSource.run(
      source.sourceType,
      source.sourceName,
      source.isActive ? 1 : 0,
      source.configJson,
      now,
      now
    );
    db.prepare(
      `
      UPDATE sources
      SET source_name=?, is_active=?, config_json=?, updated_at=?
      WHERE source_type=?
    `
    ).run(
      source.sourceName,
      source.isActive ? 1 : 0,
      source.configJson,
      now,
      source.sourceType
    );
  }

  db.prepare(
    `
    INSERT INTO app_settings(id, total_requested, days, prefer_japanese, updated_at)
    VALUES (1, 30, 1, 1, ?)
    ON CONFLICT(id) DO NOTHING
  `
  ).run(now);
}
