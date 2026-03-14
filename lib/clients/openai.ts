import { APP_CONFIG } from "@/lib/config";
import { compactWhitespace } from "@/lib/utils/text";

function fallbackSummary(text: string) {
  const normalized = compactWhitespace(text);
  const a = normalized.slice(0, 60) || "要点を抽出できませんでした";
  const b = normalized.slice(60, 120) || "本文が短いため要約を簡易表示します";
  const c = normalized.slice(120, 180) || "元記事リンクを確認してください";
  return `・${a}\n・${b}\n・${c}`;
}

export async function summarizeToJapanese3Lines(input: {
  title: string;
  content: string;
  sourceLabel: string;
}) {
  if (!APP_CONFIG.openAiApiKey) {
    return fallbackSummary(`${input.title} ${input.content}`);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${APP_CONFIG.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      max_output_tokens: 180,
      input: [
        {
          role: "system",
          content:
            "ニュース本文を事実ベースで日本語3行に要約してください。プレーンテキストのみ。各行は必ず「・」で始める。"
        },
        {
          role: "user",
          content: `タイトル: ${input.title}\nソース: ${input.sourceLabel}\n\n本文:\n${input.content.slice(0, 12000)}`
        }
      ]
    })
  });

  if (!response.ok) {
    return fallbackSummary(`${input.title} ${input.content}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text =
    payload.output_text ??
    payload.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("\n") ??
    "";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (lines.length === 0) {
    return fallbackSummary(`${input.title} ${input.content}`);
  }
  return lines.map((line) => (line.startsWith("・") ? line : `・${line}`)).join("\n");
}

