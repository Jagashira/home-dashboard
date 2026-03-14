import { APP_CONFIG } from "@/lib/config";
import { NormalizedArticle } from "@/lib/types";
import { guessLanguage, isJapaneseText } from "@/lib/utils/language";
import { nowIso, toIso } from "@/lib/utils/datetime";

type NewsApiRow = {
  title?: string;
  url?: string;
  content?: string;
  publishedAt?: string;
  source?: { name?: string };
};

export async function fetchFromNewsApi(params: {
  topicName: string;
  query: string;
  limit: number;
  days: number;
}): Promise<NormalizedArticle[]> {
  if (!APP_CONFIG.newsApiKey) return [];
  const q = encodeURIComponent(params.query);
  const endpoint = `https://newsapi.org/v2/everything?q=${q}&language=en,ja&pageSize=${params.limit}&sortBy=publishedAt`;

  const response = await fetch(endpoint, {
    headers: { "X-Api-Key": APP_CONFIG.newsApiKey },
    next: { revalidate: 0 }
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as { articles?: NewsApiRow[] };
  const out: NormalizedArticle[] = [];
  for (const row of payload.articles ?? []) {
    const title = (row.title ?? "").trim();
    const url = (row.url ?? "").trim();
    if (!title || !url) continue;
    const content = (row.content ?? "").trim() || null;
    const merged = `${title}\n${content ?? ""}`;
    out.push({
      topicName: params.topicName,
      sourceType: "newsapi",
      sourceLabel: row.source?.name ?? "NewsAPI",
      externalId: null,
      title,
      url,
      publishedAt: toIso(row.publishedAt ?? null),
      fetchedAt: nowIso(),
      content,
      language: guessLanguage(merged),
      isJapanese: isJapaneseText(merged),
      score: null
    });
  }
  return out;
}
