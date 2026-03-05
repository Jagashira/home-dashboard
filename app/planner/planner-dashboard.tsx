"use client";

import { useEffect, useState } from "react";

type PlannerPayload = {
  events: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    tag: string;
    fatigue: number;
  }>;
  fatigueTotal: number;
  freeBlocks: Array<{ start: string; end: string; minutes: number }>;
  tasksTodo: Array<{ id: string; title: string; minutes: number; importance: number; fatigue: number }>;
  plan: Array<{
    block: { start: string; end: string; minutes: number };
    items: Array<{ taskId: string; title: string; minutes: number }>;
    usedMinutes: number;
    remainingMinutes: number;
  }>;
};

function hm(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function PlannerDashboard() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [data, setData] = useState<PlannerPayload | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/planner/today", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setData(payload);
      } else {
        setStatusText(payload.error ?? "読み込み失敗");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const syncCalendar = async () => {
    setSyncing(true);
    setStatusText("");
    try {
      const response = await fetch("/api/calendar/sync", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "同期失敗");
        return;
      }
      setStatusText(`同期完了: fetched ${payload.totalFetched}, inserted ${payload.inserted}`);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="stack-lg">
      <section className="panel">
        <div className="actions-row">
          <button className="button-primary" type="button" onClick={syncCalendar} disabled={syncing}>
            {syncing ? "同期中..." : "Google予定を同期"}
          </button>
          {statusText ? <p className="status-text">{statusText}</p> : null}
        </div>
      </section>

      <section className="grid-2">
        <article className="panel budget-metric">
          <p className="label-caption">今日の疲れ度</p>
          <h3>{data?.fatigueTotal ?? 0}</h3>
        </article>
        <article className="panel budget-metric">
          <p className="label-caption">未完了タスク</p>
          <h3>{data?.tasksTodo.length ?? 0}</h3>
        </article>
      </section>

      <section className="grid-2">
        <article className="panel planner-list-card">
          <h3>今日の予定</h3>
          {loading ? <p className="status-text">読み込み中...</p> : null}
          <div className="planner-list">
            {(data?.events ?? []).map((event) => (
              <article key={event.id} className="planner-item">
                <p>
                  {hm(event.startAt)} - {hm(event.endAt)}
                </p>
                <strong>{event.title}</strong>
                <p className="status-text">
                  [{event.tag}] fatigue {event.fatigue}
                </p>
              </article>
            ))}
            {(data?.events.length ?? 0) === 0 ? <p className="status-text">予定なし</p> : null}
          </div>
        </article>

        <article className="panel planner-list-card">
          <h3>空き時間</h3>
          <div className="planner-list">
            {(data?.freeBlocks ?? []).map((block) => (
              <article className="planner-item" key={`${block.start}-${block.end}`}>
                <strong>
                  {block.start} - {block.end}
                </strong>
                <p className="status-text">{block.minutes} 分</p>
              </article>
            ))}
            {(data?.freeBlocks.length ?? 0) === 0 ? <p className="status-text">空きなし</p> : null}
          </div>
        </article>
      </section>

      <section className="panel planner-list-card">
        <h3>今日のプラン</h3>
        <div className="planner-list">
          {(data?.plan ?? []).map((block) => (
            <article className="planner-item" key={`${block.block.start}-${block.block.end}`}>
              <strong>
                {block.block.start} - {block.block.end} ({block.block.minutes}分)
              </strong>
              <p className="status-text">
                used {block.usedMinutes} / remain {block.remainingMinutes}
              </p>
              <ul>
                {block.items.map((item) => (
                  <li key={`${block.block.start}-${item.taskId}-${item.minutes}`}>
                    {item.title} ({item.minutes}分)
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {(data?.plan.length ?? 0) === 0 ? <p className="status-text">割当なし</p> : null}
        </div>
      </section>
    </section>
  );
}
