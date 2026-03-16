import { BillingBackLink, SimpleLineChart } from "../billing-ui";
import { formatYen, getWaterBillingDashboard } from "@/lib/home-billing";

export const dynamic = "force-dynamic";

export default function WaterBillingPage() {
  const dashboard = getWaterBillingDashboard();

  return (
    <section className="stack-lg">
      <section className="panel water-billing-hero">
        <div className="water-billing-grid" aria-hidden="true" />
        <div className="stack-md water-billing-hero-body">
          <p className="label-caption">WATER LEDGER</p>
          <h1 className="budget-title">{dashboard.title}</h1>
          <p className="status-text">
            {dashboard.description} 編集元は `lib/water-costs.ts` です。金額だけを記録し、月換算は自動で半分にしています。
          </p>
          <div className="actions-row">
            <BillingBackLink />
            <span className="inline-code">編集: lib/water-costs.ts</span>
          </div>
        </div>
      </section>

      <section className="grid-2 budget-summary-grid">
        <article className="panel budget-metric">
          <p className="label-caption">最新請求額</p>
          <h3>{dashboard.latestItem ? formatYen(dashboard.latestItem.amount) : "-"}</h3>
          <p className="status-text">{dashboard.latestItem?.billingMonth ?? "未入力"}</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">月換算</p>
          <h3>{dashboard.latestItem ? formatYen(Math.round(dashboard.monthlyEquivalent)) : "-"}</h3>
          <p className="status-text">2か月請求を月あたりに均した値</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">年換算</p>
          <h3>{dashboard.latestItem ? formatYen(Math.round(dashboard.yearlyEquivalent)) : "-"}</h3>
          <p className="status-text">年6回請求として換算</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">比較対象</p>
          <h3>{dashboard.previousItem ? formatYen(dashboard.previousItem.amount) : "-"}</h3>
          <p className="status-text">{dashboard.previousItem?.billingMonth ?? "まだ1件のみ"}</p>
        </article>
      </section>

      <SimpleLineChart
        title="隔月請求推移"
        subtitle="2か月ごとの請求月だけを並べて表示"
        points={dashboard.amountChart}
        valueFormat="currency"
        emptyText="まだ水道料金が入力されていません"
      />

      <section className="water-billing-layout">
        <section className="panel fixed-cost-card">
          <h3>請求月一覧</h3>
          {dashboard.items.length === 0 ? (
            <p className="status-text">まだ請求額が入力されていません。</p>
          ) : (
            <div className="fixed-cost-list">
              {dashboard.items.map((entry) => (
                <article className="fixed-cost-item" key={entry.id}>
                  <div className="fixed-cost-item-main">
                    <div className="subscription-item-title-row">
                      <strong>{entry.billingMonth}</strong>
                      <span className="subscription-cadence-chip">隔月</span>
                    </div>
                    {entry.note ? <p className="subscription-item-note">{entry.note}</p> : null}
                  </div>
                  <div className="subscription-item-price">
                    <span>請求額</span>
                    <strong>{formatYen(entry.amount)}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel fixed-cost-card">
          <h3>入力メモ</h3>
          <p className="status-text">
            今は金額だけを管理します。請求が来た月を `billingMonth` に入れて、`active: true` に切り替えてください。
          </p>
          <div className="fixed-cost-template-grid">
            {dashboard.templates.map((entry) => (
              <article className="fixed-cost-template" key={entry.id}>
                <strong>{entry.billingMonth}</strong>
                <p className="subscription-item-meta">請求額 {formatYen(entry.amount)}</p>
                <p className="subscription-item-note">{entry.note ?? "テンプレート"}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}
