"use client";

import { useState } from "react";

type SummaryButtonProps = {
  title: string;
  url: string;
  summary: string | null;
};

export function SummaryButton({ title, url, summary }: SummaryButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const summarize = async () => {
    setLoading(true);
    setError(null);

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
    </div>
  );
}
