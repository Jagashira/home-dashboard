import Link from "next/link";
import { BillingRecord } from "@/lib/home-billing-api";
import {
  BILLING_ROUTE,
  BillingCategorySummary,
  BillingLinePoint,
  formatDiff,
  formatKwh,
  formatYen
} from "@/lib/home-billing";

type PlotPoint = BillingLinePoint & {
  x: number;
  y: number;
};

function buildPath(points: PlotPoint[]) {
  return points
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
    })
    .join(" ");
}

function buildAreaPath(points: PlotPoint[], width: number, height: number, padding: number) {
  if (points.length === 0) return "";
  const topPath = buildPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${topPath} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;
}

function createPlotPoints(
  points: BillingLinePoint[],
  width: number,
  height: number,
  paddingX: number,
  paddingTop: number,
  paddingBottom: number
) {
  const max = Math.max(...points.map((point) => point.value), 0);
  const min = Math.min(...points.map((point) => point.value), 0);
  const range = max - min || 1;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  return {
    min,
    max,
    range,
    innerWidth,
    innerHeight,
    points: points.map((point, index) => ({
      ...point,
      x: paddingX + (innerWidth * index) / Math.max(points.length - 1, 1),
      y: paddingTop + innerHeight - ((point.value - min) / range) * innerHeight
    }))
  };
}

function pickTickIndexes(length: number, tickCount: number) {
  if (length <= 1) return [0];
  const indexes = new Set<number>([0, length - 1]);
  for (let step = 1; step < tickCount - 1; step += 1) {
    indexes.add(Math.round(((length - 1) * step) / (tickCount - 1)));
  }
  return [...indexes].sort((a, b) => a - b);
}

function buildYAxisTicks(min: number, max: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    return max - (max - min) * ratio;
  });
}

function MetricCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className="panel budget-metric billing-metric-card">
      <p className="label-caption">{label}</p>
      <h3>{value}</h3>
      {note ? <p className="status-text">{note}</p> : null}
    </article>
  );
}

export function BillingSummaryCard({ summary }: { summary: BillingCategorySummary }) {
  const cardBody = (
    <>
      <div className="stack-sm">
        <p className="label-caption">{summary.description}</p>
        <h3>{summary.title}</h3>
        <p className="billing-summary-amount">{formatYen(summary.latestRecord?.total_amount ?? null)}</p>
        <p className="status-text">{summary.latestRecord?.billing_month ?? "データなし"}</p>
      </div>
      <div className="stack-sm">
        <div>
          <p className="label-caption">前月比</p>
          <p className="billing-diff-text">{formatDiff(summary.diffAmount, summary.diffPercent)}</p>
        </div>
        {summary.previousRecord ? (
          <p className="meta-text">前月: {formatYen(summary.previousRecord.total_amount)}</p>
        ) : (
          <p className="meta-text">比較対象なし</p>
        )}
      </div>
    </>
  );

  if (!summary.href) {
    return <article className="panel billing-summary-card">{cardBody}</article>;
  }

  return (
    <Link className="panel billing-summary-card billing-summary-link" href={summary.href}>
      {cardBody}
    </Link>
  );
}

