import { BillingBackLink } from "./billing-ui";
import { formatYen } from "@/lib/home-billing";
import {
  FixedCostGroup,
  getFixedCostCategoryLabel,
  getFixedCostDashboard,
  toMonthlyEquivalent,
  toYearlyEquivalent
} from "@/lib/fixed-costs";

function formatCadence(value: "monthly" | "yearly" | "one_time") {
  if (value === "monthly") return "月次";
  if (value === "yearly") return "年次";
  return "一時費用";
}

export function FixedCostPage({ group }: { group: FixedCostGroup }) {
  const dashboard = getFixedCostDashboard(group);

  return (
    <section className="stack-lg">
      <section className="panel fixed-cost-hero">
        <div className="fixed-cost-grid" aria-hidden="true" />
        <div className="stack-md fixed-cost-hero-body">
          <p className="label-caption">FIXED COST LEDGER</p>
          <h1 className="budget-title">{dashboard.groupLabel}</h1>
          <p className="status-text">
            固定の月次費用と、一時費用を分けて手動管理するページです。編集元は `lib/fixed-costs.ts` です。
          </p>
          <div className="actions-row">
            <BillingBackLink />
            <span className="inline-code">編集: lib/fixed-costs.ts</span>
          </div>
        </div>
      </section>

      <section className="grid-2 budget-summary-grid">
        <article className="panel budget-metric">
          <p className="label-caption">月次合計</p>
          <h3>{formatYen(Math.round(dashboard.monthlyTotal))}</h3>
          <p className="status-text">継続固定費</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">年換算</p>
          <h3>{formatYen(Math.round(dashboard.yearlyTotal))}</h3>
          <p className="status-text">年間見込み</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">一時費用合計</p>
          <h3>{formatYen(Math.round(dashboard.oneTimeTotal))}</h3>
          <p className="status-text">契約時・更新時</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">次回課金日</p>
          <h3>{dashboard.nextBilling?.billingDay ? `${dashboard.nextBilling.billingDay}日` : "-"}</h3>
          <p className="status-text">{dashboard.nextBilling?.name ?? "未設定"}</p>
        </article>
      </section>

      <section className="fixed-cost-layout">
        <section className="panel fixed-cost-card">
          <h3>月次・年次費用</h3>
          {dashboard.recurringEntries.length === 0 ? (
            <p className="status-text">まだ有効な固定費がありません。テンプレートを編集して追加してください。</p>
          ) : (
            <div className="fixed-cost-list">
              {dashboard.recurringEntries.map((entry) => (
                <article className="fixed-cost-item" key={entry.id}>
                  <div className="fixed-cost-item-main">
                    <div className="subscription-item-title-row">
                      <strong>{entry.name}</strong>
                      <span className="subscription-cadence-chip">{formatCadence(entry.cadence)}</span>
                    </div>
                    <p className="subscription-item-meta">
                      {getFixedCostCategoryLabel(entry.category)} / 課金日: {entry.billingDay ? `${entry.billingDay}日` : "未設定"}
                    </p>
                    {entry.note ? <p className="subscription-item-note">{entry.note}</p> : null}
                  </div>
                  <div className="subscription-item-price">
                    <span>月換算</span>
                    <strong>{formatYen(Math.round(toMonthlyEquivalent(entry)))}</strong>
                    <span>年換算 {formatYen(Math.round(toYearlyEquivalent(entry)))}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel fixed-cost-card">
          <h3>一時費用</h3>
          {dashboard.oneTimeEntries.length === 0 ? (
            <p className="status-text">敷金・礼金・デポジットなどの一時費用はまだ設定されていません。</p>
          ) : (
            <div className="fixed-cost-list">
              {dashboard.oneTimeEntries.map((entry) => (
                <article className="fixed-cost-item" key={entry.id}>
                  <div className="fixed-cost-item-main">
                    <div className="subscription-item-title-row">
                      <strong>{entry.name}</strong>
                      <span className="subscription-cadence-chip">{getFixedCostCategoryLabel(entry.category)}</span>
                    </div>
                    {entry.note ? <p className="subscription-item-note">{entry.note}</p> : null}
                  </div>
                  <div className="subscription-item-price">
                    <span>一時費用</span>
                    <strong>{formatYen(entry.amount)}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel fixed-cost-card">
        <h3>テンプレート</h3>
        <p className="status-text">
          まずは下のテンプレートを実額で上書きして、必要なものだけ `active: true` にしてください。
        </p>
        <div className="fixed-cost-template-grid">
          {dashboard.templates.map((entry) => (
            <article className="fixed-cost-template" key={entry.id}>
              <strong>{entry.name}</strong>
              <p className="subscription-item-meta">{getFixedCostCategoryLabel(entry.category)}</p>
              <p className="subscription-item-note">{entry.note ?? "テンプレート"}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
