import { NextResponse } from "next/server";
import { getPlannerSnapshot } from "@/lib/planner-data";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const MODEL = "gpt-4.1-mini";
const PRICING_PER_1M = {
  input: Number(process.env.OPENAI_PRICE_INPUT_PER_1M ?? "0.4"),
  cachedInput: Number(process.env.OPENAI_PRICE_CACHED_INPUT_PER_1M ?? "0.1"),
  output: Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M ?? "1.6")
};
const USD_TO_JPY = Number(process.env.OPENAI_USD_TO_JPY ?? "150");

type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

function calculateCostUsd(usage: ResponsesUsage | undefined): number | null {
  if (!usage) return null;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const uncachedInput = Math.max(0, input - cached);
  return (
    (uncachedInput / 1_000_000) * PRICING_PER_1M.input +
    (cached / 1_000_000) * PRICING_PER_1M.cachedInput +
    (output / 1_000_000) * PRICING_PER_1M.output
  );
}

function extractText(responseJson: unknown): string | null {
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

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API is not set." }, { status: 500 });
    }

    const { rankedTasks } = await getPlannerSnapshot();
    const prompt = [
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Tasks:\n${rankedTasks
        .map(
          (task, index) =>
            `${index + 1}. ${task.title} remaining=${task.remainingMinutes}m importance=${task.importance} target=${task.targetDate ? task.targetDate.toISOString().slice(0, 10) : "none"} final=${task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "none"} warning=${task.warningLevel}`
        )
        .join("\n") || "none"}`,
      "",
      "日本語で、上から着手する理由と、今日どこまで進めるとよいかを短く提案してください。",
      "出力形式: プレーンテキスト"
    ].join("\n");

    const response = await fetch(`${OPENAI_API_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.25,
        max_output_tokens: 400,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: "You are a practical Japanese task planning assistant." }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI request failed (${response.status}): ${errorBody.slice(0, 220)}` },
        { status: 500 }
      );
    }

    const responseJson = await response.json();
    const suggestion = extractText(responseJson);
    if (!suggestion) {
      return NextResponse.json({ ok: false, error: "No suggestion generated." }, { status: 500 });
    }

    const usage = (responseJson as { usage?: ResponsesUsage }).usage;
    const estimatedCostUsd = calculateCostUsd(usage);

    return NextResponse.json({
      ok: true,
      suggestion,
      usage: usage ?? null,
      estimatedCostUsd,
      estimatedCostJpy: typeof estimatedCostUsd === "number" ? estimatedCostUsd * USD_TO_JPY : null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
