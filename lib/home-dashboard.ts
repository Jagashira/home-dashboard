import { getPlannerSnapshot } from "@/lib/planner-data";
import { getBillingCategorySummaries, formatYen } from "@/lib/home-billing";
import { getLatestFetchRun } from "@/lib/repositories/fetch-runs";
import { getSettings } from "@/lib/repositories/settings";
import { listTables } from "@/lib/db-browser";

export type HomeQuickStatus = {
  title: string;
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: "blue" | "green" | "orange" | "neutral";
};

export type HomePrimaryCard = {
  title: string;
  href: string;
  eyebrow: string;
  description: string;
  meta: string;
  stat: string;
  variant: "action" | "kpi" | "list" | "status";
  tone: "blue" | "green" | "orange" | "neutral";
};

export type HomeSupportCard = {
  title: string;
  href: string;
  description: string;
};

export type HomeDashboardData = {
  todayLabel: string;
  heroTitle: string;
  heroDescription: string;
  focusSummary: string;
  focusItems: Array<{ label: string; value: string; note: string }>;
  primaryActions: Array<{ label: string; href: string; kind: "primary" | "secondary" }>;
  quickStatuses: HomeQuickStatus[];
  primaryCards: HomePrimaryCard[];
  supportCards: HomeSupportCard[];
};

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatRelativeShort(value: string | null) {
  if (!value) return "更新なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新なし";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export async function getHomeDashboardData(now = new Date()): Promise<HomeDashboardData> {
  const [planner, settings] = await Promise.all([getPlannerSnapshot(now), Promise.resolve(getSettings())]);
  const latestRun = getLatestFetchRun();
  const tableCount = listTables().length;

  let billingTotal = 0;
  let billingActiveCount = 0;
  let billingSummaryText = "未取得";

  try {
    const summaries = await getBillingCategorySummaries();
    const latestBillingRows = summaries.filter((item) => item.latestRecord);
    billingActiveCount = latestBillingRows.length;
    billingTotal = latestBillingRows.reduce((sum, item) => sum + (item.latestRecord?.total_amount ?? 0), 0);
    billingSummaryText = latestBillingRows.length > 0 ? formatYen(billingTotal) : "データなし";
  } catch {
    billingSummaryText = "接続待ち";
  }

  const recommendedTitle = planner.recommendedNow?.title ?? "優先タスクはまだありません";
  const newsCount = latestRun?.total_fetched ?? 0;
  const alertCount = planner.attentionCount;
  const openAiUsage = {
    href: "https://platform.openai.com/usage",
    available: false,
    monthLabel: new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(now),
    monthSpendLabel: "読み込み中…",
    todaySpendLabel: "読み込み中…",
    totalTokensLabel: "読み込み中…"
  };

  return {
    todayLabel: formatDateLabel(now),
    heroTitle: "今日のフォーカス",
    heroDescription: `最初に触る画面と、今の状態だけを静かにまとめたホーム。次に開くべき導線が迷わない構成にする。`,
    focusSummary: planner.recommendedNow ? `Next: ${planner.recommendedNow.title}` : "Next: 新しいタスクを追加",
    focusItems: [
      {
        label: "未完了タスク",
        value: `${planner.tasksTodo.length}`,
        note: alertCount > 0 ? `注意 ${alertCount} 件` : "落ち着いて進行中"
      },
      {
        label: "新着ニュース",
        value: `${newsCount}`,
        note: latestRun ? `最終更新 ${formatRelativeShort(latestRun.finished_at)}` : "まだ取得なし"
      },
      {
        label: "請求確認",
        value: billingSummaryText,
        note: billingActiveCount > 0 ? `${billingActiveCount} カテゴリを確認可能` : "請求データ待ち"
      }
    ],
    primaryActions: [
      { label: "Tasks を開く", href: "/tasks", kind: "primary" },
      { label: "News を開く", href: "/news", kind: "secondary" }
    ],
    quickStatuses: [
      {
        title: "House",
        label: "System",
        value: "Ready",
        detail: "3Dビューをそのまま開ける",
        href: "/ha/house",
        tone: "neutral"
      },
      {
        title: "Tasks",
        label: "Queue",
        value: `${planner.tasksTodo.length}`,
        detail: planner.recommendedNow ? `次: ${planner.recommendedNow.title}` : "未完了なし",
        href: "/tasks",
        tone: "orange"
      },
      {
        title: "Billing",
        label: "Finance",
        value: billingSummaryText,
        detail: billingActiveCount > 0 ? "最新の請求を集約" : "データ接続待ち",
        href: "/billing",
        tone: "green"
      },
      {
        title: "News",
        label: "Feed",
        value: `${newsCount}`,
        detail: latestRun ? `設定: ${settings.totalRequested} 件取得` : "まだ最新取得なし",
        href: "/news",
        tone: "blue"
      },
      {
        title: "GPT",
        label: "OpenAI",
        value: openAiUsage.monthSpendLabel,
        detail: `今日 ${openAiUsage.todaySpendLabel} · Tok ${openAiUsage.totalTokensLabel}`,
        href: openAiUsage.href,
        tone: openAiUsage.available ? "green" : "neutral"
      }
    ],
    primaryCards: [
      {
        title: "News",
        href: "/news",
        eyebrow: "Action",
        description: "新着と気になる記事をまとめて確認。",
        meta: latestRun ? `最終取得 ${formatRelativeShort(latestRun.finished_at)}` : "最新取得待ち",
        stat: `${newsCount} items`,
        variant: "action",
        tone: "blue"
      },
      {
        title: "Tasks",
        href: "/tasks",
        eyebrow: "List",
        description: recommendedTitle,
        meta: planner.tasksTodo.length > 0 ? `未完了 ${planner.tasksTodo.length} 件` : "今日の未完了なし",
        stat: `${planner.tasksTodo.length} open`,
        variant: "list",
        tone: "orange"
      },
      {
        title: "Billing",
        href: "/billing",
        eyebrow: "KPI",
        description: "家計まわりの請求と固定費を一覧で確認。",
        meta: billingSummaryText,
        stat: billingActiveCount > 0 ? `${billingActiveCount} streams` : "0 stream",
        variant: "kpi",
        tone: "green"
      },
      {
        title: "House",
        href: "/ha/house",
        eyebrow: "Status",
        description: "家のビューと状態確認の入口。",
        meta: "Viewer ready",
        stat: "Live view",
        variant: "status",
        tone: "neutral"
      },
      {
        title: "GPT",
        href: openAiUsage.href,
        eyebrow: "Usage",
        description: `今日 ${openAiUsage.todaySpendLabel} / Token ${openAiUsage.totalTokensLabel}`,
        meta: openAiUsage.monthLabel,
        stat: openAiUsage.monthSpendLabel,
        variant: "kpi",
        tone: openAiUsage.available ? "green" : "neutral"
      }
    ],
    supportCards: [
      {
        title: "Database",
        href: "/db",
        description: `${tableCount} テーブルを検索・編集`
      },
      {
        title: "Budget",
        href: "/budget",
        description: "月次の収支と支出の整理"
      },
      {
        title: "Shop",
        href: "/shop",
        description: "買い物メモと候補整理"
      },
      {
        title: "Admin",
        href: "/news/settings",
        description: "ニュース取得設定とメンテナンス"
      }
    ]
  };
}
