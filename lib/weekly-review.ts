import { prisma } from "@/lib/prisma";
import { getDb } from "@/lib/db";
import { getImmichSummary } from "@/lib/immich";

type WeekRange = {
  start: Date;
  end: Date;
  startYmd: string;
  endYmd: string;
  label: string;
};

type BudgetCategoryRow = {
  category: string;
  total: number;
};

type NewsTopicRow = {
  topic_name: string;
  count: number;
};

type NewsFavoriteRow = {
  count: number;
};

type ImmichAssetStats = {
  total?: number;
};

export type WeeklyReviewData = {
  week: WeekRange;
  previousWeek: WeekRange;
  highlights: Array<{ label: string; value: string; note: string }>;
  budget: {
    total: number;
    previousTotal: number;
    deltaPercent: number | null;
    topCategories: Array<{ label: string; value: number }>;
  };
  tasks: {
    completedCount: number;
    addedCount: number;
    carryOverCount: number;
    recentCompletedTitles: string[];
  };
  news: {
    publishedCount: number;
    favoriteCount: number;
    topTopics: Array<{ label: string; count: number }>;
  };
  immich: {
    available: boolean;
    photoAddedCount: number;
    videoAddedCount: number;
    storageUsedLabel: string;
    storageTotalLabel: string;
    note: string;
  };
  reviewText: string;
};

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric"
  }).format(value);
}

function getWeekRange(now = new Date()): WeekRange {
  const today = startOfDay(now);
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = addDays(today, diffToMonday);
  const end = endOfDay(addDays(start, 6));

  return {
    start,
    end,
    startYmd: formatDate(start),
    endYmd: formatDate(end),
    label: `${formatDateLabel(start)} - ${formatDateLabel(end)}`
  };
}

function getPreviousWeekRange(current: WeekRange): WeekRange {
  const start = addDays(current.start, -7);
  const end = endOfDay(addDays(start, 6));
  return {
    start,
    end,
    startYmd: formatDate(start),
    endYmd: formatDate(end),
    label: `${formatDateLabel(start)} - ${formatDateLabel(end)}`
  };
}

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

function calcDeltaPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatDeltaText(deltaPercent: number | null, suffix = "") {
  if (deltaPercent === null) return `先週比データなし${suffix}`;
  if (deltaPercent === 0) return `先週比 ±0%${suffix}`;
  return `先週比 ${deltaPercent > 0 ? "+" : ""}${deltaPercent}%${suffix}`;
}

function buildReviewText(input: {
  budgetTotal: number;
  budgetDeltaPercent: number | null;
  taskCompleted: number;
  newsPublished: number;
  photoAddedCount: number;
  videoAddedCount: number;
}) {
  const budgetTone =
    input.budgetDeltaPercent === null
      ? "支出の比較データはまだ少なめです。"
      : input.budgetDeltaPercent > 0
        ? `支出は先週より ${input.budgetDeltaPercent}% 増えました。`
        : input.budgetDeltaPercent < 0
          ? `支出は先週より ${Math.abs(input.budgetDeltaPercent)}% 落ち着きました。`
          : "支出は先週とほぼ同じペースでした。";

  return [
    `今週の支出は ${formatYen(input.budgetTotal)}、完了 task は ${input.taskCompleted} 件です。`,
    `${budgetTone} ニュースは ${input.newsPublished} 件追加されています。`,
    `Immich には写真 ${input.photoAddedCount} 枚、動画 ${input.videoAddedCount} 本が増えました。`
  ].join(" ");
}

async function fetchImmichAssetCount(range: WeekRange, type: "IMAGE" | "VIDEO") {
  const summary = await getImmichSummary();
  if (!summary.available) {
    return { available: false, total: 0, summary };
  }

  const baseUrl = summary.href.startsWith("http") ? summary.href.replace(/\/+$/, "") : "";
  if (!baseUrl) {
    return { available: false, total: 0, summary };
  }

  const body = {
    createdAfter: range.start.toISOString(),
    createdBefore: range.end.toISOString(),
    type
  };

  const paths = ["/api/search/statistics", "/api/search/metadata/statistics"];

  for (const path of paths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.IMMICH_API_KEY || ""
        },
        body: JSON.stringify(body),
        cache: "no-store"
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as ImmichAssetStats;
      return { available: true, total: Number(payload.total ?? 0), summary };
    } catch {
      continue;
    }
  }

  return { available: true, total: 0, summary };
}

