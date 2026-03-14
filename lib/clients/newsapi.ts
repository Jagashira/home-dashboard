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
  keywords: string[];
  limit: number;
  days: number;
}): Promise<NormalizedArticle[]> {
  if (!APP_CONFIG.newsApiKey) return [];
  const queryTerms = params.keywords.length > 0 ? params.keywords : [params.query];
  const q = encodeURIComponent(queryTerms.join(" OR "));
  const from = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000).toISOString();

  const fetchLang = async (language: "ja" | "en") => {
    const endpoint = `https://newsapi.org/v2/everything?q=${q}&pageSize=${params.limit}&sortBy=publishedAt&searchIn=title,description&from=${encodeURIComponent(from)}&language=${language}`;
    const response = await fetch(endpoint, {
      headers: { "X-Api-Key": APP_CONFIG.newsApiKey },
      next: { revalidate: 0 }
    });
    if (!response.ok) return [] as NewsApiRow[];
    const payload = (await response.json()) as { articles?: NewsApiRow[] };
    return payload.articles ?? [];
  };

  const payloadRows = [...(await fetchLang("ja")), ...(await fetchLang("en"))];
  const out: NormalizedArticle[] = [];
  for (const row of payloadRows) {
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
