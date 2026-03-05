import Link from "next/link";
import { BudgetEntryForm } from "../budget-entry-form";

export const dynamic = "force-dynamic";

export default function BudgetExpensesPage() {
  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-sm">
          <p className="label-caption">BUDGET INPUT</p>
          <h1 className="budget-title">支出入力</h1>
          <Link className="button-secondary" href="/budget">
            ダッシュボードへ戻る
          </Link>
        </div>
      </section>

      <BudgetEntryForm initialEntryType="EXPENSE" lockEntryType />
    </section>
  );
}
