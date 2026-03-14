import { NormalizedArticle } from "@/lib/types";
import { guessLanguage, hasKana, isJapaneseText } from "@/lib/utils/language";
import { nowIso, toIso } from "@/lib/utils/datetime";

type YoutubeItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelTitle?: string;
  };
};

export async function fetchFromYoutube(params: {
  topicName: string;
  query: string;
  keywords: string[];
  limit: number;
  days: number;
  apiKey: string;
}): Promise<NormalizedArticle[]> {
  if (!params.apiKey) return [];
  const q = encodeURIComponent(params.keywords.slice(0, 6).join(" OR ") || params.query);
  const publishedAfter = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000).toISOString();

  const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=${params.limit}&q=${q}&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${params.apiKey}`;
  const response = await fetch(endpoint, { next: { revalidate: 0 } });
  if (!response.ok) return [];

  const payload = (await response.json()) as { items?: YoutubeItem[] };
  const out: NormalizedArticle[] = [];
  for (const item of payload.items ?? []) {
    const videoId = item.id?.videoId ?? "";
    const title = (item.snippet?.title ?? "").trim();
    if (!videoId || !title) continue;
    const description = (item.snippet?.description ?? "").trim() || null;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const merged = `${title}\n${description ?? ""}`;
    // User requirement: YouTube is Japanese-only.
    if (!hasKana(merged) && !/日本/.test(merged)) {
      continue;
    }

    out.push({
      topicName: params.topicName,
      sourceType: "youtube",
      sourceLabel: item.snippet?.channelTitle ?? "YouTube",
      externalId: videoId,
      title,
      url,
      publishedAt: toIso(item.snippet?.publishedAt ?? null),
      fetchedAt: nowIso(),
      content: description,
      language: guessLanguage(merged),
      isJapanese: isJapaneseText(merged),
      score: null
    });
  }
  return out;
}
