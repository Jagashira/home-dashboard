import { fetchFromGdelt } from "@/lib/clients/gdelt";
import { fetchFromHackerNews } from "@/lib/clients/hackernews";
import { fetchFromNewsApi } from "@/lib/clients/newsapi";
import { fetchFromRss } from "@/lib/clients/rss";
import { fetchFromYoutube } from "@/lib/clients/youtube";
import { fetchFromReddit } from "@/lib/clients/reddit";
import { fetchArticleContent } from "@/lib/clients/article-fetcher";
import { insertArticle } from "@/lib/repositories/articles";
import { finishFetchRun, startFetchRun } from "@/lib/repositories/fetch-runs";
import { getSettings } from "@/lib/repositories/settings";
import { listSources } from "@/lib/repositories/sources";
import { listTopics } from "@/lib/repositories/topics";
import { allocateTopics } from "./allocate-topics";
import { classifyLanguage } from "./classify-language";
import { normalizeArticles } from "./normalize-article";
import { NormalizedArticle, Source } from "@/lib/types";
import { APP_CONFIG } from "@/lib/config";

const QUERY_SYNONYMS: Record<string, string[]> = {
  "半導体": ["semiconductor", "semiconductors", "chiplet", "foundry", "fab", "tsmc", "nvidia", "hbm", "euv"],
  ai: ["artificial intelligence", "genai", "llm", "machine learning", "生成AI", "大規模言語モデル"],
  IT: ["tech", "technology", "software", "startup", "cloud", "developer", "security", "saas"],
  "世界": ["international", "global", "geopolitics", "overseas", "world news", "diplomacy"],
  "日本": ["japan", "domestic", "government", "industry", "economy", "disaster"]
};

const TOPIC_RULES: Record<string, { include: string[]; exclude: string[] }> = {
  "半導体": {
    include: ["半導体", "semiconductor", "chiplet", "foundry", "tsmc", "hbm", "euv", "gpu", "cpu", "asml"],
    exclude: ["potato chips", "banana chips", "snack", "recipe", "ホタテ", "旅行", "クルーズ"]
  },
  AI: {
    include: ["ai", "人工知能", "生成ai", "llm", "machine learning", "chatgpt", "gpt", "anthropic", "gemini"],
    exclude: ["芸能", "celebrity", "katherine heigl", "recipe"]
  },
  IT: {
    include: [
      "it",
      "tech",
      "technology",
      "software",
      "security",
      "クラウド",
      "os",
      "アプリ",
      "ガジェット",
      "developer",
      "saas"
    ],
    exclude: ["旅行", "グルメ", "レシピ", "football", "soccer", "entertainment"]
  },
  "世界": {
    include: [
      "世界",
      "国際",
      "海外",
      "international",
      "global",
      "geopolitics",
      "外交",
      "米国",
      "中国",
      "欧州",
      "ukraine",
      "russia",
      "taiwan"
    ],
    exclude: ["芸能", "celebrity", "グルメ", "recipe", "football", "soccer"]
  },
  "日本": {
    include: [
      "日本",
      "国内",
      "政府",
      "首相",
      "国会",
      "経産省",
      "日銀",
      "災害",
      "地震",
      "事故",
      "選挙",
      "economy",
      "industry"
    ],
    exclude: ["芸能", "celebrity", "グルメ", "recipe", "baseball", "soccer"]
  }
};

function parseRssFeeds(source: Source) {
  if (!source.configJson) return [];
  try {
    const config = JSON.parse(source.configJson) as { feeds?: string[] };
    return Array.isArray(config.feeds) ? config.feeds : [];
  } catch {
    return [];
  }
}

