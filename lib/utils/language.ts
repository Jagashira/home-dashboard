export function hasKana(text: string) {
  return /[ぁ-んァ-ヶ]/.test(text);
}

export function hasCjk(text: string) {
  return /[一-龠々]/.test(text);
}

export function isJapaneseText(text: string) {
  if (hasKana(text)) return true;
  // All-kanji text can be Chinese or Japanese, keep strict to avoid false positives.
  return /(?:日本|に関する|について|です|ます|した|する|最新|技術)/.test(text);
}

export function guessLanguage(text: string) {
  if (isJapaneseText(text)) return "ja";
  if (hasCjk(text)) return "zh";
  return "en";
}
