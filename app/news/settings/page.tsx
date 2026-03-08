"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type TopicSetting = {
  id?: number;
  name: string;
  query: string;
  isActive: boolean;
  allocationPercent: number;
  displayOrder: number;
};

type SettingsPayload = {
  totalRequested: number;
  days: number;
  topics: TopicSetting[];
};

export default function NewsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsPayload>({
    totalRequested: 30,
    days: 1,
    topics: []
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/news/settings", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setSettings(payload.settings);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateTopic = (index: number, patch: Partial<TopicSetting>) => {
    setSettings((current) => {
      const topics = [...current.topics];
      topics[index] = { ...topics[index], ...patch };
      return { ...current, topics };
    });
  };

  const addTopic = () => {
    setSettings((current) => ({
      ...current,
      topics: [
        ...current.topics,
        {
          name: "",
          query: "",
          isActive: true,
          allocationPercent: 0,
          displayOrder: current.topics.length + 1
        }
      ]
    }));
  };

  const save = async () => {
    setSaving(true);
    setStatus("保存中...");
    try {
      const response = await fetch("/api/news/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatus(`保存失敗: ${payload.error ?? "unknown error"}`);
        return;
      }
      setSettings(payload.settings);
      setStatus("保存しました");
    } catch (error) {
      setStatus(`保存失敗: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <p>Loading...</p>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <section className="panel">
        <h1 className="news-title">ニュース設定</h1>
        <div className="stack-sm">
          <label className="stack-xs">
            <span>総取得件数</span>
            <input
              className="inline-input"
              type="number"
              min={1}
              max={200}
              value={settings.totalRequested}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  totalRequested: Number(event.target.value)
                }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>取得範囲(days)</span>
            <input
              className="inline-input"
              type="number"
              min={1}
              max={30}
              value={settings.days}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  days: Number(event.target.value)
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="panel stack-md">
        <h2>トピック</h2>
        {settings.topics.map((topic, index) => (
          <div className="settings-topic-row" key={`${topic.id ?? "new"}-${index}`}>
            <input
              className="inline-input"
              placeholder="name"
              value={topic.name}
              onChange={(event) => updateTopic(index, { name: event.target.value })}
            />
            <input
              className="inline-input"
              placeholder="query"
              value={topic.query}
              onChange={(event) => updateTopic(index, { query: event.target.value })}
            />
            <input
              className="inline-input"
              type="number"
              min={0}
              max={100}
              value={topic.allocationPercent}
              onChange={(event) =>
                updateTopic(index, { allocationPercent: Number(event.target.value) })
              }
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={topic.isActive}
                onChange={(event) => updateTopic(index, { isActive: event.target.checked })}
              />
              active
            </label>
          </div>
        ))}
        <div className="actions-row">
          <button className="button-secondary" type="button" onClick={addTopic}>
            +追加
          </button>
          <button className="button-primary" type="button" onClick={save} disabled={saving}>
            保存
          </button>
          <Link className="button-secondary" href="/news">
            戻る
          </Link>
        </div>
        {status ? <p className="meta-text">{status}</p> : null}
      </section>
    </section>
  );
}
