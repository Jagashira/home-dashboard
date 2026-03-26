import Link from "next/link";
import { getBillingReportData } from "@/lib/home-billing-report";
import { BillingReportPrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ReportSection = {
  heading: string;
  items: string[];
  paragraphs: string[];
};

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildReportHref(mode: "month" | "year", period: string) {
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("period", period);
  return `/billing/report?${params.toString()}`;
}

function buildDownloadHref(mode: "month" | "year", period: string, format: "md" | "txt") {
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("period", period);
  params.set("format", format);
  return `/api/billing/report?${params.toString()}`;
}

function parseReportDocument(markdown: string) {
  const lines = markdown.split("\n");
  let title = "Billing Report";
  const overview: string[] = [];
  const sections: ReportSection[] = [];
  let currentSection: ReportSection | null = null;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2);
      continue;
    }

    if (line.startsWith("## ")) {
      currentSection = {
        heading: line.slice(3),
        items: [],
        paragraphs: []
      };
      sections.push(currentSection);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("- ")) {
      if (currentSection) {
        currentSection.items.push(trimmed.slice(2));
      } else {
        overview.push(trimmed.slice(2));
      }
      continue;
    }

    if (currentSection) {
      currentSection.paragraphs.push(trimmed);
    }
  }

  return { title, overview, sections };
}

export default async function BillingReportPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const report = await getBillingReportData({
    mode: getString(resolved.mode),
    period: getString(resolved.period)
  });
  const document = parseReportDocument(report.markdown);
  const summaryItems = document.overview.slice(0, 4);
  const periodLabel =
    report.mode === "month"
      ? report.months.find((item) => item.key === report.period)?.label ?? report.period
      : report.period;

  return (
    <section className="stack-lg">
      <section className="panel billing-report-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-md">
          <p className="label-caption">BILLING REPORT</p>
          <h1 className="budget-title">{report.title}</h1>
          <p className="status-text">
            月別または年別で公共料金と手動台帳をまとめたレポートです。まず画面で確認して、そのまま PDF 保存できます。
          </p>
          <div className="actions-row">
            <Link className="button-secondary" href="/billing">
              公共料金一覧へ戻る
            </Link>
            <BillingReportPrintButton />
            <a className="button-secondary" href={buildDownloadHref(report.mode, report.period, "md")}>
              Markdownを出力
            </a>
            <a className="button-secondary" href={buildDownloadHref(report.mode, report.period, "txt")}>
              テキストを出力
            </a>
          </div>
        </div>
      </section>

      <section className="panel billing-report-card">
        <div className="billing-report-filters">
          <div className="billing-report-filter-group">
            <p className="label-caption">レポート種別</p>
            <div className="chip-row budget-chip-group">
              <Link className={`chip ${report.mode === "month" ? "chip-active" : ""}`} href={buildReportHref("month", report.months[0]?.key ?? report.period)}>
                月別
              </Link>
              <Link className={`chip ${report.mode === "year" ? "chip-active" : ""}`} href={buildReportHref("year", report.years[0]?.key ?? report.period)}>
                年別
              </Link>
            </div>
          </div>

          <div className="billing-report-filter-group">
            <p className="label-caption">{report.mode === "month" ? "対象月" : "対象年"}</p>
            <div className="chip-row budget-chip-group">
              {(report.mode === "month" ? report.months : report.years).map((item) => (
                <Link
                  className={`chip ${report.period === item.key ? "chip-active" : ""}`}
                  href={buildReportHref(report.mode, item.key)}
                  key={`${report.mode}-${item.key}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel billing-report-card">
        <div className="billing-report-meta">
          <div>
            <p className="label-caption">生成日時</p>
            <strong>{report.generatedAtLabel}</strong>
          </div>
          <div>
            <p className="label-caption">対象</p>
            <strong>{periodLabel}</strong>
          </div>
          <div>
            <p className="label-caption">形式</p>
            <strong>PDF Preview</strong>
          </div>
        </div>
        <div className="billing-report-preview-shell">
          <article className="billing-report-paper">
            <header className="billing-report-cover">
              <div>
                <p className="billing-report-kicker">Household Billing Intelligence</p>
                <h1 className="billing-report-doc-title">{document.title}</h1>
                <p className="billing-report-cover-text">
                  固定費と取得済み公共料金を対象期間ごとに整理した、保存前提のレポートプレビューです。
                </p>
              </div>
              <dl className="billing-report-cover-meta">
                <div>
                  <dt>Mode</dt>
                  <dd>{report.mode === "month" ? "Monthly" : "Yearly"}</dd>
                </div>
                <div>
                  <dt>Period</dt>
                  <dd>{periodLabel}</dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{report.generatedAtLabel}</dd>
                </div>
              </dl>
            </header>

            <section className="billing-report-summary-grid">
              {summaryItems.map((item) => (
                <article className="billing-report-summary-card" key={item}>
                  <p>{item}</p>
                </article>
              ))}
            </section>

            <section className="billing-report-body">
              {document.sections.map((section) => (
                <article className="billing-report-section" key={section.heading}>
                  <h2 className="billing-report-doc-heading">{section.heading}</h2>
                  {section.paragraphs.length > 0 ? (
                    <div className="billing-report-section-copy">
                      {section.paragraphs.map((paragraph) => (
                        <p className="billing-report-paragraph" key={paragraph}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {section.items.length > 0 ? (
                    <ul className="billing-report-list">
                      {section.items.map((item, index) => (
                        <li key={`${section.heading}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>
          </article>
        </div>
      </section>
    </section>
  );
}
