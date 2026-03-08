"use client";

import { useEffect, useState } from "react";
import { NewsApiResponse, NewsPayload } from "@/lib/types/news";

function truncate(text: string | undefined, limit = 160) {
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

export default function DashboardNewsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<NewsPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/news?query=AI&max_results=5&days=2", { cache: "no-store" });
        const data = (await response.json()) as NewsApiResponse;

        if (!response.ok || "ok" in data) {
          setError("ok" in data ? data.error : "Failed to load news");
          return;
        }

        setPayload(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load news");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <section className="stack-lg">
      <section className="panel budget-hero">
        <div className="budget-grid-bg" aria-hidden="true" />
        <div className="budget-hero-body stack-sm">
          <p className="label-caption">MCP NEWS DASHBOARD</p>
          <h1 className="budget-title">News</h1>
        </div>
      </section>

      {loading ? <section className="panel"><p className="status-text">Loading...</p></section> : null}
      {error ? (
        <section className="panel error-panel">
          <p className="error-text">{error}</p>
        </section>
      ) : null}

      {payload ? (
        <>
          <section className="grid-3">
            <article className="panel budget-metric">
              <p className="label-caption">Total Results</p>
              <h3>{payload.attributes.total_results}</h3>
            </article>
            <article className="panel budget-metric">
              <p className="label-caption">Top Headline</p>
              {payload.attributes.top_url ? (
                <a href={payload.attributes.top_url} target="_blank" rel="noreferrer">
                  {payload.attributes.top_headline || payload.attributes.top_url}
                </a>
              ) : (
                <p className="status-text">-</p>
              )}
            </article>
            <article className="panel budget-metric">
              <p className="label-caption">Updated</p>
              <p className="status-text">{payload.attributes.updated_at}</p>
            </article>
          </section>

          <section className="dashboard-news-grid">
            {payload.attributes.articles.map((article, index) => (
              <article className="panel dashboard-news-card" key={`${article.url}-${index}`}>
                <h3>{article.title}</h3>
                <p className="status-text">
                  {article.published_date || "-"} / {article.source || "unknown"}
                  {typeof article.score === "number" ? ` / score ${article.score}` : ""}
                </p>
                <p>{truncate(article.content)}</p>
                {article.url ? (
                  <a href={article.url} target="_blank" rel="noreferrer">
                    Open article
                  </a>
                ) : null}
              </article>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}
