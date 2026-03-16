import Link from "next/link";
import { BillingBackLink, SimpleLineChart } from "../billing-ui";
import { formatGasUsage, formatYen, getGasDashboard } from "@/lib/home-billing";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type GasChartView = "usage" | "charge";

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getGasChartView(value: string): GasChartView {
  return value === "charge" ? "charge" : "usage";
}

function buildGasHref(view: GasChartView) {
  return `/billing/gas?view=${view}`;
}

export default async function GasBillingPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  try {
    const resolved = searchParams ? await searchParams : {};
    const view = getGasChartView(getString(resolved.view));
    const dashboard = await getGasDashboard();

    const chartPoints = view === "charge" ? dashboard.chargeChart : dashboard.usageChart;
    const chartTitle = view === "charge" ? "月別ガス料金" : "月別ガス使用量";
    const chartSubtitle =
      view === "charge" ? "取得済みの月別買上額を表示" : "取得済みの月別使用量を表示";
    const chartFormat = view === "charge" ? "currency" : "gas";

    return (
      <section className="stack-lg">
        <section className="panel budget-hero billing-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <p className="label-caption">GAS BILLING</p>
            <h1 className="budget-title">{dashboard.title}</h1>
            <p className="status-text">{dashboard.description}</p>
            <div className="actions-row">
              <BillingBackLink />
            </div>
          </div>
        </section>

        <section className="grid-2 budget-summary-grid">
          <article className="panel budget-metric">
            <p className="label-caption">最新月使用量</p>
            <h3>{dashboard.latestItem ? `${formatGasUsage(dashboard.latestItem.usage_value)} ${dashboard.latestItem.usage_unit ?? "m3"}` : "-"}</h3>
            <p className="status-text">{dashboard.latestItem?.billing_month ?? "データなし"}</p>
          </article>
          <article className="panel budget-metric">
            <p className="label-caption">最新月料金</p>
            <h3>{dashboard.latestItem ? formatYen(dashboard.latestItem.charge_amount) : "-"}</h3>
            <p className="status-text">
              使用日数: {dashboard.latestItem?.usage_days ? `${dashboard.latestItem.usage_days}日` : "-"}
            </p>
          </article>
        </section>

        <SimpleLineChart
          title={chartTitle}
          subtitle={chartSubtitle}
          points={chartPoints}
          valueFormat={chartFormat}
          controls={
            <div className="billing-switch-row">
              <div className="chip-row budget-chip-group">
                <Link className={`chip ${view === "usage" ? "chip-active" : ""}`} href={buildGasHref("usage")}>
                  使用量
                </Link>
                <Link className={`chip ${view === "charge" ? "chip-active" : ""}`} href={buildGasHref("charge")}>
                  料金
                </Link>
              </div>
            </div>
          }
        />

        <section className="panel billing-table-card">
          <h3>月別一覧</h3>
          {dashboard.items.length === 0 ? (
            <p className="status-text">表示データがありません</p>
          ) : (
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>月</th>
                    <th>使用量</th>
                    <th>料金</th>
                    <th className="billing-col-desktop">使用日数</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.items.map((item) => (
                    <tr key={`${item.provider_name}-${item.billing_month}`}>
                      <td>{item.billing_month}</td>
                      <td>{item.usage_value === null ? "-" : `${formatGasUsage(item.usage_value)} ${item.usage_unit ?? "m3"}`}</td>
                      <td>{formatYen(item.charge_amount)}</td>
                      <td className="billing-col-desktop">{item.usage_days ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h1>ガス代</h1>
          <p className="error-text">データ取得に失敗しました。</p>
          <p className="status-text">{message}</p>
          <BillingBackLink />
        </section>
      </section>
    );
  }
}
