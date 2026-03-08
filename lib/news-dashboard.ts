import { prisma } from "@/lib/prisma";

const DEFAULT_TOPICS = [
  { name: "半導体", query: "半導体", allocationPercent: 40, displayOrder: 1 },
  { name: "AI", query: "AI", allocationPercent: 40, displayOrder: 2 },
  { name: "テック", query: "テック", allocationPercent: 20, displayOrder: 3 }
];

const DEFAULT_TOTAL_REQUESTED = 30;
const DEFAULT_DAYS = 1;

type TopicRow = {
  id: number;
  name: string;
  query: string;
  is_active: number;
  allocation_percent: number;
  display_order: number;
};

type ArticleRow = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  fetched_at: string;
  summary: string | null;
  content: string | null;
  language: string | null;
  is_japanese: number;
  topic_name: string;
};

type SettingsRow = {
  total_requested: number;
  days: number;
  updated_at: string;
};

let newsSchemaReady: Promise<void> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function containsJapanese(text: string) {
  return /[ぁ-んァ-ン一-龠々]/.test(text);
}

function splitKeywords(value: string) {
  return value
    .split(/[\n,、\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeSummary(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (lines.length === 0) {
    return "・要約を生成できませんでした\n・本文を再取得してください\n・時間をおいて再実行してください";
  }

  return lines
    .map((line) => (line.startsWith("・") ? line : `・${line.replace(/^[-*#\s]+/, "")}`))
    .join("\n");
}

async function summarizeArticle(title: string, content: string, url: string) {
  const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "・OPENAI_API_KEY 未設定\n・.env を確認してください\n・要約はスキップされました";
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      max_output_tokens: 220,
      input: [
        {
          role: "system",
          content:
            "ニュース本文を日本語3行で要約してください。プレーンテキストのみ。各行は必ず「・」で始める。"
        },
        {
          role: "user",
          content: `タイトル: ${title}\nURL: ${url}\n\n本文:\n${content.slice(0, 12000)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return `・要約APIエラー\n・${errorText.slice(0, 80)}\n・記事リンクから確認してください`;
  }

  const json = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text =
    json.output_text ??
    json.output
      ?.flatMap((entry) => entry.content ?? [])
      .map((entry) => entry.text ?? "")
      .join("\n") ??
    "";
  return normalizeSummary(text);
}

async function fetchTavilyNews(query: string, maxResults: number, days: number) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      topic: "news",
      days,
      max_results: maxResults,
      include_raw_content: true
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      source?: string;
      published_date?: string;
      content?: string;
      raw_content?: string;
    }>;
  };
  return payload.results ?? [];
}

function buildJapaneseFocusedQuery(baseQuery: string) {
  const query = baseQuery.trim();
  if (!query) {
    return "日本語 ニュース site:.jp OR site:co.jp";
  }
  // Prefer Japanese sources while still allowing broader matches.
  return `${query} 日本語 ニュース (site:.jp OR site:co.jp OR site:or.jp)`;
}

function allocateCounts(
  totalRequested: number,
  topics: Array<{ allocationPercent: number }>
) {
  const raw = topics.map((topic) => (totalRequested * topic.allocationPercent) / 100);
  const counts = raw.map((value) => Math.floor(value));
  let remain = totalRequested - counts.reduce((sum, value) => sum + value, 0);

  const fractions = raw
    .map((value, index) => ({ index, fraction: value - counts[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const item of fractions) {
    if (remain <= 0) break;
    counts[item.index] += 1;
    remain -= 1;
  }

  return counts.map((count) => Math.max(1, count));
}

export async function ensureNewsDashboardSchema() {
  if (newsSchemaReady) return newsSchemaReady;
  newsSchemaReady = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "topics" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "query" TEXT NOT NULL,
        "is_active" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "topic_allocations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "topic_id" INTEGER NOT NULL,
        "allocation_percent" INTEGER NOT NULL,
        "display_order" INTEGER NOT NULL DEFAULT 0,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "fetch_runs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "run_date" TEXT NOT NULL,
        "days" INTEGER NOT NULL,
        "total_requested" INTEGER NOT NULL,
        "total_fetched" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL,
        "error_message" TEXT,
        "started_at" TEXT NOT NULL,
        "finished_at" TEXT
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "articles" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "topic_id" INTEGER NOT NULL,
        "fetch_run_id" INTEGER NOT NULL,
        "title" TEXT NOT NULL,
        "url" TEXT NOT NULL UNIQUE,
        "source" TEXT,
        "published_at" TEXT,
        "fetched_at" TEXT NOT NULL,
        "content" TEXT,
        "summary" TEXT,
        "language" TEXT,
        "is_japanese" INTEGER NOT NULL DEFAULT 0,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "news_settings" (
        "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
        "total_requested" INTEGER NOT NULL DEFAULT 30,
        "days" INTEGER NOT NULL DEFAULT 1,
        "updated_at" TEXT NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_articles_url" ON "articles"("url");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_articles_topic_id" ON "articles"("topic_id");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_articles_published_at" ON "articles"("published_at");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_articles_is_japanese" ON "articles"("is_japanese");`);

    const topicCountRows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "topics"
    `;
    const topicCount = Number(topicCountRows[0]?.count ?? 0);
    if (topicCount === 0) {
      const ts = nowIso();
      for (const topic of DEFAULT_TOPICS) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "topics" ("name", "query", "is_active", "created_at", "updated_at") VALUES (?, ?, 1, ?, ?)`,
          topic.name,
          topic.query,
          ts,
          ts
        );
      }
      const rows = await prisma.$queryRaw<TopicRow[]>`
        SELECT id, name, query, is_active, 0 as allocation_percent, 0 as display_order FROM "topics" ORDER BY id ASC
      `;
      for (const row of rows) {
        const def = DEFAULT_TOPICS.find((item) => item.name === row.name);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "topic_allocations" ("topic_id", "allocation_percent", "display_order", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?)`,
          row.id,
          def?.allocationPercent ?? 0,
          def?.displayOrder ?? 99,
          ts,
          ts
        );
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "news_settings" ("id", "total_requested", "days", "updated_at") VALUES (1, ?, ?, ?)`,
      DEFAULT_TOTAL_REQUESTED,
      DEFAULT_DAYS,
      nowIso()
    );
  })();

  return newsSchemaReady;
}

