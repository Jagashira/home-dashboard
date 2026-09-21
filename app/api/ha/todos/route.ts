import { NextRequest, NextResponse } from "next/server";
import { getTokyoDateString, isAuthorizedHomeAssistantRequest } from "@/lib/ha";
import { getPlannerSnapshot } from "@/lib/planner-data";

function parseLimit(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit");
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, 100);
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedHomeAssistantRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const today = getTokyoDateString();
    const limit = parseLimit(request);
    const planner = await getPlannerSnapshot();
    const visibleTasks = limit === null ? planner.rankedTasks : planner.rankedTasks.slice(0, limit);

    const response = NextResponse.json({
      ok: true,
      date: today,
      count: planner.rankedTasks.length,
      displayedCount: visibleTasks.length,
      items: visibleTasks.map((task, index) => {
        const targetDate = task.targetDate ? task.targetDate.toISOString() : null;
        const dueDate = task.dueDate ? task.dueDate.toISOString() : null;

        return {
          id: task.id,
          title: task.title,
          completed: false,
          status: task.status,
          displayOrder: index + 1,
          importance: task.importance,
          targetDate,
          dueDate,
          isToday:
            (task.targetDate ? getTokyoDateString(task.targetDate) === today : false) ||
            (task.dueDate ? getTokyoDateString(task.dueDate) === today : false),
          warningLevel: task.warningLevel,
          progress: {
            completedMinutes: task.progressMinutes,
            totalMinutes: task.minutes,
            percent: Math.round(task.progressRatio * 100)
          }
        };
      })
    });

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
