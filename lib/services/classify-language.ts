import { guessLanguage, isJapaneseText } from "@/lib/utils/language";

export function classifyLanguage(title: string, content: string | null) {
  const merged = `${title}\n${content ?? ""}`;
  return {
    language: guessLanguage(merged),
    isJapanese: isJapaneseText(merged)
  };
}

