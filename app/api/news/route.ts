import { NextRequest, NextResponse } from "next/server";
import { fetchNews } from "@/lib/mcp/client";
import { NewsApiResponse } from "@/lib/types/news";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const query = (request.nextUrl.searchParams.get("query") || "AI").trim();
    const maxResults = parsePositiveInt(request.nextUrl.searchParams.get("max_results"), 5);
    const days = parsePositiveInt(request.nextUrl.searchParams.get("days"), 2);

    const data = await fetchNews({
      query,
      max_results: Math.min(20, maxResults),
      days: Math.min(30, days)
    });

    return NextResponse.json(data satisfies NewsApiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message } satisfies NewsApiResponse, { status: 500 });
  }
}
