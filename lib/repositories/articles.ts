import { getDb } from "@/lib/db";

export type ArticleListRow = {
  id: number;
  title: string;
  url: string;
  source_label: string;
  source_type: string;
  published_at: string | null;
  topic_name: string;
  summary: string | null;
  content: string | null;
  language: string | null;
  is_japanese: number;
  score: number | null;
  is_hidden: number;
  is_favorite: number;
};

export function insertArticle(input: {
  topicId: number;
  sourceId: number;
  fetchRunId: number;
  externalId?: string | null;
  title: string;
  url: string;
  sourceLabel: string;
  publishedAt?: string | null;
  fetchedAt: string;
  content?: string | null;
  summary?: string | null;
  language: string;
  isJapanese: boolean;
  score?: number | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .prepare(
      `
      INSERT OR IGNORE INTO articles(
        topic_id, source_id, fetch_run_id, external_id, title, url, source_label,
        published_at, fetched_at, content, summary, language, is_japanese, score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      input.topicId,
      input.sourceId,
      input.fetchRunId,
      input.externalId ?? null,
      input.title,
      input.url,
      input.sourceLabel,
      input.publishedAt ?? null,
      input.fetchedAt,
      input.content ?? null,
      input.summary,
      input.language,
      input.isJapanese ? 1 : 0,
      input.score ?? null,
      now,
      now
    );
}

export function listArticles(filters?: {
  topic?: string;
  sourceType?: string;
  date?: string;
  includeHidden?: boolean;
  onlyHidden?: boolean;
  onlyFavorite?: boolean;
  limit?: number;
}): ArticleListRow[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters?.topic) {
    where.push("t.name = ?");
    params.push(filters.topic);
  }
  if (filters?.sourceType) {
    where.push("s.source_type = ?");
    params.push(filters.sourceType);
  }
  if (filters?.date) {
    where.push("date(a.published_at) = ?");
    params.push(filters.date);
  }
  if (filters?.onlyHidden) {
    where.push("a.is_hidden = 1");
  } else if (!filters?.includeHidden) {
    where.push("a.is_hidden = 0");
  }
  if (filters?.onlyFavorite) {
    where.push("a.is_favorite = 1");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = filters?.limit ?? 200;

  return db
    .prepare(
      `
      SELECT
        a.id, a.title, a.url, a.source_label, a.published_at, a.summary, a.content,
        a.language, a.is_japanese, a.score, a.is_hidden, a.is_favorite, t.name as topic_name, s.source_type
      FROM articles a
      JOIN topics t ON t.id = a.topic_id
      JOIN sources s ON s.id = a.source_id
      ${whereSql}
      ORDER BY a.is_japanese DESC, a.published_at DESC, a.id DESC
      LIMIT ?
    `
    )
    .all(...params, limit) as ArticleListRow[];
}

export function getArticleById(id: number): ArticleListRow | undefined {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        a.id, a.title, a.url, a.source_label, a.published_at, a.summary, a.content,
        a.language, a.is_japanese, a.score, a.is_hidden, a.is_favorite, t.name as topic_name, s.source_type
      FROM articles a
      JOIN topics t ON t.id = a.topic_id
      JOIN sources s ON s.id = a.source_id
      WHERE a.id = ?
      LIMIT 1
    `
    )
    .get(id) as ArticleListRow | undefined;
}

export function setArticleFavorite(id: number, favorite: boolean) {
  const db = getDb();
  const result = db
    .prepare("UPDATE articles SET is_favorite=?, updated_at=? WHERE id=?")
    .run(favorite ? 1 : 0, new Date().toISOString(), id);
  return Number(result.changes ?? 0) > 0;
}

export function setArticleHidden(id: number, hidden: boolean) {
  const db = getDb();
  const result = db
    .prepare("UPDATE articles SET is_hidden=?, updated_at=? WHERE id=?")
    .run(hidden ? 1 : 0, new Date().toISOString(), id);
  return Number(result.changes ?? 0) > 0;
}

export function countBySourceForLatestRun(fetchRunId: number): Array<{ source_type: string; count: number }> {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT s.source_type, COUNT(*) as count
      FROM articles a
      JOIN sources s ON s.id = a.source_id
      WHERE a.fetch_run_id = ?
      GROUP BY s.source_type
    `
    )
    .all(fetchRunId) as Array<{ source_type: string; count: number }>;
}
