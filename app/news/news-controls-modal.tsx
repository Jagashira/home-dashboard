"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type NewsControlsModalProps = {
  initialQuery: string;
  initialFrom: string;
  initialTo: string;
  initialPageSize: number;
  initialScanLimit: number;
  initialKeywords: string[];
  initialFeedUrls: string[];
  initialMaxItemsPerFeed: number;
  initialDefaultPageSize: number;
  initialPreferJapanese: boolean;
  initialIncludePaywalled: boolean;
  initialPaywallMode: "exclude" | "include" | "only";
};

function splitKeywords(value: string): string[] {
  return value
    .split(/[\s,、\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function NewsControlsModal(props: NewsControlsModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  const defaultKeywords = useMemo(() => {
    return [...new Set(["半導体", "AI", "テック", ...props.initialKeywords])];
  }, [props.initialKeywords]);

  const [keywords, setKeywords] = useState<string[]>(splitKeywords(props.initialQuery));
  const [customKeyword, setCustomKeyword] = useState("");
  const [from, setFrom] = useState(props.initialFrom);
  const [to, setTo] = useState(props.initialTo);
  const [pageSize, setPageSize] = useState(props.initialPageSize);
  const [scanLimit, setScanLimit] = useState(props.initialScanLimit);
  const [paywallMode, setPaywallMode] = useState<"exclude" | "include" | "only">(
    props.initialPaywallMode
  );

  const [settingKeywords, setSettingKeywords] = useState(props.initialKeywords.join(", "));
  const [settingFeedUrls, setSettingFeedUrls] = useState(props.initialFeedUrls.join("\n"));
  const [settingMaxItemsPerFeed, setSettingMaxItemsPerFeed] = useState(
    props.initialMaxItemsPerFeed
  );
  const [settingDefaultPageSize, setSettingDefaultPageSize] = useState(
    props.initialDefaultPageSize
  );
  const [settingPreferJapanese, setSettingPreferJapanese] = useState(
    props.initialPreferJapanese
  );
  const [settingIncludePaywalled, setSettingIncludePaywalled] = useState(
    props.initialIncludePaywalled
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleKeyword = (keyword: string) => {
    setKeywords((current) => {
      if (current.includes(keyword)) {
        return current.filter((item) => item !== keyword);
      }
      return [...current, keyword];
    });
  };

  const addCustomKeyword = () => {
    const token = customKeyword.trim();
    if (!token) {
      return;
    }
    setKeywords((current) => (current.includes(token) ? current : [...current, token]));
    setCustomKeyword("");
  };

  const setDateRange = (days: number) => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - (days - 1));
    setFrom(formatDateInput(fromDate));
    setTo(formatDateInput(toDate));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (keywords.length > 0) {
      params.set("q", keywords.join(" "));
    }
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("pageSize", String(pageSize));
    params.set("scanLimit", String(scanLimit));
    params.set("pw", paywallMode);
    params.set("page", "1");

    setFilterStatus("適用中...");

    startTransition(() => {
      router.push(`/news?${params.toString()}`);
      setOpen(false);
      setFilterStatus(null);
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      router.push("/news");
      setOpen(false);
    });
  };

  const saveSettings = async (refreshAfterSave: boolean) => {
    setSettingsStatus("保存中...");

    const saveResponse = await fetch("/api/news/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: settingKeywords,
        feedUrls: settingFeedUrls,
        maxItemsPerFeed: settingMaxItemsPerFeed,
        defaultPageSize: settingDefaultPageSize,
        preferJapanese: settingPreferJapanese,
        includePaywalled: settingIncludePaywalled
      })
    });

    const savePayload = await saveResponse.json();
    if (!saveResponse.ok || !savePayload.ok) {
      setSettingsStatus(`保存失敗: ${savePayload.error ?? "unknown error"}`);
      return;
    }

    if (refreshAfterSave) {
      setSettingsStatus("再取得中...");
      const refreshResponse = await fetch("/api/news/refresh", { method: "POST" });
      const refreshPayload = await refreshResponse.json();

      if (!refreshResponse.ok || !refreshPayload.ok) {
        setSettingsStatus(`再取得失敗: ${refreshPayload.error ?? "unknown error"}`);
        return;
      }

      setSettingsStatus(
        `Fetched ${refreshPayload.totalFetched}, keyword-match ${refreshPayload.matchedByKeyword}, inserted ${refreshPayload.inserted}`
      );
    } else {
      setSettingsStatus("保存しました");
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const modal = open ? (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="News controls"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div className="modal-card stack-lg news-controls-modal">
        <div className="modal-header">
          <h3>検索 / 設定</h3>
          <button className="button-secondary" type="button" onClick={() => setOpen(false)}>
            閉じる
          </button>
        </div>

        <section className="search-card stack-md">
          <h4>検索</h4>

          <div className="stack-sm">
            <p className="label-caption">現在のキーワード</p>
            <div className="chip-row">
              {keywords.length === 0 ? <span className="meta-text">未指定</span> : null}
              {keywords.map((keyword) => (
                <button
                  key={`selected-${keyword}`}
                  type="button"
                  className="chip chip-active"
                  onClick={() => toggleKeyword(keyword)}
                >
                  {keyword} ×
                </button>
              ))}
            </div>
          </div>

          <div className="stack-sm">
            <p className="label-caption">キーワード追加</p>
            <div className="actions-row">
              <input
                className="inline-input"
                type="text"
                value={customKeyword}
                onChange={(event) => setCustomKeyword(event.target.value)}
                placeholder="キーワードを追加"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomKeyword();
                  }
                }}
              />
              <button className="button-secondary" type="button" onClick={addCustomKeyword}>
                追加
              </button>
            </div>
          </div>

          <div className="stack-sm">
            <p className="label-caption">デフォルト</p>
            <div className="chip-row">
              {defaultKeywords.map((keyword) => {
                const selected = keywords.includes(keyword);
                return (
                  <button
                    key={keyword}
                    type="button"
                    className={selected ? "chip chip-active" : "chip"}
                    onClick={() => toggleKeyword(keyword)}
                  >
                    {keyword}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="actions-row">
            <button className="chip" type="button" onClick={() => setDateRange(1)}>
              今日
            </button>
            <button className="chip" type="button" onClick={() => setDateRange(7)}>
              直近7日
            </button>
            <button className="chip" type="button" onClick={() => setDateRange(30)}>
              直近30日
            </button>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>From</span>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="field">
              <span>To</span>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>

          <div className="actions-row">
            <button
              type="button"
              className={paywallMode === "exclude" ? "chip chip-active" : "chip"}
              onClick={() => setPaywallMode("exclude")}
            >
              鍵付き除外
            </button>
            <button
              type="button"
              className={paywallMode === "include" ? "chip chip-active" : "chip"}
              onClick={() => setPaywallMode("include")}
            >
              全件
            </button>
            <button
              type="button"
              className={paywallMode === "only" ? "chip chip-active" : "chip"}
              onClick={() => setPaywallMode("only")}
            >
              鍵付きのみ
            </button>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>Page size</span>
              <input
                type="number"
                min={5}
                max={100}
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) || 20)}
              />
            </label>

            <label className="field">
              <span>Scan limit</span>
              <input
                type="number"
                min={50}
                max={2000}
                value={scanLimit}
                onChange={(event) => setScanLimit(Number(event.target.value) || 500)}
              />
            </label>
          </div>

          <div className="actions-row">
            <button className="button-primary" type="button" disabled={isPending} onClick={applyFilters}>
              検索する
            </button>
            <button className="button-secondary" type="button" disabled={isPending} onClick={resetFilters}>
              リセット
            </button>
          </div>
          {filterStatus ? <p className="status-text">{filterStatus}</p> : null}
        </section>

        <section className="stack-md">
          <h4>再取得設定</h4>

          <label className="field">
            <span>Keywords (comma/space/newline)</span>
            <textarea
              rows={3}
              value={settingKeywords}
              onChange={(event) => setSettingKeywords(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Feed URLs (one per line)</span>
            <textarea
              rows={4}
              value={settingFeedUrls}
              onChange={(event) => setSettingFeedUrls(event.target.value)}
            />
          </label>

          <div className="grid-2">
            <label className="field">
              <span>Max items per feed</span>
              <input
                type="number"
                min={20}
                max={300}
                value={settingMaxItemsPerFeed}
                onChange={(event) => setSettingMaxItemsPerFeed(Number(event.target.value) || 120)}
              />
            </label>

            <label className="field">
              <span>Default page size</span>
              <input
                type="number"
                min={5}
                max={100}
                value={settingDefaultPageSize}
                onChange={(event) => setSettingDefaultPageSize(Number(event.target.value) || 20)}
              />
            </label>
          </div>

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={settingPreferJapanese}
              onChange={(event) => setSettingPreferJapanese(event.target.checked)}
            />
            <span>日本語記事を優先表示</span>
          </label>

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={settingIncludePaywalled}
              onChange={(event) => setSettingIncludePaywalled(event.target.checked)}
            />
            <span>鍵付き記事も再取得に含める</span>
          </label>

          <div className="actions-row">
            <button
              className="button-secondary"
              type="button"
              disabled={isPending}
              onClick={() => saveSettings(false)}
            >
              設定保存
            </button>
            <button
              className="button-primary"
              type="button"
              disabled={isPending}
              onClick={() => saveSettings(true)}
            >
              保存して再取得
            </button>
          </div>

          {settingsStatus ? <p className="status-text">{settingsStatus}</p> : null}
        </section>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button className="button-secondary" type="button" onClick={() => setOpen(true)}>
        検索・設定を開く
      </button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
