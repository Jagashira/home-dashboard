import Link from "next/link";
import {
  BillingBackLink,
  BillingHistoryTable,
  ElectricityUsagePanel,
  SimpleLineChart
} from "../billing-ui";
import { getElectricityDashboard } from "@/lib/home-billing";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ChartView = "monthly" | "daily" | "hourly";

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getChartView(value: string): ChartView {
  if (value === "daily" || value === "hourly") return value;
  return "monthly";
}

function buildElectricityHref(month: string | null, view: ChartView) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  params.set("view", view);
  return `/billing/electricity?${params.toString()}`;
}

export default async function ElectricityBillingPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  try {
    const resolved = searchParams ? await searchParams : {};
    const month = getString(resolved.month);
    const view = getChartView(getString(resolved.view));
    const dashboard = await getElectricityDashboard(month || null);
    const chartPoints =
      view === "daily"
        ? dashboard.dailyUsageChart
        : view === "hourly"
          ? dashboard.hourlyUsageChart
          : dashboard.amountChart;
    const chartTitle =
      view === "daily" ? "日別使用量" : view === "hourly" ? "時間別使用量" : "月別請求推移";
    const chartSubtitle =
      view === "daily"
        ? dashboard.selectedMonth
          ? `${dashboard.selectedMonth} の日別使用量`
          : "使用量データなし"
        : view === "hourly"
          ? dashboard.selectedMonth
            ? `${dashboard.selectedMonth} の時間別平均使用量`
            : "使用量データなし"
          : "全月の電気代を表示";
    const chartFormat = view === "monthly" ? "currency" : "kwh";

    return (
      <section className="stack-lg">
        <section className="panel budget-hero billing-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <p className="label-caption">ELECTRICITY BILLING</p>
            <h1 className="budget-title">{dashboard.title}</h1>
            <p className="status-text">{dashboard.description}</p>
            <div className="actions-row">
              <BillingBackLink />
            </div>
          </div>
        </section>

        <section className="panel billing-switch-row">
          <div className="chip-row budget-chip-group">
            <Link
              className={`chip ${view === "monthly" ? "chip-active" : ""}`}
              href={buildElectricityHref(dashboard.selectedMonth, "monthly")}
            >
              月別
            </Link>
            <Link
              className={`chip ${view === "daily" ? "chip-active" : ""}`}
              href={buildElectricityHref(dashboard.selectedMonth, "daily")}
            >
              日別
            </Link>
            <Link
              className={`chip ${view === "hourly" ? "chip-active" : ""}`}
              href={buildElectricityHref(dashboard.selectedMonth, "hourly")}
            >
              時間別
            </Link>
          </div>
          <div className="chip-row budget-chip-group">
            {dashboard.months.length === 0 ? (
              <span className="status-text">使用量データがありません</span>
            ) : (
              dashboard.months.map((item) => (
                <Link
                  className={`chip ${dashboard.selectedMonth === item ? "chip-active" : ""}`}
                  href={buildElectricityHref(item, view)}
                  key={item}
                >
                  {item}
                </Link>
              ))
            )}
          </div>
        </section>

        <ElectricityUsagePanel
          totalUsageKwh={dashboard.usageSummary?.total_usage_kwh ?? null}
          averageUsageKwh={dashboard.usageSummary?.average_usage_kwh ?? null}
          maxUsageKwh={dashboard.usageSummary?.max_usage_kwh ?? null}
          pointCount={dashboard.usageSummary?.point_count ?? null}
        />

        <SimpleLineChart
          title={chartTitle}
          subtitle={chartSubtitle}
          points={chartPoints}
          valueFormat={chartFormat}
        />

        <BillingHistoryTable title="全月一覧" records={dashboard.records} />
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h1>電気代</h1>
          <p className="error-text">データ取得に失敗しました。</p>
          <p className="status-text">{message}</p>
          <BillingBackLink />
        </section>
      </section>
    );
  }
}
