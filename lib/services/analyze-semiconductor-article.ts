import { APP_CONFIG } from "@/lib/config";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_SEMICONDUCTOR_MODEL || "gpt-4.1-mini";
const PRICING_PER_1M = {
  input: Number(process.env.OPENAI_PRICE_INPUT_PER_1M ?? "0.4"),
  cachedInput: Number(process.env.OPENAI_PRICE_CACHED_INPUT_PER_1M ?? "0.1"),
  output: Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M ?? "1.6")
};
const USD_TO_JPY = Number(process.env.OPENAI_USD_TO_JPY ?? "150");

type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

export type SemiconductorAnalysis = {
  text: string;
  model: string;
  estimatedCostUsd: number | null;
  estimatedCostJpy: number | null;
};

function calculateCostUsd(usage: ResponsesUsage | undefined): number | null {
  if (!usage) return null;

  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const uncachedInput = Math.max(0, input - cached);
  const cost =
    (uncachedInput / 1_000_000) * PRICING_PER_1M.input +
    (cached / 1_000_000) * PRICING_PER_1M.cachedInput +
    (output / 1_000_000) * PRICING_PER_1M.output;

  return Number.isFinite(cost) ? cost : null;
}

function extractOutputText(responseJson: unknown): string | null {
  if (!responseJson || typeof responseJson !== "object") return null;

  const json = responseJson as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof json.output_text === "string" && json.output_text.trim()) {
    return json.output_text.trim();
  }

  const parts: string[] = [];
  for (const outputItem of json.output ?? []) {
    for (const content of outputItem.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.length > 0 ? parts.join("\n\n").trim() : null;
}

function buildPrompt(input: {
  title: string;
  url: string;
  sourceLabel: string;
  content: string | null;
}) {
  return [
    `タイトル: ${input.title}`,
    `ソース: ${input.sourceLabel}`,
    `URL: ${input.url}`,
    "",
    "本文:",
    (input.content ?? "").slice(0, 10000)
  ].join("\n");
}

export async function analyzeSemiconductorArticle(input: {
  title: string;
  url: string;
  sourceLabel: string;
  content: string | null;
}): Promise<SemiconductorAnalysis | null> {
  if (!APP_CONFIG.openAiApiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${OPENAI_API_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${APP_CONFIG.openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_output_tokens: 900,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "あなたは半導体業界を読むためのニュースアナリストです。投資助言ではなく、業界理解のために日本語で整理してください。記事本文にない事実は断定せず、推測は推測と明記してください。表は使わず、プレーンテキストで返してください。"
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "以下の記事を次の形式で整理してください。",
                  "",
                  "1. 要点: 3行以内",
                  "2. 何が起きたか: 具体的に",
                  "3. なぜ重要か: 半導体業界への影響",
                  "4. 関係する技術・工程:",
                  "5. 関係する企業・国・地域:",
                  "6. 知っておくべき背景知識:",
                  "7. 今後ウォッチするキーワード:",
                  "8. 重要度: 高 / 中 / 低",
                  "9. ノイズ判定: 業界理解に有用 / 普通 / 不要",
                  "",
                  buildPrompt(input)
                ].join("\n")
              }
            ]
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const responseJson = await response.json();
    const text = extractOutputText(responseJson);
    if (!text) return null;

    const usage = (responseJson as { usage?: ResponsesUsage }).usage;
    const estimatedCostUsd = calculateCostUsd(usage);
    return {
      text,
      model: MODEL,
      estimatedCostUsd,
      estimatedCostJpy: typeof estimatedCostUsd === "number" ? estimatedCostUsd * USD_TO_JPY : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
