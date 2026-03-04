"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SettingsFormProps = {
  initialKeywords: string[];
  initialFeedUrls: string[];
  initialMaxItemsPerFeed: number;
  initialDefaultPageSize: number;
  initialPreferJapanese: boolean;
};

export function NewsSettingsForm({
  initialKeywords,
  initialFeedUrls,
  initialMaxItemsPerFeed,
  initialDefaultPageSize,
  initialPreferJapanese
}: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const [keywords, setKeywords] = useState(initialKeywords.join(", "));
  const [feedUrls, setFeedUrls] = useState(initialFeedUrls.join("\n"));
  const [maxItemsPerFeed, setMaxItemsPerFeed] = useState(initialMaxItemsPerFeed);
  const [defaultPageSize, setDefaultPageSize] = useState(initialDefaultPageSize);
  const [preferJapanese, setPreferJapanese] = useState(initialPreferJapanese);

  const submit = async (refreshAfterSave: boolean) => {
    setStatus("Saving settings...");

    const saveResponse = await fetch("/api/news/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        feedUrls,
        maxItemsPerFeed,
        defaultPageSize,
        preferJapanese
      })
    });

    const savePayload = await saveResponse.json();

    if (!saveResponse.ok || !savePayload.ok) {
      setStatus(`Save failed: ${savePayload.error ?? "unknown error"}`);
      return;
    }

    if (refreshAfterSave) {
      setStatus("Refreshing with new settings...");
      const refreshResponse = await fetch("/api/news/refresh", { method: "POST" });
      const refreshPayload = await refreshResponse.json();

      if (!refreshResponse.ok || !refreshPayload.ok) {
        setStatus(`Refresh failed: ${refreshPayload.error ?? "unknown error"}`);
        return;
      }

      setStatus(
        `Fetched ${refreshPayload.totalFetched}, keyword-match ${refreshPayload.matchedByKeyword}, inserted ${refreshPayload.inserted}.`
      );
    } else {
      setStatus("Settings saved.");
    }

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <section className="panel stack-md">
      <h3>News settings</h3>

      <label className="field">
        <span>Keywords (comma, space, or newline separated)</span>
        <textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} rows={3} />
      </label>

      <label className="field">
        <span>Feed URLs (one per line)</span>
        <textarea value={feedUrls} onChange={(event) => setFeedUrls(event.target.value)} rows={5} />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Max items per feed (refresh limit)</span>
          <input
            type="number"
            min={20}
            max={300}
            value={maxItemsPerFeed}
            onChange={(event) => setMaxItemsPerFeed(Number(event.target.value) || 20)}
          />
        </label>

        <label className="field">
          <span>Default page size</span>
          <input
            type="number"
            min={5}
            max={100}
            value={defaultPageSize}
            onChange={(event) => setDefaultPageSize(Number(event.target.value) || 20)}
          />
        </label>
      </div>

      <label className="toggle-field">
        <input
          type="checkbox"
          checked={preferJapanese}
          onChange={(event) => setPreferJapanese(event.target.checked)}
        />
        <span>Prefer Japanese articles in results</span>
      </label>

      <div className="actions-row">
        <button
          className="button-primary"
          type="button"
          disabled={isPending}
          onClick={() => submit(false)}
        >
          Save settings
        </button>
        <button
          className="button-secondary"
          type="button"
          disabled={isPending}
          onClick={() => submit(true)}
        >
          Save and refresh
        </button>
      </div>

      {status ? <p className="status-text">{status}</p> : null}
    </section>
  );
}
