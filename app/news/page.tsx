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
  ensureNewsBootstrap();
  const resolved = searchParams ? await searchParams : {};
  const topic = getString(resolved.topic);

  const topics = listTopics();
  const latestRun = getLatestFetchRun();
  const items = listArticles({ topic: topic || undefined, limit: 200 });

  const sourceCounts = latestRun ? (countBySourceForLatestRun(latestRun.id) as Array<{ source_type: string; count: number }>) : [];

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      <NewsHeader
        latestUpdatedAt={latestRun?.finished_at ?? null}
        totalFetched={latestRun?.total_fetched ?? 0}
        sourceCounts={sourceCounts}
      />
      <div className="flex justify-end">
        <NewsRefreshAction />
      </div>
      <div className="flex justify-end gap-2">
        <a href="/favorites" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          お気に入り
        </a>
        <a href="/news/hidden" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          非表示一覧
        </a>
      </div>
      <TopicTabs topics={topics.map((t) => t.name)} activeTopic={topic} />

      <section className="space-y-3">
        {items.map((article: ArticleListRow) => (
          <ArticleCard key={article.id} article={article} />
        ))}
        {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm">記事がありません。取得を実行してください。</p> : null}
      </section>
    </main>
  );
}
