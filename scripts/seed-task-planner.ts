import { prisma } from "../lib/prisma";

function dayOffset(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

const sampleTasks = [
  {
    id: "sample-overdue-final",
    title: "提出資料の最終版を送る",
    note: "すでに最終期限を過ぎているパターン",
    minutes: 90,
    progressMinutes: 30,
    canSplit: true,
    importance: 5,
    fatigue: 0,
    urgency: 5,
    targetDate: dayOffset(-2),
    dueDate: dayOffset(-1),
    status: "todo"
  },
  {
    id: "sample-overdue-target",
    title: "レビューコメントを反映する",
    note: "目標期限だけを過ぎているパターン",
    minutes: 60,
    progressMinutes: 0,
    canSplit: true,
    importance: 4,
    fatigue: 0,
    urgency: 4,
    targetDate: dayOffset(-1),
    dueDate: dayOffset(2),
    status: "todo"
  },
  {
    id: "sample-critical-today",
    title: "今日中の返信メールをまとめる",
    note: "今日が期限のパターン",
    minutes: 45,
    progressMinutes: 0,
    canSplit: true,
    importance: 5,
    fatigue: 0,
    urgency: 5,
    targetDate: dayOffset(0),
    dueDate: dayOffset(1),
    status: "todo"
  },
  {
    id: "sample-attention-large",
    title: "週末までの買い替え比較表を作る",
    note: "残工数が多く、そろそろ始めるべきパターン",
    minutes: 240,
    progressMinutes: 60,
    canSplit: true,
    importance: 4,
    fatigue: 0,
    urgency: 3,
    targetDate: dayOffset(2),
    dueDate: dayOffset(5),
    status: "todo"
  },
  {
    id: "sample-attention-short",
    title: "明日の持ち物リストを作る",
    note: "短いが期限が近いパターン",
    minutes: 30,
    progressMinutes: 0,
    canSplit: true,
    importance: 3,
    fatigue: 0,
    urgency: 4,
    targetDate: dayOffset(1),
    dueDate: dayOffset(2),
    status: "todo"
  },
  {
    id: "sample-normal-progress",
    title: "旅行候補を3つ比較する",
    note: "進捗途中でまだ余裕があるパターン",
    minutes: 180,
    progressMinutes: 90,
    canSplit: true,
    importance: 2,
    fatigue: 0,
    urgency: 2,
    targetDate: dayOffset(9),
    dueDate: dayOffset(16),
    status: "todo"
  },
  {
    id: "sample-normal-nodeadline",
    title: "本棚の整理ルールを決める",
    note: "期限なしのパターン",
    minutes: 120,
    progressMinutes: 0,
    canSplit: true,
    importance: 2,
    fatigue: 0,
    urgency: 2,
    targetDate: null,
    dueDate: null,
    status: "todo"
  },
  {
    id: "sample-normal-small",
    title: "Wi-Fi ルーター候補を1つに絞る",
    note: "優先度は高めだが短時間で終わるパターン",
    minutes: 40,
    progressMinutes: 0,
    canSplit: false,
    importance: 4,
    fatigue: 0,
    urgency: 4,
    targetDate: dayOffset(1),
    dueDate: dayOffset(4),
    status: "todo"
  },
  {
    id: "sample-done",
    title: "家計簿のレシート入力",
    note: "完了済みサンプル",
    minutes: 30,
    progressMinutes: 30,
    canSplit: true,
    importance: 3,
    fatigue: 0,
    urgency: 3,
    targetDate: dayOffset(0),
    dueDate: dayOffset(1),
    status: "done"
  }
];

async function main() {
  for (const task of sampleTasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: task,
      create: task
    });
  }

  console.log(`sample seed done: tasks=${await prisma.task.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
