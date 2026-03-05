import Link from "next/link";
import { DailyRangeOption, getBudgetDashboard } from "@/lib/budget";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type ChartRow = {
  label: string;
  value: number;
};

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function toMonth(ymd: string) {
  return ymd.slice(0, 7);
}

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

function toNumber(value: number | bigint | string | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(date);
}

function toQuery(base: {
  month: string;
  date: string;
  range: DailyRangeOption;
  expenseView: "month" | "day";
}) {
  const params = new URLSearchParams();
  params.set("month", base.month);
  params.set("date", base.date);
  params.set("range", base.range);
  params.set("expenseView", base.expenseView);
  return `/budget?${params.toString()}`;
}

function BarChart({ title, rows, emptyText }: { title: string; rows: ChartRow[]; emptyText: string }) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.value), 0);

  return (
    <section className="panel budget-chart-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="status-text">{emptyText}</p>
      ) : (
        <div className="budget-bars">
          {rows.map((row) => {
            const width = max <= 0 ? 0 : Math.max(3, Math.round((row.value / max) * 100));

            // Keep the bar visually comparable regardless of absolute amount.
            return (
              <div className="budget-bar-row" key={`${title}-${row.label}`}>
                <div className="budget-bar-meta">
                  <span>{row.label}</span>
                  <strong>{formatYen(row.value)}</strong>
                </div>
                <div className="budget-bar-track">
                  <div className="budget-bar-fill" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EntryList({
  title,
  items
}: {
  title: string;
  items: Array<{
    id: string;
    date: string;
    amount: number;
    category: string;
    paymentMethod: string;
    storeName: string;
    memo: string | null;
  }>;
}) {
  return (
    <section className="panel budget-list-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="status-text">データがありません</p>
      ) : (
        <div className="budget-list">
          {items.map((item) => (
            <article className="budget-list-item" key={item.id}>
              <div>
                <p className="budget-list-date">{formatDate(item.date)}</p>
                <p className="budget-list-name">{item.storeName}</p>
                <p className="budget-list-meta">
                  {item.category} / {item.paymentMethod}
                </p>
                {item.memo ? <p className="budget-list-memo">{item.memo}</p> : null}
              </div>
              <strong>{formatYen(item.amount)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function BudgetPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const today = todayYmd();

  const date = getString(resolved.date) || today;
  const month = getString(resolved.month) || toMonth(date);
  const rangeRaw = getString(resolved.range);
  const range: DailyRangeOption = rangeRaw === "7d" || rangeRaw === "30d" ? rangeRaw : "today";
  const expenseViewRaw = getString(resolved.expenseView);
  const expenseView: "month" | "day" = expenseViewRaw === "day" ? "day" : "month";

  const dashboard = await getBudgetDashboard({ month, date, dailyRange: range });

  const commonQuery = {
    month: dashboard.selectedMonth,
    date: dashboard.selectedDate,
    range: dashboard.dailyRange,
    expenseView
  };

  const incomeRows = dashboard.monthlyIncomeByAccount.map((row) => ({ label: row.account, value: row.total }));
  const monthlyExpenseRows = dashboard.monthlyExpenseByDay.map((row) => ({
    label: row.day.slice(8, 10),
    value: toNumber(row.total)
  }));
  const rangeRows = dashboard.dailyRangeGraph.map((row) => ({
    label: row.day.slice(5),
    value: toNumber(row.total)
  }));
  const trendRows = dashboard.monthTrendRows.map((row) => ({
    label: row.monthKey,
    value: Math.max(0, toNumber(row.income) - toNumber(row.expense))
  }));

  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body">
          <p className="label-caption">HOUSEHOLD FINANCE</p>
          <h1 className="budget-title">Budget Dashboard</h1>
          <div className="budget-controls-row">
            <label className="field budget-compact-field">
              <span>月</span>
              <input
                type="month"
                name="month"
                defaultValue={dashboard.selectedMonth}
                form="budget-filter-form"
              />
            </label>
            <label className="field budget-compact-field">
              <span>対象日</span>
              <input
                type="date"
                name="date"
                defaultValue={dashboard.selectedDate}
                form="budget-filter-form"
              />
            </label>
            <form id="budget-filter-form" action="/budget" className="budget-inline-form">
              <input type="hidden" name="expenseView" value={expenseView} />
              <input type="hidden" name="range" value={dashboard.dailyRange} />
              <button className="button-secondary" type="submit">
                更新
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid-3 budget-metrics-grid">
        <article className="panel budget-metric">
          <p className="label-caption">月間収入</p>
          <h3>{formatYen(toNumber(dashboard.monthlyTotals.income))}</h3>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">月間支出</p>
          <h3>{formatYen(toNumber(dashboard.monthlyTotals.expense))}</h3>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">月間収支</p>
          <h3>{formatYen(toNumber(dashboard.monthlyBalance))}</h3>
        </article>
      </section>

      <section className="budget-dashboard-grid">
        <BarChart
          title="口座別入金 (三井住友 / ゆうちょ)"
          rows={incomeRows.map((row) => ({ ...row, value: toNumber(row.value) }))}
          emptyText="当月の収入はまだありません"
        />
        <BarChart title="月次収支トレンド" rows={trendRows} emptyText="トレンドデータがありません" />
      </section>

      <section className="grid-2">
        <article className="panel">
          <h3>支出を入力</h3>
          <p className="status-text">日付・カテゴリ・支払い方法・店名を入力します。</p>
          <Link className="button-primary" href="/budget/expenses">
            支出入力へ
          </Link>
        </article>
        <article className="panel">
          <h3>収入を入力</h3>
          <p className="status-text">三井住友/ゆうちょなどの入金を登録します。</p>
          <Link className="button-primary" href="/budget/income">
            収入入力へ
          </Link>
        </article>
      </section>

      <section className="panel budget-switch-row">
        <div className="chip-row">
          <Link
            className={`chip ${expenseView === "month" ? "chip-active" : ""}`}
            href={toQuery({ ...commonQuery, expenseView: "month" })}
          >
            支出: 月別
          </Link>
          <Link
            className={`chip ${expenseView === "day" ? "chip-active" : ""}`}
            href={toQuery({ ...commonQuery, expenseView: "day" })}
          >
            支出: 日別
          </Link>
        </div>

        {expenseView === "day" ? (
          <div className="chip-row">
            <Link
              className={`chip ${dashboard.dailyRange === "today" ? "chip-active" : ""}`}
              href={toQuery({ ...commonQuery, range: "today" })}
            >
              当日
            </Link>
            <Link
              className={`chip ${dashboard.dailyRange === "7d" ? "chip-active" : ""}`}
              href={toQuery({ ...commonQuery, range: "7d" })}
            >
              7日
            </Link>
            <Link
              className={`chip ${dashboard.dailyRange === "30d" ? "chip-active" : ""}`}
              href={toQuery({ ...commonQuery, range: "30d" })}
            >
              30日
            </Link>
          </div>
        ) : null}
      </section>

      {expenseView === "month" ? (
        <section className="budget-dashboard-grid">
          <BarChart title="日別支出 (月間)" rows={monthlyExpenseRows} emptyText="当月の支出はまだありません" />
          <EntryList title="月別支出リスト" items={dashboard.monthlyItems} />
        </section>
      ) : (
        <section className="budget-dashboard-grid">
          <BarChart title={`日別支出 (${dashboard.dailyRange})`} rows={rangeRows} emptyText="期間内の支出はまだありません" />
          <EntryList title={`日別支出リスト (${formatDate(dashboard.selectedDate)})`} items={dashboard.dailyItems} />
        </section>
      )}

    </section>
  );
}
