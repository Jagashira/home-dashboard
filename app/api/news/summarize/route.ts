import { NextRequest, NextResponse } from "next/server";

type SummarizePayload = {
  title?: string;
  summary?: string;
  url?: string;
};

const OPENAI_API_BASE = "https://api.openai.com/v1";
const MODEL = "gpt-4.1-mini";
const PRICING_PER_1M = {
  input: Number(process.env.OPENAI_PRICE_INPUT_PER_1M ?? "0.4"),
  cachedInput: Number(process.env.OPENAI_PRICE_CACHED_INPUT_PER_1M ?? "0.1"),
  output: Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M ?? "1.6")
};
const USD_TO_JPY = Number(process.env.OPENAI_USD_TO_JPY ?? "150");

function stripHtmlTags(source: string): string {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMainContentFromHtml(html: string): string {
  const candidates: string[] = [];
  const articleMatches = html.match(/<article[\s\S]*?<\/article>/gi) ?? [];
  const mainMatches = html.match(/<main[\s\S]*?<\/main>/gi) ?? [];

  candidates.push(...articleMatches, ...mainMatches);
  candidates.push(html);

  const normalized = candidates
    .map((candidate) => stripHtmlTags(candidate))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  return normalized[0] ?? "";
}

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    const html = await response.text();
    const content = extractMainContentFromHtml(html);
    if (content.length < 500) {
      return null;
    }

    return content.slice(0, 12000);
  } catch {
    return null;
  }
}

function buildPrompt(payload: SummarizePayload, articleBody: string | null): string {
  return [
    `Title: ${payload.title ?? ""}`,
    `URL: ${payload.url ?? ""}`,
    `Snippet: ${payload.summary ?? ""}`,
    "",
    articleBody
      ? `Full Article Body (extracted):\n${articleBody}`
      : "Full Article Body: unavailable (use snippet as fallback)."
  ].join("\n");
}

type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

function extractSummaryText(responseJson: unknown): string | null {
  if (!responseJson || typeof responseJson !== "object") {
    return null;
  }

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

function calculateCostUsd(usage: ResponsesUsage | undefined): number | null {
  if (!usage) {
    return null;
  }

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

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "OPENAI_API is not set. Add it to .env and restart the app."
        },
        { status: 500 }
      );
    }

    const payload = (await request.json()) as SummarizePayload;
    if (!payload.title && !payload.summary) {
      return NextResponse.json(
        { ok: false, error: "title or summary is required." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const articleBody = payload.url ? await fetchArticleText(payload.url) : null;
    const response = await fetch(`${OPENAI_API_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_output_tokens: 260,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You summarize tech news in Japanese. Return plain text only. Format: 1) 要点(2-3行) 2) 重要ポイント(3点以内)。Do not use markdown syntax like #, *, -, or code blocks."
              }
            ]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildPrompt(payload, articleBody) }]
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          ok: false,
          error: `OpenAI request failed (${response.status}): ${errorBody.slice(0, 220)}`
        },
        { status: 500 }
      );
    }

    const responseJson = await response.json();
    const summary = extractSummaryText(responseJson);

    if (!summary) {
      return NextResponse.json(
        { ok: false, error: "No summary generated." },
        { status: 500 }
      );
    }

    const usage = (responseJson as { usage?: ResponsesUsage }).usage;
    const estimatedCostUsd = calculateCostUsd(usage);
    const estimatedCostJpy =
      typeof estimatedCostUsd === "number" ? estimatedCostUsd * USD_TO_JPY : null;

    return NextResponse.json({
      ok: true,
      summary,
      usage: usage ?? null,
      estimatedCostUsd,
      estimatedCostJpy,
      usedFullArticle: Boolean(articleBody)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
