import Parser from "rss-parser";
import { NormalizedArticle } from "@/lib/types";
import { guessLanguage, isJapaneseText } from "@/lib/utils/language";
import { nowIso, toIso } from "@/lib/utils/datetime";

const parser = new Parser();

export async function fetchFromRss(params: {
  topicName: string;
  query: string;
  feeds: string[];
  limit: number;
}): Promise<NormalizedArticle[]> {
  const out: NormalizedArticle[] = [];

  for (const feedUrl of params.feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of (feed.items ?? []).slice(0, params.limit)) {
        const title = (item.title ?? "").trim();
        const url = (item.link ?? "").trim();
        if (!title || !url) continue;
        const content = (item.contentSnippet ?? item.content ?? "").trim();
        const merged = `${title}\n${content}`;
        if (!merged.toLowerCase().includes(params.query.toLowerCase().split(" ")[0])) {
          continue;
        }
        out.push({
          topicName: params.topicName,
          sourceType: "rss",
          sourceLabel: new URL(feedUrl).hostname,
          externalId: null,
          title,
          url,
          publishedAt: toIso(item.isoDate ?? item.pubDate ?? null),
          fetchedAt: nowIso(),
          content: content || null,
          language: guessLanguage(merged),
          isJapanese: isJapaneseText(merged),
          score: null
        });
      }
    } catch {
      // Keep collection resilient: one feed failure should not stop the run.
    }
  }
  return out;
}

