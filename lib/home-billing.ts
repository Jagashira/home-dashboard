import {
  BillingRecord,
  ElectricityUsagePoint,
  fetchBillingHistory,
  fetchElectricityUsageMonths,
  fetchElectricityUsageSummary,
  fetchElectricityUsageTimeSeries
} from "@/lib/home-billing-api";

export const BILLING_ROUTE = "/billing";
export const INTERNET_PROVIDER = "softbank_internet";
export const ELECTRICITY_PROVIDER = "hepco_electricity";

export type BillingCategoryKey =
  | "gas"
  | "water"
  | "rent"
  | "parking"
  | "internet"
  | "electricity"
  | "subscription"
  | "other";

export type BillingCategorySummary = {
  key: BillingCategoryKey;
  title: string;
  description: string;
  href?: string;
  latestRecord: BillingRecord | null;
  previousRecord: BillingRecord | null;
  diffAmount: number | null;
  diffPercent: number | null;
};

export type BillingLinePoint = {
  label: string;
  value: number;
};

export type BillingDetailDashboard = {
  title: string;
  description: string;
  records: BillingRecord[];
  amountChart: BillingLinePoint[];
};

export type ElectricityDetailDashboard = BillingDetailDashboard & {
  months: string[];
  selectedMonth: string | null;
  usageSummary: Awaited<ReturnType<typeof fetchElectricityUsageSummary>> | null;
  usageChart: BillingLinePoint[];
  dailyUsageChart: BillingLinePoint[];
  hourlyUsageChart: BillingLinePoint[];
  usagePoints: ElectricityUsagePoint[];
};

type CategoryMeta = {
  title: string;
  description: string;
  href?: string;
};

const CATEGORY_META: Record<BillingCategoryKey, CategoryMeta> = {
  gas: {
    title: "ガス代",
    description: "ガス利用料"
  },
  water: {
    title: "水道代",
    description: "上下水道料金"
  },
  rent: {
    title: "家賃",
    description: "賃貸・住宅費"
  },
  parking: {
    title: "駐車代",
    description: "駐車場・車庫費用"
  },
  internet: {
    title: "インターネット代",
    description: "固定回線・通信費",
    href: `${BILLING_ROUTE}/internet`
  },
  electricity: {
    title: "電気代",
    description: "電力料金と使用量",
    href: `${BILLING_ROUTE}/electricity`
  },
  subscription: {
    title: "サブスク",
    description: "定期課金サービス"
  },
  other: {
    title: "その他",
    description: "分類外の固定費"
  }
};

const CATEGORY_ORDER: BillingCategoryKey[] = [
  "gas",
  "water",
  "rent",
  "parking",
  "internet",
  "electricity",
  "subscription",
  "other"
];

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseBillingMonth(value: string) {
  const jp = value.match(/(\d{4})\D+(\d{1,2})/);
  if (jp) {
    const year = Number(jp[1]);
    const month = Number(jp[2]);
    return { year, month, sortValue: year * 100 + month };
  }

  const iso = value.match(/(\d{4})-(\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    return { year, month, sortValue: year * 100 + month };
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      sortValue: date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1)
    };
  }

  return null;
}

function formatMonthLabel(value: string) {
  const parsed = parseBillingMonth(value);
  if (!parsed) return value;
  return `${parsed.year}.${String(parsed.month).padStart(2, "0")}`;
}

export function formatYen(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatKwh(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);
}

export function formatDiff(amount: number | null, percent: number | null) {
  if (amount === null || percent === null) return "前月データなし";
  const sign = amount > 0 ? "+" : "";
  const percentSign = percent > 0 ? "+" : "";
  return `${sign}${formatYen(amount)} / ${percentSign}${percent.toFixed(1)}%`;
}

function compareRecordsDesc(a: BillingRecord, b: BillingRecord) {
  const aMonth = parseBillingMonth(a.billing_month)?.sortValue ?? 0;
  const bMonth = parseBillingMonth(b.billing_month)?.sortValue ?? 0;
  if (aMonth !== bMonth) return bMonth - aMonth;

  const aFetched = Date.parse(a.fetched_at);
  const bFetched = Date.parse(b.fetched_at);
  return bFetched - aFetched;
}

function recordToCategory(record: BillingRecord): BillingCategoryKey {
  const service = normalizeLabel(record.service_type);
  const provider = normalizeLabel(record.provider_name);
  const joined = `${service}:${provider}`;

  if (joined.includes("electricity") || joined.includes("denki") || joined.includes("hepco")) {
    return "electricity";
  }
  if (joined.includes("internet") || joined.includes("softbank") || joined.includes("wifi") || joined.includes("hikari")) {
    return "internet";
  }
  if (joined.includes("gas")) return "gas";
  if (joined.includes("water") || joined.includes("suido")) return "water";
  if (joined.includes("rent") || joined.includes("yachin") || joined.includes("house")) return "rent";
  if (joined.includes("parking") || joined.includes("carport") || joined.includes("chushajo")) return "parking";
  if (
    joined.includes("subscription") ||
    joined.includes("subsc") ||
    joined.includes("netflix") ||
    joined.includes("spotify") ||
    joined.includes("youtube")
  ) {
    return "subscription";
  }

  return "other";
}

