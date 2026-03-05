import { NextRequest, NextResponse } from "next/server";
import { toggleFavoriteNews } from "@/lib/news";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const newsItemId = typeof payload.newsItemId === "string" ? payload.newsItemId : "";

    if (!newsItemId) {
      return NextResponse.json({ ok: false, error: "newsItemId is required" }, { status: 400 });
    }

    const result = await toggleFavoriteNews(newsItemId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
