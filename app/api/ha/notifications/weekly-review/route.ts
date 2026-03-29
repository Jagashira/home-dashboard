import { NextRequest, NextResponse } from "next/server";
import { APP_CONFIG } from "@/lib/config";
import { buildUriAction, isAuthorizedHomeAssistantRequest } from "@/lib/ha";
import { getWeeklyReview } from "@/lib/weekly-review";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedHomeAssistantRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const review = await getWeeklyReview();
    const messageLines = [
      `${review.week.label} の週次レビューです。`,
      `支出 ${new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(review.budget.total)} / 完了 task ${review.tasks.completedCount} 件`,
      `ニュース ${review.news.publishedCount} 件 / 写真 ${review.immich.photoAddedCount} 枚 / 動画 ${review.immich.videoAddedCount} 本`
    ];

    return NextResponse.json({
      ok: true,
      review,
      notification: {
        title: "今週の振り返り",
        message: messageLines.join("\n"),
        data: {
          tag: "weekly-review",
          group: "weekly-review",
          url: APP_CONFIG.haWeeklyReviewUri,
          actions: [
            buildUriAction("レビューを見る", APP_CONFIG.haWeeklyReviewUri),
            buildUriAction("ホームを開く", APP_CONFIG.haHomeUri)
          ],
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
