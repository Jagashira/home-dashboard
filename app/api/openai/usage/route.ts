import { NextResponse } from "next/server";
import { getOpenAiUsageSnapshot } from "@/lib/openai-usage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const usage = await getOpenAiUsageSnapshot();
    return NextResponse.json({ ok: true, usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
