import Link from "next/link";
import {
  buildTopicFilterQueryParam,
  formatRelativeJapaneseTime,
  getNewsDashboardSettings,
  getNewsHeaderMeta,
  listNewsArticles
} from "@/lib/news-dashboard";
import { NewsRefreshAction } from "./refresh-action";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getTopicParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function NewsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const topic = getTopicParam(resolved.topic);
  const settings = await getNewsDashboardSettings();
  const headerMeta = await getNewsHeaderMeta();
  const items = await listNewsArticles(topic ?? undefined);
  const today = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date());

  return (
    <section className="stack-lg">
      <section className="panel">
        <h1 className="news-title">ニュース</h1>
        <p className="status-text">{today}</p>
        <p className="status-text">最終更新 {formatRelativeJapaneseTime(headerMeta.latestUpdatedAt)}</p>
        <p className="status-text">{headerMeta.latestFetched || settings.totalRequested}件取得</p>

        <div className="actions-row">
          <NewsRefreshAction />
          <Link className="button-secondary" href="/news/settings">
            設定
          </Link>
        </div>
      </section>

      <section className="chip-row">
        <Link className={!topic ? "chip chip-active" : "chip"} href={buildTopicFilterQueryParam(null)}>
          すべて
        </Link>
        {settings.topics.map((item) => (
          <Link
            key={item.id}
            className={topic === item.name ? "chip chip-active" : "chip"}
            href={buildTopicFilterQueryParam(item.name)}
          >
            {item.name}
          </Link>
        ))}
        <Link className="chip" href="/news/settings">
          +追加
        </Link>
      </section>

      <section className="news-list">
        {items.map((item) => (
          <article className="panel news-card" key={item.id}>
            <h3>{item.title}</h3>
            <p className="news-meta">
              {item.source ?? "Unknown"} ・ {formatRelativeJapaneseTime(item.publishedAt)} ・ {item.topic}
            </p>
            <pre className="summary-plain">{item.summary ?? "要約なし"}</pre>
            <div className="actions-row">
              <a href={item.url} target="_blank" rel="noreferrer">
                元記事
              </a>
              <a href={`/api/news/articles/${item.id}`} target="_blank" rel="noreferrer">
                詳細
              </a>
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <section className="panel">
            <p>記事がありません。ニュース収集を実行してください。</p>
          </section>
        ) : null}
      </section>
    </section>
  );
}