export async function getWeeklyReview(now = new Date()): Promise<WeeklyReviewData> {
  const week = getWeekRange(now);
  const previousWeek = getPreviousWeekRange(week);

  const budgetTotals = await prisma.$queryRaw<Array<{ currentTotal: number; previousTotal: number }>>`
    SELECT
      COALESCE(SUM(CASE WHEN entryType = 'EXPENSE' AND date >= ${week.startYmd} AND date <= ${week.endYmd} THEN amount ELSE 0 END), 0) AS currentTotal,
      COALESCE(SUM(CASE WHEN entryType = 'EXPENSE' AND date >= ${previousWeek.startYmd} AND date <= ${previousWeek.endYmd} THEN amount ELSE 0 END), 0) AS previousTotal
    FROM "BudgetEntry"
  `.catch(() => [{ currentTotal: 0, previousTotal: 0 }]);

  const budgetTopCategories = await prisma.$queryRaw<BudgetCategoryRow[]>`
    SELECT category, COALESCE(SUM(amount), 0) AS total
    FROM "BudgetEntry"
    WHERE entryType = 'EXPENSE'
      AND date >= ${week.startYmd}
      AND date <= ${week.endYmd}
    GROUP BY category
    ORDER BY total DESC
    LIMIT 3
  `.catch(() => [] as BudgetCategoryRow[]);

  const [completedCount, addedCount, carryOverCount, recentCompleted] = await Promise.all([
    prisma.task.count({
      where: {
        status: "done",
        updatedAt: { gte: week.start, lte: week.end }
      }
    }),
    prisma.task.count({
      where: {
        createdAt: { gte: week.start, lte: week.end }
      }
    }),
    prisma.task.count({
      where: {
        status: "todo",
        createdAt: { lt: week.start }
      }
    }),
    prisma.task.findMany({
      where: {
        status: "done",
        updatedAt: { gte: week.start, lte: week.end }
      },
      orderBy: { updatedAt: "desc" },
      take: 3
    })
  ]);

  const db = getDb();
  const newsPublishedRows = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM articles a
      WHERE a.published_at IS NOT NULL
        AND date(a.published_at) >= ?
        AND date(a.published_at) <= ?
    `
    )
    .all(week.startYmd, week.endYmd) as Array<{ count: number }>;

  const newsFavoriteRows = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM articles a
      WHERE a.is_favorite = 1
        AND a.published_at IS NOT NULL
        AND date(a.published_at) >= ?
        AND date(a.published_at) <= ?
    `
    )
    .all(week.startYmd, week.endYmd) as NewsFavoriteRow[];

  const newsTopTopics = db
    .prepare(
      `
      SELECT t.name as topic_name, COUNT(*) as count
      FROM articles a
      JOIN topics t ON t.id = a.topic_id
      WHERE a.published_at IS NOT NULL
        AND date(a.published_at) >= ?
        AND date(a.published_at) <= ?
      GROUP BY t.name
      ORDER BY count DESC, t.name ASC
      LIMIT 3
    `
    )
    .all(week.startYmd, week.endYmd) as NewsTopicRow[];

  const [immichImages, immichVideos] = await Promise.all([
    fetchImmichAssetCount(week, "IMAGE"),
    fetchImmichAssetCount(week, "VIDEO")
  ]);

  const immichSummary = immichImages.summary;
  const budgetCurrentTotal = Number(budgetTotals[0]?.currentTotal ?? 0);
  const budgetPreviousTotal = Number(budgetTotals[0]?.previousTotal ?? 0);
  const budgetDeltaPercent = calcDeltaPercent(budgetCurrentTotal, budgetPreviousTotal);
  const photoAddedCount = immichImages.total;
  const videoAddedCount = immichVideos.total;

  return {
    week,
    previousWeek,
    highlights: [
      {
        label: "支出",
        value: formatYen(budgetCurrentTotal),
        note: formatDeltaText(budgetDeltaPercent)
      },
      {
        label: "完了 task",
        value: `${completedCount} 件`,
        note: `追加 ${addedCount} 件 / 持ち越し ${carryOverCount} 件`
      },
      {
        label: "ニュース",
        value: `${Number(newsPublishedRows[0]?.count ?? 0)} 件`,
        note: `お気に入り ${Number(newsFavoriteRows[0]?.count ?? 0)} 件`
      },
      {
        label: "Immich",
        value: `${photoAddedCount + videoAddedCount} 件`,
        note: immichSummary.available ? `写真 ${photoAddedCount} / 動画 ${videoAddedCount}` : "Immich 未接続"
      }
    ],
    budget: {
      total: budgetCurrentTotal,
      previousTotal: budgetPreviousTotal,
      deltaPercent: budgetDeltaPercent,
      topCategories: budgetTopCategories.map((row) => ({ label: row.category || "未分類", value: Number(row.total) }))
    },
    tasks: {
      completedCount,
      addedCount,
      carryOverCount,
      recentCompletedTitles: recentCompleted.map((task) => task.title)
    },
    news: {
      publishedCount: Number(newsPublishedRows[0]?.count ?? 0),
      favoriteCount: Number(newsFavoriteRows[0]?.count ?? 0),
      topTopics: newsTopTopics.map((row) => ({ label: row.topic_name, count: Number(row.count) }))
    },
    immich: {
      available: immichSummary.available,
      photoAddedCount,
      videoAddedCount,
      storageUsedLabel: immichSummary.storage.usedLabel,
      storageTotalLabel: immichSummary.storage.totalLabel,
      note: immichSummary.available
        ? `NAS ${immichSummary.storage.usedLabel} / ${immichSummary.storage.totalLabel}`
        : "Immich API が未設定です"
    },
    reviewText: buildReviewText({
      budgetTotal: budgetCurrentTotal,
      budgetDeltaPercent,
      taskCompleted: completedCount,
      newsPublished: Number(newsPublishedRows[0]?.count ?? 0),
      photoAddedCount,
      videoAddedCount
    })
  };
}