function buildCategorySummary(key: BillingCategoryKey, records: BillingRecord[]): BillingCategorySummary {
  const sorted = [...records].sort(compareRecordsDesc);
  const latestRecord = sorted[0] ?? null;
  const previousRecord = sorted[1] ?? null;
  const diffAmount =
    latestRecord && previousRecord ? latestRecord.total_amount - previousRecord.total_amount : null;
  const diffPercent =
    latestRecord && previousRecord && previousRecord.total_amount !== 0
      ? (diffAmount! / previousRecord.total_amount) * 100
      : null;

  return {
    key,
    title: CATEGORY_META[key].title,
    description: CATEGORY_META[key].description,
    href: CATEGORY_META[key].href,
    latestRecord,
    previousRecord,
    diffAmount,
    diffPercent
  };
}

export async function getBillingCategorySummaries() {
  const history = await fetchBillingHistory({ limit: 240 });
  const grouped = new Map<BillingCategoryKey, BillingRecord[]>();

  for (const key of CATEGORY_ORDER) {
    grouped.set(key, []);
  }

  for (const record of history.items) {
    const key = recordToCategory(record);
    grouped.get(key)?.push(record);
  }

  return CATEGORY_ORDER.map((key) => buildCategorySummary(key, grouped.get(key) ?? []));
}

function buildAmountChart(records: BillingRecord[]) {
  return [...records]
    .sort((a, b) => compareRecordsDesc(b, a))
    .map((record) => ({
      label: formatMonthLabel(record.billing_month),
      value: record.total_amount
    }));
}

export async function getInternetDashboard(): Promise<BillingDetailDashboard> {
  const history = await fetchBillingHistory({
    serviceType: "internet",
    limit: 120
  });

  const records = [...history.items].sort(compareRecordsDesc);

  return {
    title: "インターネット代",
    description: "固定回線の請求推移を月別に確認します。",
    records,
    amountChart: buildAmountChart(records)
  };
}

function compactUsagePoints(points: ElectricityUsagePoint[]) {
  if (points.length <= 48) return points;

  const chunkSize = Math.ceil(points.length / 24);
  const result: ElectricityUsagePoint[] = [];

  for (let index = 0; index < points.length; index += chunkSize) {
    const chunk = points.slice(index, index + chunkSize);
    const average =
      chunk.reduce((total, point) => total + point.usage_kwh, 0) / Math.max(chunk.length, 1);
    result.push({
      measured_at: chunk[Math.floor(chunk.length / 2)]?.measured_at ?? chunk[0]!.measured_at,
      usage_kwh: average
    });
  }

  return result;
}

function formatUsageLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function aggregateDailyUsage(points: ElectricityUsagePoint[]) {
  const totals = new Map<string, number>();

  for (const point of points) {
    const date = new Date(point.measured_at);
    if (Number.isNaN(date.getTime())) continue;
    const label = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
    totals.set(label, (totals.get(label) ?? 0) + point.usage_kwh);
  }

  return [...totals.entries()].map(([label, value]) => ({
    label,
    value
  }));
}

function aggregateHourlyUsage(points: ElectricityUsagePoint[]) {
  const totals = new Map<number, { total: number; count: number }>();

  for (const point of points) {
    const date = new Date(point.measured_at);
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const current = totals.get(hour) ?? { total: 0, count: 0 };
    current.total += point.usage_kwh;
    current.count += 1;
    totals.set(hour, current);
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const current = totals.get(hour);
    return {
      label: `${String(hour).padStart(2, "0")}:00`,
      value: current ? current.total / current.count : 0
    };
  });
}

export async function getElectricityDashboard(selectedMonth?: string | null): Promise<ElectricityDetailDashboard> {
  const [history, monthsResponse] = await Promise.all([
    fetchBillingHistory({
      serviceType: "electricity",
      limit: 120
    }),
    fetchElectricityUsageMonths({
      providerName: ELECTRICITY_PROVIDER,
      limit: 24
    })
  ]);

  const records = [...history.items].sort(compareRecordsDesc);
  const months = monthsResponse.items.map((item) => item.billing_month);
  const activeMonth = selectedMonth && months.includes(selectedMonth) ? selectedMonth : months[0] ?? null;

  let usageSummary: Awaited<ReturnType<typeof fetchElectricityUsageSummary>> | null = null;
  let usagePoints: ElectricityUsagePoint[] = [];

  if (activeMonth) {
    const [summary, timeseries] = await Promise.all([
      fetchElectricityUsageSummary({
        providerName: ELECTRICITY_PROVIDER,
        billingMonth: activeMonth
      }),
      fetchElectricityUsageTimeSeries({
        providerName: ELECTRICITY_PROVIDER,
        billingMonth: activeMonth
      })
    ]);
    usageSummary = summary;
    usagePoints = timeseries.points;
  }

  const usageChart = compactUsagePoints(usagePoints).map((point) => ({
    label: formatUsageLabel(point.measured_at),
    value: point.usage_kwh
  }));

  return {
    title: "電気代",
    description: "月別請求と、選択月の使用量推移をまとめて確認します。",
    records,
    amountChart: buildAmountChart(records),
    months,
    selectedMonth: activeMonth,
    usageSummary,
    usageChart,
    dailyUsageChart: aggregateDailyUsage(usagePoints),
    hourlyUsageChart: aggregateHourlyUsage(usagePoints),
    usagePoints
  };
}
