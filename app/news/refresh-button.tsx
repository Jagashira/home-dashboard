"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshNewsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
    window.dispatchEvent(
      new CustomEvent("news-refresh-status", { detail: "Refreshing feeds..." })
    );

    try {
      const response = await fetch("/api/news/refresh", { method: "POST" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        window.dispatchEvent(
          new CustomEvent("news-refresh-status", {
            detail: `Refresh failed: ${payload.error ?? "unknown error"}`
          })
        );
        return;
      }

      window.dispatchEvent(
        new CustomEvent("news-refresh-status", {
          detail:
            `Fetched ${payload.totalFetched}, keyword-match ${payload.matchedByKeyword}, inserted ${payload.inserted}` +
            (typeof payload.excludedByPaywall === "number"
              ? `, paywall-excluded ${payload.excludedByPaywall}`
              : "")
        })
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("news-refresh-status", {
          detail: error instanceof Error ? error.message : "Refresh failed."
        })
      );
    }
  };

  return (
    <div className="refresh-control">
      <button className="button-primary refresh-button" type="button" onClick={refresh} disabled={isPending}>
        {isPending ? "Refreshing..." : "Refresh News"}
      </button>
    </div>
  );
}
