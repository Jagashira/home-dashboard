import { NextRequest, NextResponse } from "next/server";
import { listNewsArticles } from "@/lib/news-dashboard";

export async function GET(request: NextRequest) {
  try {
    const topic = request.nextUrl.searchParams.get("topic")?.trim() || undefined;
    const items = await listNewsArticles(topic);
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
