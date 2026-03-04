"use client";

import { useState } from "react";

type SummaryButtonProps = {
  title: string;
  url: string;
  summary: string | null;
};

type SummaryUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
};

export function SummaryButton({ title, url, summary }: SummaryButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [usage, setUsage] = useState<SummaryUsage | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [usedFullArticle, setUsedFullArticle] = useState<boolean | null>(null);

  const summarize = async () => {
    if (result) {
      const shouldResummarize = window.confirm(
        "要約済みです。もう一度要約しますか？"
      );
      if (!shouldResummarize) {
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setUsage(null);
    setCostUsd(null);
    setUsedFullArticle(null);

    try {
      const response = await fetch("/api/news/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, summary })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Summarization failed");
        setLoading(false);
        return;
      }

      setResult(payload.summary);
      setUsage(payload.usage ?? null);
      setCostUsd(typeof payload.estimatedCostUsd === "number" ? payload.estimatedCostUsd : null);
      setUsedFullArticle(typeof payload.usedFullArticle === "boolean" ? payload.usedFullArticle : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Summarization failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack-sm">
      <button className="button-secondary" type="button" onClick={summarize} disabled={loading}>
        {loading ? "要約中..." : "AIで要約"}
      </button>

      {error ? <p className="error-text">{error}</p> : null}
      {result ? <pre className="summary-box">{result}</pre> : null}
      {usage ? (
        <p className="meta-text">
          tokens in/out/total: {usage.input_tokens ?? 0}/{usage.output_tokens ?? 0}/
          {usage.total_tokens ?? 0}
          {typeof costUsd === "number" ? ` | est. $${costUsd.toFixed(6)}` : ""}
          {typeof usedFullArticle === "boolean"
            ? usedFullArticle
              ? " | full article"
              : " | snippet fallback"
            : ""}
        </p>
      ) : null}
    </div>
  );
}