export function SimpleLineChart({
  title,
  subtitle,
  points,
  formatValue,
  emptyText = "表示データがありません"
}: {
  title: string;
  subtitle?: string;
  points: BillingLinePoint[];
  formatValue?: (value: number) => string;
  emptyText?: string;
}) {
  const width = 720;
  const height = 336;
  const paddingX = 52;
  const paddingTop = 20;
  const paddingBottom = 68;
  const formatter = formatValue ?? ((value: number) => value.toFixed(1));
  const stats = points.length
    ? {
        latest: points[points.length - 1],
        first: points[0],
        max: points.reduce((best, current) => (current.value > best.value ? current : best), points[0]),
        min: points.reduce((best, current) => (current.value < best.value ? current : best), points[0])
      }
    : null;
  const plot = points.length ? createPlotPoints(points, width, height, paddingX, paddingTop, paddingBottom) : null;
  const yTicks = plot ? buildYAxisTicks(plot.min, plot.max, 4) : [];
  const xTickIndexes = pickTickIndexes(points.length, points.length <= 6 ? points.length : 6);
  const linePath = plot && plot.points.length > 1 ? buildPath(plot.points) : "";
  const areaPath = plot ? buildAreaPath(plot.points, width, height, paddingBottom) : "";
  const gradientId = `billing-line-fill-${title.replace(/[^a-zA-Z0-9_-]/g, "-")}-${points.length}`;

  return (
    <section className="panel budget-chart-card billing-chart-card">
      <div className="billing-chart-head">
        <div className="stack-sm">
          <h3>{title}</h3>
          {subtitle ? <p className="status-text">{subtitle}</p> : null}
        </div>
        {stats ? (
          <div className="billing-chart-stats">
            <div className="billing-stat-pill">
              <span>最新</span>
              <strong>{formatter(stats.latest.value)}</strong>
            </div>
            <div className="billing-stat-pill">
              <span>最大</span>
              <strong>{formatter(stats.max.value)}</strong>
            </div>
            <div className="billing-stat-pill">
              <span>最小</span>
              <strong>{formatter(stats.min.value)}</strong>
            </div>
          </div>
        ) : null}
      </div>
      {points.length === 0 ? (
        <p className="status-text">{emptyText}</p>
      ) : (
        <div className="billing-chart-wrap">
          <div className="billing-chart-scroll">
            <svg viewBox={`0 0 ${width} ${height}`} className="billing-chart" role="img" aria-label={title}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              {plot
                ? yTicks.map((tick, index) => {
                    const y = paddingTop + plot.innerHeight - ((tick - plot.min) / plot.range) * plot.innerHeight;
                    return (
                      <g key={`${title}-ytick-${index}`}>
                        <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="billing-grid-line" />
                        <text x={paddingX - 10} y={y + 4} className="billing-y-label">
                          {formatter(tick)}
                        </text>
                      </g>
                    );
                  })
                : null}
              <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} className="billing-axis" />
              {areaPath ? <path d={areaPath} className="billing-area" fill={`url(#${gradientId})`} /> : null}
              {linePath ? <path d={linePath} className="billing-line" /> : null}
              {plot
                ? plot.points.map((point, index) => (
                    <g key={`${title}-${point.label}-${index}`}>
                      <circle cx={point.x} cy={point.y} r="4.5" className="billing-dot" />
                      <title>{`${point.label}: ${formatter(point.value)}`}</title>
                    </g>
                  ))
                : null}
              {plot
                ? xTickIndexes.map((pointIndex) => {
                    const point = plot.points[pointIndex];
                    return (
                      <g key={`${title}-xlabel-${pointIndex}`}>
                        <line
                          x1={point.x}
                          y1={height - paddingBottom}
                          x2={point.x}
                          y2={height - paddingBottom + 8}
                          className="billing-axis"
                        />
                        <text x={point.x} y={height - 24} textAnchor="middle" className="billing-x-label">
                          {point.label}
                        </text>
                      </g>
                    );
                  })
                : null}
            </svg>
          </div>
          {stats ? (
            <div className="billing-chart-foot">
              <p className="meta-text">
                開始: {stats.first.label} / {formatter(stats.first.value)}
              </p>
              <p className="meta-text">
                最新: {stats.latest.label} / {formatter(stats.latest.value)}
              </p>
              <p className="meta-text">点数: {points.length}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function BillingHistoryTable({
  title,
  records,
  showUsagePeriod = false
}: {
  title: string;
  records: BillingRecord[];
  showUsagePeriod?: boolean;
}) {
  return (
    <section className="panel billing-table-card">
      <h3>{title}</h3>
      {records.length === 0 ? (
        <p className="status-text">表示データがありません</p>
      ) : (
        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>月</th>
                <th>金額</th>
                {showUsagePeriod ? <th>利用期間</th> : null}
                <th>事業者</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.billing_month}</td>
                  <td>{formatYen(record.total_amount)}</td>
                  {showUsagePeriod ? <td>{record.usage_period ?? "-"}</td> : null}
                  <td>{record.provider_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ElectricityUsagePanel({
  totalUsageKwh,
  averageUsageKwh,
  maxUsageKwh,
  pointCount
}: {
  totalUsageKwh: number | null;
  averageUsageKwh: number | null;
  maxUsageKwh: number | null;
  pointCount: number | null;
}) {
  return (
    <section className="grid-2 budget-summary-grid">
      <MetricCard label="合計使用量" value={totalUsageKwh === null ? "-" : `${formatKwh(totalUsageKwh)} kWh`} />
      <MetricCard label="平均使用量" value={averageUsageKwh === null ? "-" : `${formatKwh(averageUsageKwh)} kWh`} />
      <MetricCard label="最大使用量" value={maxUsageKwh === null ? "-" : `${formatKwh(maxUsageKwh)} kWh`} />
      <MetricCard label="計測点数" value={pointCount === null ? "-" : `${pointCount} 件`} />
    </section>
  );
}

export function BillingBackLink() {
  return (
    <Link className="button-secondary" href={BILLING_ROUTE}>
      公共料金一覧へ戻る
    </Link>
  );
}
