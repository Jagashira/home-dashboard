"use client";

import { useState } from "react";

type SummaryButtonProps = {
  title: string;
  url: string;
  summary: string | null;
};

function normalizeSummaryText(value: string): string {
  return value
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "・")
    .trim();
}

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
  const [costJpy, setCostJpy] = useState<number | null>(null);
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
    setCostJpy(null);
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

      setResult(normalizeSummaryText(String(payload.summary ?? "")));
      setUsage(payload.usage ?? null);
      setCostJpy(typeof payload.estimatedCostJpy === "number" ? payload.estimatedCostJpy : null);
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
      {result ? <div className="summary-box">{result}</div> : null}
      {usage ? (
        <div className="summary-usage-wrap">
          <table className="summary-usage-table">
            <tbody>
              <tr>
                <th>Input</th>
                <td>{usage.input_tokens ?? 0}</td>
              </tr>
              <tr>
                <th>Output</th>
                <td>{usage.output_tokens ?? 0}</td>
              </tr>
              <tr>
                <th>Total</th>
                <td>{usage.total_tokens ?? 0}</td>
              </tr>
              {typeof usage.input_tokens_details?.cached_tokens === "number" ? (
                <tr>
                  <th>Cached</th>
                  <td>{usage.input_tokens_details.cached_tokens}</td>
                </tr>
              ) : null}
              {typeof costJpy === "number" ? (
                <tr>
                  <th>概算</th>
                  <td>¥{costJpy.toFixed(3)}</td>
                </tr>
              ) : null}
              {typeof usedFullArticle === "boolean" ? (
                <tr>
                  <th>Source</th>
                  <td>{usedFullArticle ? "full article" : "snippet fallback"}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
