"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewsRefreshAction() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const runFetch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/fetch", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        console.error("[news-refresh] failed:", payload.error ?? "unknown error");
        return;
      }
      router.refresh();
    } catch (error) {
      console.error("[news-refresh] failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className={`button-secondary news-refresh-button${loading ? " disabled" : ""}`}
        onClick={runFetch}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "収集中..." : "ニュース取得"}
      </button>
    </div>
  );
}
