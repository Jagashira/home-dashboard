import { ArticleCard } from "@/components/news/article-card";
import { NewsHeader } from "@/components/news/news-header";
import { TopicTabs } from "@/components/news/topic-tabs";
import { ensureNewsBootstrap } from "@/lib/news-bootstrap";
import {
  listArticles,
  countBySourceForLatestRun,
  type ArticleListRow
} from "@/lib/repositories/articles";
import { getLatestFetchRun } from "@/lib/repositories/fetch-runs";
import { listTopics } from "@/lib/repositories/topics";
import { NewsRefreshAction } from "./refresh-action";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function NewsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  try {
    ensureNewsBootstrap();
    const resolved = searchParams ? await searchParams : {};
    const topic = getString(resolved.topic);

    const topics = listTopics().filter((row) => row.isActive);
    const latestRun = getLatestFetchRun();
    const items = listArticles({ topic: topic || undefined, limit: 200 });

    const sourceCounts = latestRun
      ? (countBySourceForLatestRun(latestRun.id) as Array<{ source_type: string; count: number }>)
      : [];

    return (
      <section className="stack-lg">
        <section className="panel budget-hero news-hero">
          <div className="budget-grid-bg" aria-hidden="true" />
          <div className="budget-hero-body stack-md">
            <div className="stack-sm">
              <p className="label-caption">NEWS FEED</p>
              <h1 className="budget-title">News Dashboard</h1>
            </div>
            <NewsHeader
              latestUpdatedAt={latestRun?.finished_at ?? null}
              totalFetched={latestRun?.total_fetched ?? 0}
              sourceCounts={sourceCounts}
            />
            <div className="actions-row">
              <NewsRefreshAction />
              <a href="/favorites" className="button-secondary">
                お気に入り
              </a>
              <a href="/news/hidden" className="button-secondary">
                非表示一覧
              </a>
            </div>
          </div>
        </section>

        <section className="panel news-filter-panel">
          <TopicTabs topics={topics.map((t) => t.name)} activeTopic={topic} />
        </section>

        <section className="news-list">
          {items.map((article: ArticleListRow) => (
            <ArticleCard key={article.id} article={article} />
          ))}
          {items.length === 0 ? (
            <p className="panel status-text">
              記事がありません。取得を実行してください。
            </p>
          ) : null}
        </section>
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h1>News</h1>
          <p className="error-text">ニュースデータの読み込みに失敗しました。</p>
          <p className="status-text">{message}</p>
        </section>
      </section>
    );
  }
}
