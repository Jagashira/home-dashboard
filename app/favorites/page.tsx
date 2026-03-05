import Link from "next/link";
import { getFavoriteNews } from "@/lib/news";
import { SummaryButton } from "@/app/news/summary-button";
import { SourceBadge } from "@/app/news/source-badge";
import { FavoriteButton } from "@/app/news/favorite-button";

function formatDate(value: Date | null): string {
  if (!value) {
    return "Unknown publish time";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function FavoritesPage() {
  const favorites = await getFavoriteNews(1, 200);

  return (
    <section className="stack-lg">
      <section className="news-title-wrap">
        <h1 className="news-title">Favorites</h1>
      </section>

      <section className="panel search-head-card">
        <div className="actions-row">
          <Link className="button-secondary" href="/news">
            Newsへ戻る
          </Link>
        </div>
        <p className="status-text search-result-meta">{favorites.total} items</p>
      </section>

      {favorites.items.length === 0 ? (
        <section className="panel">
          <h3>No favorites yet</h3>
          <p>ニュース一覧でハートを押すとここに追加されます。</p>
        </section>
      ) : null}

      <section className="news-list">
        {favorites.items.map((item) => (
          <article className="panel news-card" key={item.id}>
            <p className="news-meta">{formatDate(item.publishedAt)}</p>
            <div className="news-card-head">
              <h3>{item.title}</h3>
              <FavoriteButton newsItemId={item.id} initialIsFavorite={item.isFavorite} />
            </div>
            {item.summary ? <p>{item.summary}</p> : null}
            <a href={item.url} target="_blank" rel="noreferrer">
              Read article
            </a>
            <SummaryButton title={item.title} summary={item.summary} url={item.url} />
            <SourceBadge articleUrl={item.url} feedUrl={item.feedUrl} />
          </article>
        ))}
      </section>
    </section>
  );
}
