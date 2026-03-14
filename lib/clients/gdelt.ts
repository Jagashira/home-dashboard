import { NormalizedArticle } from "@/lib/types";
import { guessLanguage, isJapaneseText } from "@/lib/utils/language";
import { nowIso, toIso } from "@/lib/utils/datetime";

type GdeltRow = {
  title?: string;
  url?: string;
  sourcecountry?: string;
  domain?: string;
  seendate?: string;
};

export async function fetchFromGdelt(params: {
  topicName: string;
  query: string;
  limit: number;
}): Promise<NormalizedArticle[]> {
  const q = encodeURIComponent(params.query);
  const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=${params.limit}&timespan=1d`;
  const response = await fetch(endpoint, { next: { revalidate: 0 } });
  if (!response.ok) return [];

  const raw = await response.text();
  let payload: { articles?: GdeltRow[] } = {};
  try {
    payload = JSON.parse(raw) as { articles?: GdeltRow[] };
  } catch {
    // GDELT can return plain text errors for some queries; skip this source gracefully.
    return [];
  }
  const out: NormalizedArticle[] = [];
  for (const row of payload.articles ?? []) {
    const title = (row.title ?? "").trim();
    const url = (row.url ?? "").trim();
    if (!title || !url) continue;
    const sourceLabel = row.domain || row.sourcecountry || "GDELT";
    const merged = `${title}\n${sourceLabel}`;
    out.push({
      topicName: params.topicName,
      sourceType: "gdelt",
      sourceLabel,
      externalId: null,
      title,
      url,
      publishedAt: toIso(row.seendate ?? null),
      fetchedAt: nowIso(),
      content: null,
      language: guessLanguage(merged),
      isJapanese: isJapaneseText(merged),
      score: null
    });
  }
  return out;
}