function buildQueryTerms(rawQuery: string) {
  const base = rawQuery
    .split(/[\s,、]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const expanded = new Set<string>(base);
  for (const term of base) {
    const key = term.toLowerCase();
    for (const syn of QUERY_SYNONYMS[key] ?? []) expanded.add(syn);
    for (const syn of QUERY_SYNONYMS[term] ?? []) expanded.add(syn);
  }
  if (expanded.size === 0) expanded.add(rawQuery.trim());
  return [...expanded];
}

function buildGdeltQuery(terms: string[]) {
  const safe = terms
    .filter((term) => /^[\p{L}\p{N}\- ]+$/u.test(term))
    .slice(0, 6)
    .map((term) => `"${term}"`);
  return safe.length > 0 ? safe.join(" OR ") : "\"technology\" OR \"AI\"";
}

function isRelevantToTopic(topicName: string, text: string) {
  const rule = TOPIC_RULES[topicName];
  if (!rule) return true;
  const lower = text.toLowerCase();
  const included = rule.include.some((term) => lower.includes(term.toLowerCase()));
  if (!included) return false;
  const excluded = rule.exclude.some((term) => lower.includes(term.toLowerCase()));
  return !excluded;
}

function selectWithJapanesePriority(items: NormalizedArticle[], limit: number, preferJapanese: boolean) {
  if (!preferJapanese) return items.slice(0, limit);
  const ja = items.filter((item) => item.isJapanese);
  const nonJa = items.filter((item) => !item.isJapanese);
  return [...ja, ...nonJa].slice(0, limit);
}

async function collectBySource(params: {
  topicName: string;
  query: string;
  queryTerms: string[];
  limit: number;
  days: number;
  sources: Source[];
}) {
  const items: NormalizedArticle[] = [];
  const sourceRawCount: Record<string, number> = {};
  for (const source of params.sources) {
    if (!source.isActive) continue;
    const perSourceLimit = Math.max(1, Math.ceil(params.limit / params.sources.length));
    try {
      if (source.sourceType === "rss") {
        const rows = await fetchFromRss({
          topicName: params.topicName,
          query: params.query,
          keywords: params.queryTerms,
          feeds: parseRssFeeds(source),
          limit: perSourceLimit
        });
        sourceRawCount[source.sourceType] = (sourceRawCount[source.sourceType] ?? 0) + rows.length;
        items.push(...rows);
      } else if (source.sourceType === "gdelt") {
        const rows = await fetchFromGdelt({
          topicName: params.topicName,
          query: buildGdeltQuery(params.queryTerms),
          limit: perSourceLimit
        });
        sourceRawCount[source.sourceType] = (sourceRawCount[source.sourceType] ?? 0) + rows.length;
        items.push(...rows);
      } else if (source.sourceType === "hackernews") {
        const rows = await fetchFromHackerNews({
          topicName: params.topicName,
          query: params.query,
          keywords: params.queryTerms,
          limit: perSourceLimit
        });
        sourceRawCount[source.sourceType] = (sourceRawCount[source.sourceType] ?? 0) + rows.length;
        items.push(...rows);
      } else if (source.sourceType === "newsapi") {
        const rows = await fetchFromNewsApi({
          topicName: params.topicName,
          query: params.query,
          keywords: params.queryTerms,
          limit: perSourceLimit,
          days: params.days
        });
        sourceRawCount[source.sourceType] = (sourceRawCount[source.sourceType] ?? 0) + rows.length;
        items.push(...rows);
      } else if (source.sourceType === "youtube") {
        const rows = await fetchFromYoutube({
          topicName: params.topicName,
          query: params.query,
          keywords: params.queryTerms,
          limit: perSourceLimit,
          days: params.days,
          apiKey: APP_CONFIG.youtubeApiKey
        });
        sourceRawCount[source.sourceType] = (sourceRawCount[source.sourceType] ?? 0) + rows.length;
        items.push(...rows);
      } else if (source.sourceType === "reddit") {
        const rows = await fetchFromReddit({
          topicName: params.topicName,
          query: params.query,
          keywords: params.queryTerms,
          limit: perSourceLimit
        });
        sourceRawCount[source.sourceType] = (sourceRawCount[source.sourceType] ?? 0) + rows.length;
        items.push(...rows);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[news-fetch] source=${source.sourceType} topic=${params.topicName} failed: ${message}`);
    }
  }
  return { items, sourceRawCount };
}

export async function runFetchNews() {
  const settings = getSettings();
  const topics = listTopics();
  const sources = listSources().filter((source) => source.isActive);
  if (sources.length === 0) {
    throw new Error("No active sources.");
  }

  const allocation = allocateTopics(topics, settings.totalRequested);
  const fetchRunId = startFetchRun({
    days: settings.days,
    totalRequested: settings.totalRequested
  });

  let totalFetched = 0;
  let inserted = 0;
  const sourceRawCount: Record<string, number> = {};
  const sourceInsertedCount: Record<string, number> = {};
  try {
    for (const row of allocation) {
      const queryTerms = buildQueryTerms(row.topic.query);
      const collected = await collectBySource({
        topicName: row.topic.name,
        query: row.topic.query,
        queryTerms,
        limit: row.count,
        days: settings.days,
        sources
      });
      for (const [key, value] of Object.entries(collected.sourceRawCount)) {
        sourceRawCount[key] = (sourceRawCount[key] ?? 0) + value;
      }
      const relevanceFiltered = collected.items.filter((item) =>
        isRelevantToTopic(row.topic.name, `${item.title}\n${item.content ?? ""}`)
      );
      const normalized = normalizeArticles(relevanceFiltered, settings.preferJapanese);
      const selected = selectWithJapanesePriority(normalized, row.count, settings.preferJapanese);
      totalFetched += selected.length;

      for (const item of selected) {
        const source = sources.find((s) => s.sourceType === item.sourceType);
        if (!source) continue;

        const content = item.content ?? (await fetchArticleContent(item.url));
        const lang = classifyLanguage(item.title, content);
        const result = insertArticle({
          topicId: row.topic.id,
          sourceId: source.id,
          fetchRunId,
          externalId: item.externalId ?? null,
          title: item.title,
          url: item.url,
          sourceLabel: item.sourceLabel,
          publishedAt: item.publishedAt ?? null,
          fetchedAt: item.fetchedAt,
          content: content ?? null,
          summary: null,
          language: lang.language,
          isJapanese: lang.isJapanese,
          score: item.score ?? null
        });
        const changed = Number(result.changes ?? 0);
        inserted += changed;
        if (changed > 0) {
          sourceInsertedCount[item.sourceType] = (sourceInsertedCount[item.sourceType] ?? 0) + changed;
        }
      }
    }

    finishFetchRun({
      id: fetchRunId,
      status: "success",
      totalFetched,
      errorMessage: null
    });
    return {
      fetchRunId,
      totalFetched,
      inserted,
      totalRequested: settings.totalRequested,
      sourceRawCount,
      sourceInsertedCount,
      status: "success" as const
    };
  } catch (error) {
    finishFetchRun({
      id: fetchRunId,
      status: "failed",
      totalFetched,
      errorMessage: error instanceof Error ? error.message : "Unexpected error"
    });
    throw error;
  }
}
