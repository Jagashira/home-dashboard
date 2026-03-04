import { NextRequest, NextResponse } from "next/server";

type SummarizePayload = {
  title?: string;
  summary?: string;
  url?: string;
};

const OPENAI_API_BASE = "https://api.openai.com/v1";

function buildPrompt(payload: SummarizePayload): string {
  return [
    `Title: ${payload.title ?? ""}`,
    `URL: ${payload.url ?? ""}`,
    `Snippet: ${payload.summary ?? ""}`
  ].join("\n");
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

    const response = await fetch(`${OPENAI_API_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        max_output_tokens: 260,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You summarize tech news in Japanese. Return concise markdown with: 1) 要点(2-3行) 2) 重要ポイント(箇条書き3点以内)."
              }
            ]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildPrompt(payload) }]
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
    const summary = responseJson.output_text as string | undefined;

    if (!summary) {
      return NextResponse.json(
        { ok: false, error: "No summary generated." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
