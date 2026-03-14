import { NormalizedArticle } from "@/lib/types";
import { guessLanguage, isJapaneseText } from "@/lib/utils/language";
import { nowIso } from "@/lib/utils/datetime";

type HnItem = {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
};

const KEYWORDS = ["ai", "artificial intelligence", "semiconductor", "chip", "tech", "llm"];

export async function fetchFromHackerNews(params: {
  topicName: string;
  query: string;
  limit: number;
}): Promise<NormalizedArticle[]> {
  const topRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
  if (!topRes.ok) return [];
  const ids = ((await topRes.json()) as number[]).slice(0, 120);

  const results: NormalizedArticle[] = [];
  for (const id of ids) {
    if (results.length >= params.limit) break;
    const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    if (!itemRes.ok) continue;
    const item = (await itemRes.json()) as HnItem;
    const title = (item.title ?? "").trim();
    const url = (item.url ?? "").trim();
    if (!title || !url) continue;

    const lower = title.toLowerCase();
    const q = params.query.toLowerCase();
    const isMatch = KEYWORDS.some((kw) => lower.includes(kw)) || lower.includes(q.split(" ")[0]);
    if (!isMatch) continue;

    results.push({
      topicName: params.topicName,
      sourceType: "hackernews",
      sourceLabel: "Hacker News",
      externalId: String(item.id),
      title,
      url,
      publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
      fetchedAt: nowIso(),
      content: null,
      language: guessLanguage(title),
      isJapanese: isJapaneseText(title),
      score: typeof item.score === "number" ? item.score : null
    });
  }
  return results;
}

