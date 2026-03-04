"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshNewsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
    setStatus("Refreshing feeds...");

    try {
      const response = await fetch("/api/news/refresh", { method: "POST" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setStatus(`Refresh failed: ${payload.error ?? "unknown error"}`);
        return;
      }

      setStatus(
        `Fetched ${payload.totalFetched}, keyword-match ${payload.matchedByKeyword}, inserted ${payload.inserted}.`
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed.");
    }
  };

  return (
    <div className="stack-sm refresh-control">
      <button className="button-primary refresh-button" type="button" onClick={refresh} disabled={isPending}>
        {isPending ? "Refreshing..." : "Refresh News"}
      </button>
      <p className={status ? "status-text refresh-status" : "status-text refresh-status is-empty"}>
        {status ?? "status placeholder"}
      </p>
    </div>
  );
}