export async function getNewsDashboardSettings() {
  await ensureNewsDashboardSchema();
  const [settings] = await prisma.$queryRaw<SettingsRow[]>`
    SELECT total_requested, days, updated_at FROM "news_settings" WHERE id = 1 LIMIT 1
  `;
  const topics = await prisma.$queryRaw<TopicRow[]>`
    SELECT
      t.id, t.name, t.query, t.is_active,
      a.allocation_percent, a.display_order
    FROM "topics" t
    JOIN "topic_allocations" a ON a.topic_id = t.id
    ORDER BY a.display_order ASC, t.id ASC
  `;

  return {
    totalRequested: settings?.total_requested ?? DEFAULT_TOTAL_REQUESTED,
    days: settings?.days ?? DEFAULT_DAYS,
    updatedAt: settings?.updated_at ?? nowIso(),
    topics: topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      query: topic.query,
      isActive: topic.is_active === 1,
      allocationPercent: topic.allocation_percent,
      displayOrder: topic.display_order
    }))
  };
}

export async function updateNewsDashboardSettings(input: {
  totalRequested: number;
  days: number;
  topics: Array<{
    id?: number;
    name: string;
    query: string;
    isActive: boolean;
    allocationPercent: number;
    displayOrder: number;
  }>;
}) {
  await ensureNewsDashboardSchema();
  const ts = nowIso();
  await prisma.$executeRawUnsafe(
    `UPDATE "news_settings" SET "total_requested"=?, "days"=?, "updated_at"=? WHERE "id"=1`,
    input.totalRequested,
    input.days,
    ts
  );

  for (const topic of input.topics) {
    const name = topic.name.trim();
    const query = topic.query.trim();
    if (!name || !query) continue;

    if (topic.id && topic.id > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "topics" SET "name"=?, "query"=?, "is_active"=?, "updated_at"=? WHERE "id"=?`,
        name,
        query,
        topic.isActive ? 1 : 0,
        ts,
        topic.id
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "topic_allocations" SET "allocation_percent"=?, "display_order"=?, "updated_at"=? WHERE "topic_id"=?`,
        topic.allocationPercent,
        topic.displayOrder,
        ts,
        topic.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "topics" ("name", "query", "is_active", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?)`,
        name,
        query,
        topic.isActive ? 1 : 0,
        ts,
        ts
      );
      const inserted = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "topics" ORDER BY id DESC LIMIT 1
      `;
      const topicId = inserted[0]?.id;
      if (topicId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "topic_allocations" ("topic_id", "allocation_percent", "display_order", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?)`,
          topicId,
          topic.allocationPercent,
          topic.displayOrder,
          ts,
          ts
        );
      }
    }
  }

  return getNewsDashboardSettings();
}

export async function fetchNewsAndSummarize() {
  await ensureNewsDashboardSchema();
  const settings = await getNewsDashboardSettings();
  const activeTopics = settings.topics.filter((topic) => topic.isActive);
  if (activeTopics.length === 0) {
    throw new Error("No active topics configured");
  }

  const runDate = new Date().toISOString().slice(0, 10);
  const startedAt = nowIso();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "fetch_runs" ("run_date", "days", "total_requested", "total_fetched", "status", "started_at") VALUES (?, ?, ?, 0, 'running', ?)`,
    runDate,
    settings.days,
    settings.totalRequested,
    startedAt
  );
  const runRow = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "fetch_runs" ORDER BY id DESC LIMIT 1
  `;
  const fetchRunId = runRow[0]?.id;
  if (!fetchRunId) throw new Error("Failed to create fetch run");

  let totalFetched = 0;
  let inserted = 0;
  const runSeenUrls = new Set<string>();

  try {
    const allocations = allocateCounts(settings.totalRequested, activeTopics);

    for (let i = 0; i < activeTopics.length; i += 1) {
      const topic = activeTopics[i];
      const targetCount = allocations[i];
      const query = buildJapaneseFocusedQuery(topic.query);
      const results = await fetchTavilyNews(query, targetCount, settings.days);
      totalFetched += results.length;

      for (const result of results) {
        const title = (result.title ?? "").trim();
        const url = (result.url ?? "").trim();
        if (!title || !url) continue;
        if (runSeenUrls.has(url)) continue;
        runSeenUrls.add(url);

        const exists = await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "articles" WHERE "url" = ${url} LIMIT 1
        `;
        if (exists.length > 0) continue;

        const content = (result.raw_content ?? result.content ?? "").trim();
        const mergedText = `${title}\n${content}`;
        const isJapanese = containsJapanese(mergedText);
        const summary = await summarizeArticle(title, content || title, url);
        const publishedAt = result.published_date ? new Date(result.published_date) : null;
        const publishedIso =
          publishedAt && Number.isFinite(publishedAt.getTime()) ? publishedAt.toISOString() : null;
        const ts = nowIso();

        const affectedRows = await prisma.$executeRawUnsafe(
          `INSERT OR IGNORE INTO "articles" ("topic_id", "fetch_run_id", "title", "url", "source", "published_at", "fetched_at", "content", "summary", "language", "is_japanese", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          topic.id,
          fetchRunId,
          title,
          url,
          result.source ?? null,
          publishedIso,
          ts,
          content || null,
          summary,
          isJapanese ? "ja" : "en",
          isJapanese ? 1 : 0,
          ts,
          ts
        );
        if (Number(affectedRows) > 0) {
          inserted += 1;
        }
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "fetch_runs" SET "total_fetched"=?, "status"='success', "finished_at"=? WHERE "id"=?`,
      totalFetched,
      nowIso(),
      fetchRunId
    );
    return {
      ok: true,
      totalRequested: settings.totalRequested,
      totalFetched,
      inserted,
      fetchRunId
    };
  } catch (error) {
    await prisma.$executeRawUnsafe(
      `UPDATE "fetch_runs" SET "total_fetched"=?, "status"='failed', "error_message"=?, "finished_at"=? WHERE "id"=?`,
      totalFetched,
      error instanceof Error ? error.message : "Unknown error",
      nowIso(),
      fetchRunId
    );
    throw error;
  }
}

export async function listNewsArticles(topicName?: string) {
  await ensureNewsDashboardSchema();
  const rows = topicName
    ? await prisma.$queryRaw<ArticleRow[]>`
        SELECT
          a.id, a.title, a.url, a.source, a.published_at, a.fetched_at, a.summary, a.content,
          a.language, a.is_japanese, t.name AS topic_name
        FROM "articles" a
        JOIN "topics" t ON t.id = a.topic_id
        WHERE t.name = ${topicName}
        ORDER BY a.is_japanese DESC, a.published_at DESC, a.id DESC
      `
    : await prisma.$queryRaw<ArticleRow[]>`
        SELECT
          a.id, a.title, a.url, a.source, a.published_at, a.fetched_at, a.summary, a.content,
          a.language, a.is_japanese, t.name AS topic_name
        FROM "articles" a
        JOIN "topics" t ON t.id = a.topic_id
        ORDER BY a.is_japanese DESC, a.published_at DESC, a.id DESC
      `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    summary: row.summary,
    language: row.language,
    isJapanese: row.is_japanese === 1,
    topic: row.topic_name
  }));
}

