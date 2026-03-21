import { prisma } from "@/lib/prisma";
import { rankTasks } from "@/lib/planner";

export async function getPlannerSnapshot(now = new Date()) {
  const tasks = await prisma.task.findMany({
    orderBy: [
      { status: "asc" },
      { targetDate: "asc" },
      { dueDate: "asc" },
      { importance: "desc" },
      { createdAt: "asc" }
    ]
  });

  const rankedTasks = rankTasks(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      note: task.note,
      minutes: task.minutes,
      progressMinutes: task.progressMinutes,
      canSplit: task.canSplit,
      importance: task.importance,
      dueDate: task.dueDate,
      targetDate: task.targetDate,
      status: task.status
    })),
    now
  );

  const doneTasks = tasks.filter((task) => task.status === "done");
  const attentionCount = rankedTasks.filter((task) => task.warningLevel !== "normal").length;

  return {
    tasksTodo: tasks.filter((task) => task.status === "todo"),
    doneTasks,
    rankedTasks,
    recommendedNow: rankedTasks[0] ?? null,
    attentionCount
  };
}
