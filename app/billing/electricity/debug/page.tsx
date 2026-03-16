import Link from "next/link";
import {
  ELECTRICITY_PROVIDER,
  formatKwh
} from "@/lib/home-billing";
import {
  fetchElectricityUsageDaily,
  fetchElectricityUsageHourly,
  fetchElectricityUsageMonths
} from "@/lib/home-billing-api";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildHref(month: string) {
  return `/billing/electricity/debug?month=${encodeURIComponent(month)}`;
}

export default async function ElectricityDebugPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  try {
    const resolved = searchParams ? await searchParams : {};
    const months = await fetchElectricityUsageMonths({
      providerName: ELECTRICITY_PROVIDER,
      limit: 24
    });
    const selectedMonth = getString(resolved.month) || months.items[0]?.billing_month || "";

    if (!selectedMonth) {
      return (
        <section className="stack-lg">
          <section className="panel error-panel">
            <h1>Electricity Debug</h1>
            <p className="error-text">使用量データがまだありません。</p>
            <p className="status-text">months.items.length: {months.items.length}</p>
            <pre className="summary-box">{JSON.stringify(months, null, 2)}</pre>
            <Link className="button-secondary" href="/billing/electricity">
              電気代ページへ戻る
            </Link>
          </section>
        </section>
      );
    }

    const [daily, hourly] = await Promise.all([
      fetchElectricityUsageDaily({
        providerName: ELECTRICITY_PROVIDER,
        billingMonth: selectedMonth
      }),
      fetchElectricityUsageHourly({
        providerName: ELECTRICITY_PROVIDER,
        billingMonth: selectedMonth
      })
    ]);

    return (
      <section className="stack-lg">
        <section className="panel budget-hero billing-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <p className="label-caption">ELECTRICITY DEBUG</p>
            <h1 className="budget-title">Daily / Hourly Fetch Check</h1>
            <p className="status-text">
              `home-billing-api` から日別・時間別データを直接取得できているか確認する一時ページです。
            </p>
            <div className="actions-row">
              <Link className="button-secondary" href="/billing/electricity">
                電気代ページへ戻る
              </Link>
            </div>
          </div>
        </section>

        <section className="panel billing-switch-row">
          <p className="label-caption">対象月</p>
          <div className="chip-row budget-chip-group">
            {months.items.map((item) => (
              <Link
                className={`chip ${item.billing_month === selectedMonth ? "chip-active" : ""}`}
                href={buildHref(item.billing_month)}
                key={item.billing_month}
              >
                {item.billing_month}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid-2 budget-summary-grid">
          <article className="panel budget-metric">
            <p className="label-caption">月一覧件数</p>
            <h3>{months.items.length}</h3>
            <p className="status-text">selected: {selectedMonth}</p>
          </article>
          <article className="panel budget-metric">
            <p className="label-caption">日別件数</p>
            <h3>{daily.days.length}</h3>
            <p className="status-text">billing_month: {daily.billing_month}</p>
          </article>
          <article className="panel budget-metric">
            <p className="label-caption">時間別件数</p>
            <h3>{hourly.hours.length}</h3>
            <p className="status-text">billing_month: {hourly.billing_month}</p>
          </article>
        </section>

        <section className="grid-2 budget-dashboard-grid">
          <section className="panel billing-table-card">
            <h3>日別データ</h3>
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>使用量</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.days.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{formatKwh(day.usage_kwh)} kWh</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel billing-table-card">
            <h3>時間別データ</h3>
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>時間帯</th>
                    <th>使用量</th>
                    <th>平均</th>
                  </tr>
                </thead>
                <tbody>
                  {hourly.hours.map((hour) => (
                    <tr key={hour.slot}>
                      <td>{hour.slot}</td>
                      <td>{formatKwh(hour.usage_kwh)} kWh</td>
                      <td>{formatKwh(hour.average_usage_kwh)} kWh</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <section className="grid-2 budget-dashboard-grid">
          <section className="panel">
            <h3>日別レスポンス</h3>
            <pre className="summary-box">{JSON.stringify(daily, null, 2)}</pre>
          </section>
          <section className="panel">
            <h3>時間別レスポンス</h3>
            <pre className="summary-box">{JSON.stringify(hourly, null, 2)}</pre>
          </section>
        </section>
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h1>Electricity Debug</h1>
          <p className="error-text">日別 / 時間別データの取得確認に失敗しました。</p>
          <p className="status-text">{message}</p>
          <Link className="button-secondary" href="/billing/electricity">
            電気代ページへ戻る
          </Link>
        </section>
      </section>
    );
  }
}
