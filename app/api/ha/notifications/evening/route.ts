import { NextRequest, NextResponse } from "next/server";
import { getExpenseTotalForDate } from "@/lib/budget";
import { APP_CONFIG } from "@/lib/config";
import { buildUriAction, formatYen, getTokyoDateString, isAuthorizedHomeAssistantRequest } from "@/lib/ha";
import { getPlannerSnapshot } from "@/lib/planner-data";

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedHomeAssistantRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const date = request.nextUrl.searchParams.get("date")?.trim() || getTokyoDateString();
    const [expenseTotal, planner] = await Promise.all([getExpenseTotalForDate(date), getPlannerSnapshot()]);

    const taskTitles = planner.tasksTodo.slice(0, 3).map((task) => task.title);
    const taskCount = planner.tasksTodo.length;
    const messageParts = [
      `${date} の支出は ${formatYen(expenseTotal)} 円です。`,
      taskCount > 0 ? `未完了 task は ${taskCount} 件あります。` : "未完了 task はありません。"
    ];

    if (taskTitles.length > 0) {
      messageParts.push(`優先候補: ${taskTitles.join(" / ")}`);
    }

    return NextResponse.json({
      ok: true,
      date,
      summary: {
        expenseTotal,
        taskCount,
        taskTitles
      },
      notification: {
        title: "今日の支出と task 確認",
        message: messageParts.join("\n"),
        data: {
          tag: "daily-evening-checkin",
          group: "daily-checkins",
          url: APP_CONFIG.haHomeUri,
          actions: [
            buildUriAction("支出を入力", APP_CONFIG.haExpenseUri),
            buildUriAction("taskを追加", APP_CONFIG.haTaskUri)
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
