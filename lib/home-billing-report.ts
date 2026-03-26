import { getFixedCostDashboard } from "@/lib/fixed-costs";
import {
  formatGasUsage,
  formatKwh,
  formatYen,
  getElectricityDashboard,
  getGasDashboard,
  getInternetDashboard,
  getWaterBillingDashboard
} from "@/lib/home-billing";
import { getSubscriptionDashboard } from "@/lib/subscriptions";

type ReportSectionStatus<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type BillingReportMode = "month" | "year";

export type BillingReportOption = {
  key: string;
  label: string;
};

export type BillingReportMeta = {
  mode: BillingReportMode;
  period: string;
  title: string;
  months: BillingReportOption[];
  years: BillingReportOption[];
};

export type BillingReportData = BillingReportMeta & {
  generatedAtIso: string;
  generatedAtLabel: string;
  markdown: string;
};

type ParsedPeriod = {
  year: number;
  month: number;
  monthEnd: number;
  monthKey: string;
  yearKey: string;
};

function formatReportTimestamp(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo"
  }).format(value);
}

function formatMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${year}.${month}`;
}

function parseFlexiblePeriod(value: string): ParsedPeriod | null {
  const match = value.match(/(\d{2,4})\D+(\d{1,2})(?:\D+(\d{1,2}))?/);
  if (!match) return null;
  const rawYear = Number(match[1]);
  const year = match[1].length === 2 ? 2000 + rawYear : rawYear;
  const month = Number(match[2]);
  const monthEnd = match[3] ? Number(match[3]) : month;

  return {
    year,
    month,
    monthEnd,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    yearKey: String(year)
  };
}

async function captureSection<T>(loader: () => Promise<T>): Promise<ReportSectionStatus<T>> {
  try {
    return { ok: true, data: await loader() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error"
    };
  }
}

function appendLines(lines: string[], entries: Array<string | null | undefined>) {
  for (const entry of entries) {
    if (entry) lines.push(entry);
  }
}

function getRollingMonthKeys(count: number) {
  const current = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function uniqueOptions(keys: Iterable<string>, formatter: (key: string) => string) {
  return [...new Set(keys)]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      key,
      label: formatter(key)
    }));
}

export async function getBillingReportMeta(): Promise<BillingReportMeta> {
  const [internetSection, gasSection, electricitySection] = await Promise.all([
    captureSection(() => getInternetDashboard()),
    captureSection(() => getGasDashboard()),
    captureSection(() => getElectricityDashboard())
  ]);
  const water = getWaterBillingDashboard();

  const detectedMonthKeys = new Set<string>(getRollingMonthKeys(12));
  const detectedYearKeys = new Set<string>([String(new Date().getFullYear())]);

  const collect = (values: string[]) => {
    for (const value of values) {
      const parsed = parseFlexiblePeriod(value);
      if (!parsed) continue;
      for (let month = parsed.month; month <= parsed.monthEnd; month += 1) {
        detectedMonthKeys.add(`${parsed.year}-${String(month).padStart(2, "0")}`);
      }
      detectedYearKeys.add(parsed.yearKey);
    }
  };

  if (internetSection.ok) collect(internetSection.data.records.map((record) => record.billing_month));
  if (gasSection.ok) collect(gasSection.data.items.map((item) => item.billing_month));
  if (electricitySection.ok) {
    collect(electricitySection.data.records.map((record) => record.billing_month));
    collect(electricitySection.data.months);
  }
  collect(water.items.map((item) => item.billingMonth));

  const months = uniqueOptions(detectedMonthKeys, formatMonthKey);
  const years = uniqueOptions(detectedYearKeys, (key) => key);
  const defaultMonth = months[0]?.key ?? getRollingMonthKeys(1)[0];
  const defaultYear = years[0]?.key ?? String(new Date().getFullYear());

  return {
    mode: "month",
    period: defaultMonth,
    title: `Billing Report ${formatMonthKey(defaultMonth)}`,
    months,
    years
  };
}

function isInMonthRange(value: string, monthKey: string) {
  const parsed = parseFlexiblePeriod(value);
  if (!parsed) return false;
  const [year, month] = monthKey.split("-").map(Number);
  if (parsed.year !== year) return false;
  return month >= parsed.month && month <= parsed.monthEnd;
}

function isInYear(value: string, yearKey: string) {
  const parsed = parseFlexiblePeriod(value);
  if (!parsed) return false;
  return parsed.yearKey === yearKey;
}

function toYearlyRecurring(monthlyTotal: number, yearKey: string) {
  return monthlyTotal * 12;
}

export async function getBillingReportData(input?: {
  mode?: string;
  period?: string;
}): Promise<BillingReportData> {
  const meta = await getBillingReportMeta();
  const mode: BillingReportMode = input?.mode === "year" ? "year" : "month";
  const monthPeriod = meta.months.some((item) => item.key === input?.period) ? input!.period! : meta.months[0]?.key ?? meta.period;
  const yearPeriod = meta.years.some((item) => item.key === input?.period) ? input!.period! : meta.years[0]?.key ?? String(new Date().getFullYear());
  const period = mode === "year" ? yearPeriod : monthPeriod;
  const generatedAt = new Date();

  const rent = getFixedCostDashboard("rent");
  const parking = getFixedCostDashboard("parking");
  const subscriptions = getSubscriptionDashboard();
  const water = getWaterBillingDashboard();

  const [internetSection, gasSection, electricitySection] = await Promise.all([
    captureSection(() => getInternetDashboard()),
    captureSection(() => getGasDashboard()),
    captureSection(() => getElectricityDashboard())
  ]);

  const matchingInternet =
    internetSection.ok
      ? internetSection.data.records.filter((record) =>
          mode === "month" ? isInMonthRange(record.billing_month, period) : isInYear(record.billing_month, period)
        )
      : [];
  const matchingGas =
    gasSection.ok
      ? gasSection.data.items.filter((item) =>
          mode === "month" ? isInMonthRange(item.billing_month, period) : isInYear(item.billing_month, period)
        )
      : [];
  const matchingWater = water.items.filter((item) =>
    mode === "month" ? isInMonthRange(item.billingMonth, period) : isInYear(item.billingMonth, period)
  );
  const matchingElectricityBills =
    electricitySection.ok
      ? electricitySection.data.records.filter((record) =>
          mode === "month" ? isInMonthRange(record.billing_month, period) : isInYear(record.billing_month, period)
        )
      : [];

  const selectedElectricityMonth =
    mode === "month" && electricitySection.ok
      ? electricitySection.data.months.find((item) => isInMonthRange(item, period)) ?? null
      : null;
  const electricityUsageSection =
    mode === "month" && selectedElectricityMonth
      ? await captureSection(() => getElectricityDashboard(selectedElectricityMonth))
      : null;

  const fixedMonthly =
    rent.monthlyTotal + parking.monthlyTotal + subscriptions.monthlyTotal + water.monthlyEquivalent;
  const fixedPeriodTotal =
    mode === "month" ? fixedMonthly : toYearlyRecurring(rent.monthlyTotal + parking.monthlyTotal + subscriptions.monthlyTotal, period) + matchingWater.reduce((sum, item) => sum + item.amount, 0);
  const servicePeriodTotal =
    matchingInternet.reduce((sum, item) => sum + item.total_amount, 0) +
    matchingGas.reduce((sum, item) => sum + item.charge_amount, 0) +
    matchingElectricityBills.reduce((sum, item) => sum + item.total_amount, 0);
  const knownTotal = fixedPeriodTotal + servicePeriodTotal;

  const title = mode === "month" ? `Billing Report ${formatMonthKey(period)}` : `Billing Report ${period}`;

  const lines: string[] = [
    `# ${title}`,
    "",
    `- Generated: ${formatReportTimestamp(generatedAt)}`,
    `- Scope: ${mode === "month" ? `month ${formatMonthKey(period)}` : `year ${period}`}`,
    `- Fixed total: ${formatYen(Math.round(fixedPeriodTotal))}`,
    `- Service total: ${formatYen(Math.round(servicePeriodTotal))}`,
    `- Known total: ${formatYen(Math.round(knownTotal))}`,
    ""
  ];

  lines.push("## Fixed Ledger", "");
  appendLines(lines, [
    `- 家賃: ${mode === "month" ? formatYen(Math.round(rent.monthlyTotal)) : formatYen(Math.round(toYearlyRecurring(rent.monthlyTotal, period)))}`,
    ...rent.recurringEntries.map((entry) => `  - ${entry.name}: ${formatYen(entry.amount)} / month`),
    `- 駐車代: ${mode === "month" ? formatYen(Math.round(parking.monthlyTotal)) : formatYen(Math.round(toYearlyRecurring(parking.monthlyTotal, period)))}`,
    ...parking.recurringEntries.map((entry) => `  - ${entry.name}: ${formatYen(entry.amount)} / month`),
    `- サブスク: ${mode === "month" ? formatYen(Math.round(subscriptions.monthlyTotal)) : formatYen(Math.round(subscriptions.yearlyTotal))}`,
    ...subscriptions.activeEntries.map(
      (entry) => `  - ${entry.name}: ${formatYen(entry.price)} / ${entry.cadence === "monthly" ? "month" : "year"}`
    ),
    `- 水道: ${matchingWater.length > 0 ? matchingWater.map((item) => `${item.billingMonth} ${formatYen(item.amount)}`).join(", ") : "対象請求なし"}`,
    `  - 月換算目安: ${formatYen(Math.round(water.monthlyEquivalent))}`
  ]);

  lines.push("", "## Service Bills", "");

  if (internetSection.ok) {
    if (matchingInternet.length === 0) {
      lines.push("- インターネット: 対象月/年の請求なし");
    } else {
      lines.push(`- インターネット合計: ${formatYen(matchingInternet.reduce((sum, item) => sum + item.total_amount, 0))}`);
      for (const item of matchingInternet) {
        lines.push(`  - ${item.billing_month}: ${formatYen(item.total_amount)}`);
      }
    }
  } else {
    lines.push(`- インターネット: 取得失敗 (${internetSection.error})`);
  }

  if (gasSection.ok) {
    if (matchingGas.length === 0) {
      lines.push("- ガス: 対象月/年の請求なし");
    } else {
      lines.push(`- ガス合計: ${formatYen(matchingGas.reduce((sum, item) => sum + item.charge_amount, 0))}`);
      for (const item of matchingGas) {
        lines.push(
          `  - ${item.billing_month}: ${formatGasUsage(item.usage_value)} ${item.usage_unit ?? "m3"} / ${formatYen(item.charge_amount)}`
        );
      }
    }
  } else {
    lines.push(`- ガス: 取得失敗 (${gasSection.error})`);
  }

  if (electricitySection.ok) {
    if (matchingElectricityBills.length === 0) {
      lines.push("- 電気請求: 対象月/年の請求なし");
    } else {
      lines.push(`- 電気請求合計: ${formatYen(matchingElectricityBills.reduce((sum, item) => sum + item.total_amount, 0))}`);
      for (const item of matchingElectricityBills) {
        lines.push(`  - ${item.billing_month}: ${formatYen(item.total_amount)}`);
      }
    }

    if (electricityUsageSection?.ok && electricityUsageSection.data.usageSummary) {
      const summary = electricityUsageSection.data.usageSummary;
      lines.push(
        `- 電気使用量: ${summary.billing_month} 合計 ${formatKwh(summary.total_usage_kwh)} kWh / 平均 ${formatKwh(summary.average_usage_kwh)} kWh`
      );
    } else if (mode === "month") {
      lines.push("- 電気使用量: 対象月の使用量データなし");
    }
  } else {
    lines.push(`- 電気: 取得失敗 (${electricitySection.error})`);
  }

  lines.push("", "## Water Bills", "");
  if (matchingWater.length === 0) {
    lines.push(mode === "month" ? "- この月にかかる水道請求は未登録" : "- この年の水道請求は未登録");
  } else {
    for (const item of matchingWater) {
      lines.push(`- ${item.billingMonth}: ${formatYen(item.amount)}`);
    }
  }

  lines.push("");

  return {
    generatedAtIso: generatedAt.toISOString(),
    generatedAtLabel: formatReportTimestamp(generatedAt),
    mode,
    period,
    title,
    months: meta.months,
    years: meta.years,
    markdown: lines.join("\n")
  };
}
