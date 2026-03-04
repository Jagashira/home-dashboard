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
  try {
    const newsItems = await getLatestNews(100);

    return (
      <section className="stack-lg">
        <section className="panel hero">
          <p className="eyebrow">RSS + SQLITE</p>
          <h2>News Feed</h2>
          <p>Pull RSS feeds, keep everything local, and browse the latest items.</p>
          <RefreshNewsButton />
        </section>

        {newsItems.length === 0 ? (
          <section className="panel">
            <h3>No news yet</h3>
            <p>Click "Refresh News" to fetch your configured feeds.</p>
          </section>
        ) : null}

        <section className="news-list">
          {newsItems.map((item) => (
            <article className="panel news-card" key={item.id}>
              <p className="news-meta">{formatDate(item.publishedAt)}</p>
              <h3>{item.title}</h3>
              {item.summary ? <p>{item.summary}</p> : null}
              <a href={item.url} target="_blank" rel="noreferrer">
                Read article
              </a>
              <p className="news-source">Source: {item.feedUrl}</p>
            </article>
          ))}
        </section>
      </section>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load news.";
    const isDbConfigError = message.includes("DATABASE_URL");

    return (
      <section className="stack-lg">
        <section className="panel error-panel">
          <h2>News is not ready yet</h2>
          {isDbConfigError ? (
            <>
              <p>
                DATABASE_URL is not configured. Create `.env` from `.env.example` and restart the app.
              </p>
              <pre className="inline-code">cp .env.example .env</pre>
            </>
          ) : (
            <p>{message}</p>
          )}
        </section>
      </section>
    );
  }
}
