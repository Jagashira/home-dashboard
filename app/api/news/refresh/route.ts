import { NextResponse } from "next/server";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { runFetchNews } from "@/lib/services/fetch-news";

export async function POST() {
  try {
    ensureNewsBootstrap();
    const result = await runFetchNews();

    return NextResponse.json({
      ok: true,
      totalFetched: result.totalFetched,
      inserted: result.inserted,
      semiconductorAnalyzed: result.semiconductorAnalyzed,
      totalRequested: result.totalRequested,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
