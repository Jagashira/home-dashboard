import { NormalizedArticle } from "@/lib/types";
import { guessLanguage, isJapaneseText } from "@/lib/utils/language";
import { nowIso } from "@/lib/utils/datetime";

type RedditChild = {
  data?: {
    id?: string;
    title?: string;
    url?: string;
    selftext?: string;
    created_utc?: number;
    score?: number;
    subreddit_name_prefixed?: string;
  };
};

const DEFAULT_SUBREDDITS = ["artificial", "MachineLearning", "technology", "hardware"];

export async function fetchFromReddit(params: {
  topicName: string;
  query: string;
  keywords: string[];
  limit: number;
}): Promise<NormalizedArticle[]> {
  const query = encodeURIComponent(params.keywords.slice(0, 6).join(" OR ") || params.query);
  const endpoint = `https://www.reddit.com/search.json?q=${query}&sort=new&limit=${Math.max(
    20,
    params.limit * 3
  )}`;
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "home-dashboard-news/1.0" },
    next: { revalidate: 0 }
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { data?: { children?: RedditChild[] } };
  const out: NormalizedArticle[] = [];

  for (const child of payload.data?.children ?? []) {
    if (out.length >= params.limit) break;
    const row = child.data;
    if (!row) continue;
    const title = (row.title ?? "").trim();
    const url = (row.url ?? "").trim();
    if (!title || !url) continue;
    const selftext = (row.selftext ?? "").trim() || null;
    const subreddit = (row.subreddit_name_prefixed ?? "").replace(/^r\//i, "");
    if (!DEFAULT_SUBREDDITS.some((name) => subreddit.toLowerCase().includes(name.toLowerCase()))) {
      continue;
    }
    const merged = `${title}\n${selftext ?? ""}`;
    out.push({
      topicName: params.topicName,
      sourceType: "reddit",
      sourceLabel: `r/${subreddit || "reddit"}`,
      externalId: row.id ?? null,
      title,
      url,
      publishedAt: row.created_utc ? new Date(row.created_utc * 1000).toISOString() : null,
      fetchedAt: nowIso(),
      content: selftext,
      language: guessLanguage(merged),
      isJapanese: isJapaneseText(merged),
      score: typeof row.score === "number" ? row.score : null
    });
  }
  return out;
}

