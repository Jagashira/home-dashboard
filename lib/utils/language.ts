export function isJapaneseText(text: string) {
  return /[ぁ-んァ-ヶ一-龠々]/.test(text);
}

export function guessLanguage(text: string) {
  return isJapaneseText(text) ? "ja" : "en";
}

