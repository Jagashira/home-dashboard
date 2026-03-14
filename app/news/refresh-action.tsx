"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function NewsRefreshAction() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const runFetch = async () => {
    setLoading(true);
    setStatus("収集中...");
    try {
      const response = await fetch("/api/fetch", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        setStatus(`失敗: ${payload.error ?? "unknown error"}`);
        return;
      }
      setStatus(`取得 ${payload.totalFetched} / 新規 ${payload.inserted}`);
      router.refresh();
    } catch (error) {
      setStatus(`失敗: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack-sm">
      <Button type="button" onClick={runFetch} disabled={loading}>
        {loading ? "収集中..." : "ニュース取得"}
      </Button>
      {status ? <p className="meta-text">{status}</p> : null}
    </div>
  );
}
