import { NormalizedArticle } from "@/lib/types";
import { dedupeByUrl } from "@/lib/utils/dedupe";

export function normalizeArticles(items: NormalizedArticle[], preferJapanese: boolean) {
  const deduped = dedupeByUrl(items);
  if (!preferJapanese) {
    return deduped.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }
  return deduped.sort((a, b) => {
    const jaDiff = Number(b.isJapanese) - Number(a.isJapanese);
    if (jaDiff !== 0) return jaDiff;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });
}

