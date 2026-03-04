"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshNewsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
    setStatus("Refreshing feeds...");

    const response = await fetch("/api/news/refresh", { method: "POST" });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setStatus(`Refresh failed: ${payload.error ?? "unknown error"}`);
      return;
    }

    setStatus(`Fetched ${payload.totalFetched}, inserted ${payload.inserted}.`);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div>
      <button type="button" onClick={refresh} disabled={isPending}>
        {isPending ? "Refreshing..." : "Refresh News"}
      </button>
      {status ? <p>{status}</p> : null}
    </div>
  );
}
