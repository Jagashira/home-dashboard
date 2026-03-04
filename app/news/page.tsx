import Link from "next/link";
import { searchNews } from "@/lib/news";
import { RefreshNewsButton } from "./refresh-button";
import { NewsControlsModal } from "./news-controls-modal";
import { SummaryButton } from "./summary-button";
import { SourceBadge } from "./source-badge";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function formatDate(value: Date | null): string {
  if (!value) {
    return "Unknown publish time";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function getString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseDateStart(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function buildPageHref(
  base: {
    q: string;
    from: string;
    to: string;
    pageSize: number;
    scanLimit: number;
  },
  page: number
) {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.from) params.set("from", base.from);
  if (base.to) params.set("to", base.to);
  params.set("pageSize", String(base.pageSize));
  params.set("scanLimit", String(base.scanLimit));
  params.set("page", String(page));
  return `/news?${params.toString()}`;
}

export default async function NewsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  try {
    const resolved = searchParams ? await searchParams : {};

    const q = getString(resolved.q);
    const from = getString(resolved.from);
    const to = getString(resolved.to);
    const page = parsePositiveInt(getString(resolved.page), 1);
    const pageSize = parsePositiveInt(getString(resolved.pageSize), 20);
    const scanLimit = parsePositiveInt(getString(resolved.scanLimit), 500);

    const result = await searchNews({
      query: q,
      from: parseDateStart(from),
      to: parseDateEnd(to),
      page,
      pageSize,
      scanLimit
    });

    const pagingBase = {
      q,
      from,
      to,
      pageSize: result.pageSize,
      scanLimit: result.scanLimit
    };

    return (
      <section className="stack-lg">
        <section className="news-title-wrap">
          <h1 className="news-title">News</h1>
        </section>

        <section className="panel search-head-card">
          <div className="head-actions">
            <RefreshNewsButton />
            <NewsControlsModal
              initialQuery={result.appliedQuery}
              initialFrom={from}
              initialTo={to}
              initialPageSize={result.pageSize}
              initialScanLimit={result.scanLimit}
              initialKeywords={result.preferences.keywords}
              initialFeedUrls={result.preferences.feedUrls}
              initialMaxItemsPerFeed={result.preferences.maxItemsPerFeed}
              initialDefaultPageSize={result.preferences.defaultPageSize}
              initialPreferJapanese={result.preferences.preferJapanese}
            />
          </div>
          <p className="status-text search-result-meta">
            {result.total} items / {result.page} / {result.totalPages}
          </p>
        </section>

        {result.items.length === 0 ? (
          <section className="panel">
            <h3>No results</h3>
            <p>条件に一致する記事がありません。キーワードや日時範囲を調整してください。</p>
          </section>
        ) : null}

        <section className="news-list">
          {result.items.map((item) => (
            <article className="panel news-card" key={item.id}>
              <p className="news-meta">{formatDate(item.publishedAt)}</p>
              <h3>{item.title}</h3>
              {item.summary ? <p>{item.summary}</p> : null}
              <a href={item.url} target="_blank" rel="noreferrer">
                Read article
              </a>
              <SummaryButton title={item.title} summary={item.summary} url={item.url} />
              <SourceBadge articleUrl={item.url} feedUrl={item.feedUrl} />
            </article>
          ))}
        </section>

        <section className="pagination-row">
          <Link
            className={result.page <= 1 ? "button-secondary disabled" : "button-secondary"}
            href={buildPageHref(pagingBase, Math.max(1, result.page - 1))}
            aria-disabled={result.page <= 1}
          >
            Previous
          </Link>
          <span>
            Page {result.page} / {result.totalPages}
          </span>
          <Link
            className={
              result.page >= result.totalPages ? "button-secondary disabled" : "button-secondary"
            }
            href={buildPageHref(pagingBase, Math.min(result.totalPages, result.page + 1))}
            aria-disabled={result.page >= result.totalPages}
          >
            Next
          </Link>
        </section>
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load news.";

    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h2>News is not ready yet</h2>
          <p>{message}</p>
          <pre className="inline-code">cp .env.example .env</pre>
        </section>
      </section>
    );
  }
}
