import { NextRequest, NextResponse } from "next/server";
import { listArticles } from "@/lib/repositories/articles";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";

export async function GET(request: NextRequest) {
  try {
    ensureNewsBootstrap();
    const topic = request.nextUrl.searchParams.get("topic")?.trim() || undefined;
    const sourceType = request.nextUrl.searchParams.get("sourceType")?.trim() || undefined;
    const date = request.nextUrl.searchParams.get("date")?.trim() || undefined;
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const items = listArticles({ topic, sourceType, date, limit });
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