export async function getNewsArticleById(id: number) {
  await ensureNewsDashboardSchema();
  const rows = await prisma.$queryRaw<ArticleRow[]>`
    SELECT
      a.id, a.title, a.url, a.source, a.published_at, a.fetched_at, a.summary, a.content,
      a.language, a.is_japanese, t.name AS topic_name
    FROM "articles" a
    JOIN "topics" t ON t.id = a.topic_id
    WHERE a.id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    summary: row.summary,
    content: row.content,
    language: row.language,
    isJapanese: row.is_japanese === 1,
    topic: row.topic_name
  };
}

export async function getNewsHeaderMeta() {
  await ensureNewsDashboardSchema();
  const runRows = await prisma.$queryRaw<Array<{ total_fetched: number; finished_at: string | null }>>`
    SELECT total_fetched, finished_at
    FROM "fetch_runs"
    WHERE status = 'success'
    ORDER BY id DESC
    LIMIT 1
  `;
  const latest = runRows[0];
  return {
    latestFetched: latest?.total_fetched ?? 0,
    latestUpdatedAt: latest?.finished_at ?? null
  };
}

export async function parseAndNormalizeTopicInput(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const allocationPercent = Number(row.allocationPercent ?? 0);
      const displayOrder = Number(row.displayOrder ?? 0);
      return {
        id: row.id ? Number(row.id) : undefined,
        name: String(row.name ?? "").trim(),
        query: String(row.query ?? "").trim(),
        isActive: Boolean(row.isActive ?? true),
        allocationPercent: Number.isFinite(allocationPercent) ? allocationPercent : 0,
        displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export function buildTopicFilterQueryParam(topic: string | null) {
  if (!topic || topic === "すべて") return "/news";
  return `/news?topic=${encodeURIComponent(topic)}`;
}

export function formatRelativeJapaneseTime(iso: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function extractDefaultKeywords(topics: Array<{ name: string }>) {
  return splitKeywords(topics.map((topic) => topic.name).join(","));
}
