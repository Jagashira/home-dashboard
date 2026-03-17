import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildDayRange,
  buildFreeBlocks,
  buildPlan,
  type PlannerPlanBlock,
  type TimeBlock
} from "@/lib/planner";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const MODEL = "gpt-4.1-mini";
const PRICING_PER_1M = {
  input: Number(process.env.OPENAI_PRICE_INPUT_PER_1M ?? "0.4"),
  cachedInput: Number(process.env.OPENAI_PRICE_CACHED_INPUT_PER_1M ?? "0.1"),
  output: Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M ?? "1.6")
};
const USD_TO_JPY = Number(process.env.OPENAI_USD_TO_JPY ?? "150");

type FatigueEvent = {
  fatigue: number;
};

type CalendarBlockEvent = {
  startAt: Date;
  endAt: Date;
  title: string;
  tag: string;
  fatigue: number;
};

type PlannerTaskRow = {
  id: string;
  title: string;
  minutes: number;
  importance: number;
  fatigue: number;
  dueDate: Date | null;
};

type ResponsesUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

function hm(value: Date): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

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
      return NextResponse.json(
        { ok: false, error: "OPENAI_API is not set." },
        { status: 500 }
      );
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const events = await prisma.calendarEvent.findMany({
      where: {
        startAt: { gte: dayStart, lte: dayEnd }
      },
      orderBy: { startAt: "asc" }
    });

    const fatigueTotal = events.reduce(
      (sum: number, event: FatigueEvent) => sum + event.fatigue,
      0
    );

    const { start, end } = buildDayRange(new Date(), "08:00", "24:00");
    const freeBlocks = buildFreeBlocks(
      events.map((event: CalendarBlockEvent) => ({ startAt: event.startAt, endAt: event.endAt })),
      start,
      end
    );

    const tasksTodo = await prisma.task.findMany({
      where: { status: "todo" },
      orderBy: [{ dueDate: "asc" }, { importance: "desc" }, { createdAt: "asc" }]
    });

    const plan = buildPlan(
      tasksTodo.map((task: PlannerTaskRow) => ({
        id: task.id,
        title: task.title,
        minutes: task.minutes,
        importance: task.importance,
        fatigue: task.fatigue,
        dueDate: task.dueDate
      })),
      freeBlocks
    );

    const movementHints = events
      .filter((event: CalendarBlockEvent) => event.tag === "OUT")
      .map((event: CalendarBlockEvent) => `${hm(event.startAt)}-${hm(event.endAt)} ${event.title}`);

    const prompt = [
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `FatigueTotal: ${fatigueTotal}`,
      `Events:\n${events.map((event: CalendarBlockEvent) => `- ${hm(event.startAt)}-${hm(event.endAt)} [${event.tag}] fatigue=${event.fatigue} ${event.title}`).join("\n") || "- none"}`,
      `FreeBlocks:\n${freeBlocks.map((block: TimeBlock) => `- ${block.start}-${block.end} (${block.minutes}m)`).join("\n") || "- none"}`,
      `TasksTodo:\n${tasksTodo.map((task: PlannerTaskRow) => `- ${task.title} ${task.minutes}m imp=${task.importance} fatigue=${task.fatigue} due=${task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "none"}`).join("\n") || "- none"}`,
      `BasePlan:\n${plan.map((block: PlannerPlanBlock) => `- ${block.block.start}-${block.block.end}: ${block.items.map((item: PlannerPlanBlock["items"][number]) => `${item.title}(${item.minutes}m)`).join(", ") || "(empty)"}`).join("\n") || "- none"}`,
      `MovementHints:\n${movementHints.map((hint: string) => `- ${hint}`).join("\n") || "- none"}`,
      "",
      "日本語で、今日の実行プランを提案してください。",
      "条件:",
      "- 外出(OUT)や移動を考慮して、前後に移動/準備バッファを提案する",
      "- 疲れ度が高い時間帯の直後には重いタスクを避ける",
      "- 空き時間に入る具体的タスクを時刻付きで示す",
      "- 最後に『今日はこれだけやればOK』を3項目以内で示す",
      "出力形式: プレーンテキスト（Markdown記号 # * - は使わない）"
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${OPENAI_API_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.25,
        max_output_tokens: 600,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are a practical Japanese daily planner assistant."
              }
            ]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

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
    const estimatedCostJpy = typeof estimatedCostUsd === "number" ? estimatedCostUsd * USD_TO_JPY : null;

    return NextResponse.json({
      ok: true,
      suggestion,
      usage: usage ?? null,
      estimatedCostUsd,
      estimatedCostJpy
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
