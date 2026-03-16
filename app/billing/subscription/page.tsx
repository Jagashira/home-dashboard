import Link from "next/link";
import { BillingBackLink } from "../billing-ui";
import { formatYen } from "@/lib/home-billing";
import {
  getSubscriptionCategoryLabel,
  getSubscriptionDashboard,
  subscriptionEntries,
  toMonthlyAmount,
  toYearlyAmount
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

function formatCadence(value: "monthly" | "yearly") {
  return value === "monthly" ? "月額" : "年額";
}

export default function SubscriptionBillingPage() {
  const dashboard = getSubscriptionDashboard();

  return (
    <section className="stack-lg">
      <section className="panel billing-subscription-hero">
        <div className="billing-subscription-orb" aria-hidden="true" />
        <div className="stack-md billing-subscription-hero-body">
          <p className="label-caption">SUBSCRIPTIONS</p>
          <h1 className="budget-title">Subscription Ledger</h1>
          <p className="status-text">
            API 連携ではなく、手動管理する固定費の台帳です。必要なものをローカル定義に足していく前提で作っています。
          </p>
          <div className="actions-row">
            <BillingBackLink />
            <span className="inline-code">編集: lib/subscriptions.ts</span>
          </div>
        </div>
      </section>

      <section className="grid-2 budget-summary-grid">
        <article className="panel budget-metric">
          <p className="label-caption">月額換算合計</p>
          <h3>{formatYen(Math.round(dashboard.monthlyTotal))}</h3>
          <p className="status-text">有効: {dashboard.activeEntries.length} 件</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">年額換算合計</p>
          <h3>{formatYen(Math.round(dashboard.yearlyTotal))}</h3>
          <p className="status-text">年間固定費の目安</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">次の課金日</p>
          <h3>{dashboard.nextBilling?.billingDay ? `${dashboard.nextBilling.billingDay}日` : "-"}</h3>
          <p className="status-text">{dashboard.nextBilling?.name ?? "未設定"}</p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">編集対象</p>
          <h3>{subscriptionEntries.length} 件</h3>
          <p className="status-text">無効化した項目も含む</p>
        </article>
      </section>

      <section className="subscription-board">
        {dashboard.grouped.map((group) => (
          <section className="panel subscription-group-card" key={group.category}>
            <div className="subscription-group-head">
              <div>
                <p className="label-caption">{group.category}</p>
                <h3>{formatYen(Math.round(group.subtotalMonthly))}</h3>
              </div>
              <span className="subscription-group-count">{group.items.length} 件</span>
            </div>
            <div className="subscription-list">
              {group.items.map((entry) => (
                <article className="subscription-item" key={entry.id}>
                  <div className="subscription-item-main">
                    <div className="subscription-item-title-row">
                      <strong>{entry.name}</strong>
                      <span className="subscription-cadence-chip">{formatCadence(entry.cadence)}</span>
                    </div>
                    <p className="subscription-item-meta">
                      月額換算 {formatYen(Math.round(toMonthlyAmount(entry)))} / 年額換算 {formatYen(Math.round(toYearlyAmount(entry)))}
                    </p>
                    <p className="subscription-item-meta">
                      課金日: {entry.billingDay ? `${entry.billingDay}日` : "未設定"} / {getSubscriptionCategoryLabel(entry.category)}
                    </p>
                    {entry.note ? <p className="subscription-item-note">{entry.note}</p> : null}
                  </div>
                  <div className="subscription-item-price">
                    <span>{formatCadence(entry.cadence)}</span>
                    <strong>{formatYen(entry.price)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className="panel subscription-manual-card">
        <div className="stack-sm">
          <h3>追加ルール</h3>
          <p className="status-text">
            まずは [subscriptions.ts](/Users/jagashira/work/github.com/Jagashira/home-dashboard/lib/subscriptions.ts) に 1 件ずつ足す運用です。
          </p>
        </div>
        <div className="subscription-manual-grid">
          <div className="subscription-manual-step">
            <span>1</span>
            <p>`name / category / price / cadence` を追加</p>
          </div>
          <div className="subscription-manual-step">
            <span>2</span>
            <p>`billingDay` と `note` を任意で設定</p>
          </div>
          <div className="subscription-manual-step">
            <span>3</span>
            <p>止めたものは `active: false` にする</p>
          </div>
        </div>
      </section>
    </section>
  );
}
