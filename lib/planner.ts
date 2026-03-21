export type PlannerTask = {
  id: string;
  title: string;
  note: string | null;
  minutes: number;
  progressMinutes: number;
  canSplit: boolean;
  importance: number;
  dueDate: Date | null;
  targetDate: Date | null;
  status: string;
};

export type RankedPlannerTask = PlannerTask & {
  remainingMinutes: number;
  progressRatio: number;
  daysToTarget: number | null;
  daysToDeadline: number | null;
  startSoon: boolean;
  warningLevel: "overdue" | "critical" | "attention" | "normal";
  priorityScore: number;
  paceScore: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function diffDaysFrom(base: Date, target: Date) {
  const baseDay = startOfDay(base);
  const targetDay = startOfDay(target);
  return Math.round((targetDay.getTime() - baseDay.getTime()) / 86400000);
}

function computeDatePressure(days: number | null, overdueWeight: number) {
  if (days === null) return 18;
  if (days < 0) return overdueWeight;
  if (days === 0) return 94;
  if (days === 1) return 84;
  if (days <= 3) return 68;
  if (days <= 7) return 52;
  if (days <= 14) return 34;
  return 16;
}

export function rankTasks(tasks: PlannerTask[], now = new Date()): RankedPlannerTask[] {
  return tasks
    .filter((task) => task.status === "todo" && task.minutes > 0)
    .map((task) => {
      const remainingMinutes = Math.max(0, task.minutes - task.progressMinutes);
      const progressRatio = clamp(task.progressMinutes / task.minutes, 0, 1);
      const daysToTarget = task.targetDate ? diffDaysFrom(now, task.targetDate) : null;
      const daysToDeadline = task.dueDate ? diffDaysFrom(now, task.dueDate) : null;
      const nearestDays =
        daysToTarget !== null && daysToDeadline !== null
          ? Math.min(daysToTarget, daysToDeadline)
          : daysToTarget ?? daysToDeadline;
      const daysWindow = nearestDays === null ? 14 : Math.max(1, nearestDays + 1);
      const pacePerDayHours = remainingMinutes / 60 / daysWindow;
      const paceScore = clamp(Math.round(pacePerDayHours * 34), 0, 100);
      const importanceScore = clamp(task.importance * 20, 20, 100);
      const targetScore = computeDatePressure(daysToTarget, 100);
      const deadlineScore = computeDatePressure(daysToDeadline, 100);
      const progressBoost = progressRatio > 0 && progressRatio < 1 ? 12 : 0;
      const priorityScore = Math.round(
        importanceScore * 0.36 + targetScore * 0.28 + deadlineScore * 0.24 + paceScore * 0.12 + progressBoost
      );
      const startSoon =
        remainingMinutes > 0 &&
        ((daysToTarget !== null && daysToTarget <= Math.ceil(remainingMinutes / 120)) ||
          (daysToDeadline !== null && daysToDeadline <= Math.ceil(remainingMinutes / 180)));

      let warningLevel: RankedPlannerTask["warningLevel"] = "normal";
      if ((daysToTarget !== null && daysToTarget < 0) || (daysToDeadline !== null && daysToDeadline < 0)) {
        warningLevel = "overdue";
      } else if ((daysToTarget !== null && daysToTarget <= 0) || (daysToDeadline !== null && daysToDeadline <= 1)) {
        warningLevel = "critical";
      } else if (startSoon || (daysToDeadline !== null && daysToDeadline <= 3)) {
        warningLevel = "attention";
      }

      return {
        ...task,
        remainingMinutes,
        progressRatio,
        daysToTarget,
        daysToDeadline,
        startSoon,
        warningLevel,
        priorityScore,
        paceScore
      };
    })
    .sort((a, b) => {
      if (a.warningLevel !== b.warningLevel) {
        const rank = { overdue: 3, critical: 2, attention: 1, normal: 0 };
        return rank[b.warningLevel] - rank[a.warningLevel];
      }
      if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
      if (a.remainingMinutes !== b.remainingMinutes) return a.remainingMinutes - b.remainingMinutes;
      return a.title.localeCompare(b.title, "ja");
    });
}
