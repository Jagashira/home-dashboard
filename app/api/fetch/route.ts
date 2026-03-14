import { NextRequest, NextResponse } from "next/server";
import { APP_CONFIG } from "@/lib/config";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { runFetchNews } from "@/lib/services/fetch-news";

export async function POST(request: NextRequest) {
  try {
    ensureNewsBootstrap();
    if (APP_CONFIG.fetchSecret) {
      const token =
        request.headers.get("x-fetch-secret") ||
        request.nextUrl.searchParams.get("secret") ||
        "";
      if (token !== APP_CONFIG.fetchSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await runFetchNews();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

