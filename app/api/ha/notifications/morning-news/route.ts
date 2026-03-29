import { NextRequest, NextResponse } from "next/server";
import { APP_CONFIG } from "@/lib/config";
import { buildUriAction, isAuthorizedHomeAssistantRequest } from "@/lib/ha";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import { listArticles } from "@/lib/repositories/articles";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedHomeAssistantRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    ensureNewsBootstrap();

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "5");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(10, limitRaw)) : 5;
    const items = listArticles({ limit }).slice(0, limit);
    const topTitles = items.slice(0, 3).map((item, index) => `${index + 1}. ${item.title}`);
    const message =
      topTitles.length > 0
        ? `最新ニュースを ${items.length} 件取得しています。\n${topTitles.join("\n")}`
        : "最新ニュースはまだありません。ニュース画面を開いて更新してください。";

    return NextResponse.json({
      ok: true,
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        url: item.url,
        publishedAt: item.published_at,
        topic: item.topic_name,
        sourceLabel: item.source_label
      })),
      notification: {
        title: "朝のニュース",
        message,
        data: {
          tag: "daily-morning-news",
          group: "daily-checkins",
          url: APP_CONFIG.haNewsUri,
          actions: [buildUriAction("ニュースを開く", APP_CONFIG.haNewsUri)],
          push: {
            interruptionLevel: "active"
          }
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
