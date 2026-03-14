"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AllocationForm } from "@/components/settings/allocation-form";
import { TopicForm } from "@/components/settings/topic-form";
import { SourceToggleForm } from "@/components/settings/source-toggle-form";

export const dynamic = "force-dynamic";

type Payload = {
  ok: boolean;
  settings: { totalRequested: number; days: number; preferJapanese: boolean };
  topics: Array<{
    id?: number;
    name: string;
    query: string;
    isActive: boolean;
    allocationPercent: number;
    displayOrder: number;
  }>;
  sources: Array<{ id: number; sourceName: string; sourceType: string; isActive: boolean }>;
};

export default function NewsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [settings, setSettings] = useState({
    totalRequested: 30,
    days: 1,
    preferJapanese: true
  });
  const [topics, setTopics] = useState<Payload["topics"]>([]);
  const [sources, setSources] = useState<Payload["sources"]>([]);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json()) as Payload;
      if (response.ok && payload.ok) {
        setSettings(payload.settings);
        setTopics(payload.topics);
        setSources(payload.sources);
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus("保存中...");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, topics, sources })
      });
      const payload = (await response.json()) as Payload & { error?: string };
      if (!response.ok || !payload.ok) {
        setStatus(`失敗: ${payload.error ?? "unknown error"}`);
        return;
      }
      setStatus("保存しました");
      setSettings(payload.settings);
      setTopics(payload.topics);
      setSources(payload.sources);
    } catch (error) {
      setStatus(`失敗: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-4">Loading...</main>;

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      <Card>
        <h1 className="text-2xl font-semibold">ニュース設定</h1>
        <p className="mt-1 text-sm text-slate-600">総取得件数・トピック配分・ソースの有効/無効を管理</p>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">基本設定</h2>
        <AllocationForm
          totalRequested={settings.totalRequested}
          days={settings.days}
          preferJapanese={settings.preferJapanese}
          onChange={setSettings}
        />
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">トピック</h2>
        <TopicForm topics={topics} onChange={setTopics} />
        <div className="mt-3">
          <Button
            onClick={() =>
              setTopics((prev) => [
                ...prev,
                {
                  name: "",
                  query: "",
                  isActive: true,
                  allocationPercent: 0,
                  displayOrder: prev.length + 1
                }
              ])
            }
          >
            + トピック追加
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">ソース</h2>
        <SourceToggleForm sources={sources} onChange={setSources} />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
        <Link href="/news" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          戻る
        </Link>
      </div>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </main>
  );
}

