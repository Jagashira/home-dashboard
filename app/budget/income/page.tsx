import Link from "next/link";
import { BudgetEntryForm } from "../budget-entry-form";

export const dynamic = "force-dynamic";

export default function BudgetIncomePage() {
  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-sm">
          <p className="label-caption">INCOME INPUT</p>
          <h1 className="budget-title">収入入力</h1>
          <Link className="button-secondary" href="/budget">
            ダッシュボードへ戻る
          </Link>
        </div>
      </section>

      <BudgetEntryForm mode="income" />
    </section>
  );
}
