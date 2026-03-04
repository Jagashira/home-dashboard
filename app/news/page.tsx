import { getLatestNews } from "@/lib/news";
import { RefreshNewsButton } from "./refresh-button";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) {
    return "Unknown publish time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function NewsPage() {
  const newsItems = await getLatestNews(100);

  return (
    <section>
      <h1>News</h1>
      <p>Pulls RSS feeds and stores results in local SQLite.</p>

      <RefreshNewsButton />

      {newsItems.length === 0 ? <p>No news yet. Click "Refresh News" to fetch feeds.</p> : null}

      {newsItems.map((item) => (
        <article className="card" key={item.id}>
          <h2>{item.title}</h2>
          <p>
            <small>{formatDate(item.publishedAt)}</small>
          </p>
          {item.summary ? <p>{item.summary}</p> : null}
          <p>
            <a href={item.url} target="_blank" rel="noreferrer">
              Read original article
            </a>
          </p>
          <p>
            <small>Source feed: {item.feedUrl}</small>
          </p>
        </article>
      ))}
    </section>
  );
}
