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

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ElectricityBillingPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  try {
    const resolved = searchParams ? await searchParams : {};
    const month = getString(resolved.month);
    const dashboard = await getElectricityDashboard(month || null);

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

        <SimpleLineChart
          title="月別請求推移"
          subtitle="全月の電気代を表示"
          points={dashboard.amountChart}
          valueFormat="currency"
        />

        <section className="panel billing-switch-row">
          <div className="chip-row budget-chip-group">
            {dashboard.months.length === 0 ? (
              <span className="status-text">使用量データがありません</span>
            ) : (
              dashboard.months.map((item) => (
                <Link
                  className={`chip ${dashboard.selectedMonth === item ? "chip-active" : ""}`}
                  href={`/billing/electricity?month=${encodeURIComponent(item)}`}
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
          title="使用量推移"
          subtitle={dashboard.selectedMonth ? `${dashboard.selectedMonth} の使用量` : "使用量データなし"}
          points={dashboard.usageChart}
          valueFormat="kwh"
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
