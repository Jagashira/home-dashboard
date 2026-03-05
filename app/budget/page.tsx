import Link from "next/link";
import { ExpenseScopeOption, getExpenseDashboard } from "@/lib/budget";
import { ExpenseListManager } from "./expense-list-manager";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type ChartType = "category" | "store" | "daily";

type ChartRow = {
  label: string;
  value: number;
};

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

function queryHref(base: {
  month: string;
  scope: ExpenseScopeOption;
  from: string;
  to: string;
  chart: ChartType;
}) {
  const params = new URLSearchParams();
  params.set("month", base.month);
  params.set("scope", base.scope);
  params.set("from", base.from);
  params.set("to", base.to);
  params.set("chart", base.chart);
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

export default async function BudgetPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};

  const now = todayYmd();
  const month = getString(resolved.month) || now.slice(0, 7);
  const scopeRaw = getString(resolved.scope);
  const scope: ExpenseScopeOption =
    scopeRaw === "today" || scopeRaw === "week" || scopeRaw === "custom" ? scopeRaw : "month";

  const chartRaw = getString(resolved.chart);
  const chart: ChartType = chartRaw === "store" || chartRaw === "daily" ? chartRaw : "category";

  const dashboard = await getExpenseDashboard({
    month,
    scope,
    from: getString(resolved.from),
    to: getString(resolved.to)
  });

  const queryBase = {
    month: dashboard.selectedMonth,
    scope: dashboard.scope,
    from: dashboard.range.from,
    to: dashboard.range.to,
    chart
  };

  const activeRows: ChartRow[] =
    chart === "daily"
      ? dashboard.month.byDay.map((row) => ({ label: row.day.slice(5), value: row.total }))
      : chart === "store"
        ? dashboard.range.byStore.map((row) => ({ label: row.label, value: row.total }))
        : dashboard.range.byCategory.map((row) => ({ label: row.label, value: row.total }));

  const graphTitle =
    chart === "daily"
      ? `日別支出 (${dashboard.selectedMonth})`
      : chart === "store"
        ? "店別支出"
        : "カテゴリ別支出";

  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-md">
          <p className="label-caption">HOUSEHOLD SPENDING</p>
          <h1 className="budget-title">Budget Dashboard</h1>
          <div className="actions-row">
            <Link className="button-primary" href="/budget/expenses">
              支出入力
            </Link>
            <Link className="button-secondary" href="/budget/income">
              収入入力
            </Link>
          </div>
        </div>
      </section>

      <section className="grid-2">
        <article className="panel budget-metric">
          <p className="label-caption">今月の支出合計</p>
          <h3>{formatYen(dashboard.month.total)}</h3>
          <p className="status-text">
            {dashboard.month.from} - {dashboard.month.to}
          </p>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">選択期間の支出合計</p>
          <h3>{formatYen(dashboard.range.total)}</h3>
          <p className="status-text">
            {dashboard.range.from} - {dashboard.range.to}
          </p>
        </article>
      </section>

      <section className="panel budget-switch-row">
        <div className="chip-row">
          <Link className={`chip ${scope === "month" ? "chip-active" : ""}`} href={queryHref({ ...queryBase, scope: "month" })}>
            今月
          </Link>
          <Link className={`chip ${scope === "today" ? "chip-active" : ""}`} href={queryHref({ ...queryBase, scope: "today" })}>
            今日
          </Link>
          <Link className={`chip ${scope === "week" ? "chip-active" : ""}`} href={queryHref({ ...queryBase, scope: "week" })}>
            1週間
          </Link>
          <Link className={`chip ${scope === "custom" ? "chip-active" : ""}`} href={queryHref({ ...queryBase, scope: "custom" })}>
            期間指定
          </Link>
        </div>

        <div className="chip-row">
          <Link
            className={`chip ${chart === "category" ? "chip-active" : ""}`}
            href={queryHref({ ...queryBase, chart: "category" })}
          >
            カテゴリ
          </Link>
          <Link
            className={`chip ${chart === "store" ? "chip-active" : ""}`}
            href={queryHref({ ...queryBase, chart: "store" })}
          >
            店別
          </Link>
          <Link
            className={`chip ${chart === "daily" ? "chip-active" : ""}`}
            href={queryHref({ ...queryBase, chart: "daily" })}
          >
            日別 (月)
          </Link>
        </div>

        <form action="/budget" className="budget-controls-row">
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="chart" value={chart} />
          <label className="field budget-compact-field">
            <span>対象月 (日別グラフ用)</span>
            <input type="month" name="month" defaultValue={dashboard.selectedMonth} />
          </label>
          <label className="field budget-compact-field">
            <span>From</span>
            <input type="date" name="from" defaultValue={dashboard.range.from} />
          </label>
          <label className="field budget-compact-field">
            <span>To</span>
            <input type="date" name="to" defaultValue={dashboard.range.to} />
          </label>
          <button className="button-secondary" type="submit">
            反映
          </button>
        </form>
      </section>

      <section className="budget-dashboard-grid">
        <BarChart title={graphTitle} rows={activeRows} emptyText="表示データがありません" />
        <ExpenseListManager items={dashboard.range.items} />
      </section>
    </section>
  );
}
