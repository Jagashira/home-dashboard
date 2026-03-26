import Link from "next/link";
import { BillingSummaryCard } from "./billing-ui";
import { getBillingCategorySummaries } from "@/lib/home-billing";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  try {
    const summaries = await getBillingCategorySummaries();

    return (
      <section className="stack-lg">
        <section className="panel budget-hero billing-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <p className="label-caption">UTILITY OVERVIEW</p>
            <h1 className="budget-title">Public Billing Dashboard</h1>
            <p className="status-text">
              先月分の請求金額と前月比をカテゴリ別に一覧します。詳細ページは電気代とインターネット代から開始します。
            </p>
            <div className="actions-row">
              <Link className="button-primary" href="/billing/report">
                レポート出力
              </Link>
              <Link className="button-secondary" href="/">
                ホームへ戻る
              </Link>
            </div>
          </div>
        </section>

        <section className="billing-summary-grid">
          {summaries.map((summary) => (
            <BillingSummaryCard key={summary.key} summary={summary} />
          ))}
        </section>
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h1>Billing Dashboard</h1>
          <p className="error-text">home-billing-api への接続に失敗しました。</p>
          <p className="status-text">{message}</p>
          <Link className="button-secondary" href="/">
            ホームへ戻る
          </Link>
        </section>
      </section>
    );
  }
}
