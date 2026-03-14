import { fetchFromGdelt } from "@/lib/clients/gdelt";
import { fetchFromHackerNews } from "@/lib/clients/hackernews";
import { fetchFromNewsApi } from "@/lib/clients/newsapi";
import { fetchFromRss } from "@/lib/clients/rss";
import { fetchArticleContent } from "@/lib/clients/article-fetcher";
import { insertArticle } from "@/lib/repositories/articles";
import { finishFetchRun, startFetchRun } from "@/lib/repositories/fetch-runs";
import { getSettings } from "@/lib/repositories/settings";
import { listSources } from "@/lib/repositories/sources";
import { listTopics } from "@/lib/repositories/topics";
import { allocateTopics } from "./allocate-topics";
import { classifyLanguage } from "./classify-language";
import { normalizeArticles } from "./normalize-article";
import { summarizeArticle } from "./summarize-article";
import { NormalizedArticle, Source } from "@/lib/types";

function parseRssFeeds(source: Source) {
  if (!source.configJson) return [];
  try {
    const config = JSON.parse(source.configJson) as { feeds?: string[] };
    return Array.isArray(config.feeds) ? config.feeds : [];
  } catch {
    return [];
  }
}

async function collectBySource(params: {
  topicName: string;
  query: string;
  limit: number;
  days: number;
  sources: Source[];
}) {
  const items: NormalizedArticle[] = [];
  for (const source of params.sources) {
    if (!source.isActive) continue;
    const perSourceLimit = Math.max(1, Math.ceil(params.limit / params.sources.length));
    if (source.sourceType === "rss") {
      items.push(
        ...(await fetchFromRss({
          topicName: params.topicName,
          query: params.query,
          feeds: parseRssFeeds(source),
          limit: perSourceLimit
        }))
      );
    } else if (source.sourceType === "gdelt") {
      items.push(
        ...(await fetchFromGdelt({
          topicName: params.topicName,
          query: params.query,
          limit: perSourceLimit
        }))
      );
    } else if (source.sourceType === "hackernews") {
      items.push(
        ...(await fetchFromHackerNews({
          topicName: params.topicName,
          query: params.query,
          limit: perSourceLimit
        }))
      );
    } else if (source.sourceType === "newsapi") {
      items.push(
        ...(await fetchFromNewsApi({
          topicName: params.topicName,
          query: params.query,
          limit: perSourceLimit,
          days: params.days
        }))
      );
    }
  }
  return items;
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
  try {
    for (const row of allocation) {
      const rawItems = await collectBySource({
        topicName: row.topic.name,
        query: row.topic.query,
        limit: row.count,
        days: settings.days,
        sources
      });
      const normalized = normalizeArticles(rawItems, settings.preferJapanese).slice(0, row.count);
      totalFetched += normalized.length;

      for (const item of normalized) {
        const source = sources.find((s) => s.sourceType === item.sourceType);
        if (!source) continue;

        const content = item.content ?? (await fetchArticleContent(item.url));
        const lang = classifyLanguage(item.title, content);
        const summary = await summarizeArticle({
          title: item.title,
          content,
          sourceLabel: item.sourceLabel
        });

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
          summary,
          language: lang.language,
          isJapanese: lang.isJapanese,
          score: item.score ?? null
        });
        inserted += Number(result.changes ?? 0);
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
