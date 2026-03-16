import { BillingBackLink, BillingHistoryTable, SimpleLineChart } from "../billing-ui";
import { getInternetDashboard } from "@/lib/home-billing";

export const dynamic = "force-dynamic";

export default async function InternetBillingPage() {
  try {
    const dashboard = await getInternetDashboard();

    return (
      <section className="stack-lg">
        <section className="panel budget-hero billing-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <p className="label-caption">INTERNET BILLING</p>
            <h1 className="budget-title">{dashboard.title}</h1>
            <p className="status-text">{dashboard.description}</p>
            <div className="actions-row">
              <BillingBackLink />
            </div>
          </div>
        </section>

        <SimpleLineChart
          title="月別請求推移"
          subtitle="全月の請求額を表示"
          points={dashboard.amountChart}
          valueFormat="currency"
        />

        <BillingHistoryTable title="全月一覧" records={dashboard.records} />
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h1>インターネット代</h1>
          <p className="error-text">データ取得に失敗しました。</p>
          <p className="status-text">{message}</p>
          <BillingBackLink />
        </section>
      </section>
    );
  }
}
