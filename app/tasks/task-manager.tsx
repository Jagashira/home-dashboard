"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TaskItem = {
  id: string;
  title: string;
  note: string | null;
  minutes: number;
  progressMinutes: number;
  canSplit: boolean;
  importance: number;
  dueDate: string | null;
  targetDate: string | null;
  status: "todo" | "done";
};

type RankedTask = TaskItem & {
  remainingMinutes: number;
  progressRatio: number;
  daysToTarget: number | null;
  daysToDeadline: number | null;
  startSoon: boolean;
  warningLevel: "overdue" | "critical" | "attention" | "normal";
  priorityScore: number;
  paceScore: number;
};

type PlannerPayload = {
  tasksTodo: TaskItem[];
  doneTasks: TaskItem[];
  rankedTasks: RankedTask[];
  recommendedNow: RankedTask | null;
  attentionCount: number;
};

type TaskForm = {
  title: string;
  note: string;
  hours: string;
  canSplit: boolean;
  importance: string;
  targetDate: string;
  dueDate: string;
};

type EditForm = TaskForm;

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function formatHours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}時間`;
}

function progressPercent(task: Pick<RankedTask, "progressRatio">) {
  return Math.round(task.progressRatio * 100);
}

function warningLabel(task: RankedTask) {
  if (task.warningLevel === "overdue") return "期限切れ";
  if (task.warningLevel === "critical") return "期限直前";
  if (task.warningLevel === "attention") return "そろそろ開始";
  return "通常";
}

function warningCopy(task: RankedTask) {
  if (task.warningLevel === "overdue") return "期限または最終期限を過ぎています。";
  if (task.warningLevel === "critical") return "今日中か明日までに着手しないと厳しい状態です。";
  if (task.warningLevel === "attention") return "残工数に対して期限が近いです。";
  return "まだ余裕があります。";
}

function progressStyle(task: RankedTask, currentMinutes: number) {
  const percent = Math.round((currentMinutes / task.minutes) * 100);
  const color =
    task.warningLevel === "overdue" || task.warningLevel === "critical"
      ? "#dc2626"
      : task.warningLevel === "attention"
        ? "#ca8a04"
        : "#059669";

  return {
    background: `linear-gradient(90deg, ${color} 0%, ${color} ${percent}%, rgba(17,24,39,0.08) ${percent}%, rgba(17,24,39,0.08) 100%)`
  };
}

export function TaskManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [data, setData] = useState<PlannerPayload | null>(null);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [form, setForm] = useState<TaskForm>({
    title: "",
    note: "",
    hours: "1",
    canSplit: false,
    importance: "3",
    targetDate: "",
    dueDate: ""
  });

  const loadPlanner = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/planner/today", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setData(payload);
      } else {
        setStatusText(payload.error ?? "読み込み失敗");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanner(true);
  }, []);

  useEffect(() => {
    const nextDrafts: Record<string, number> = {};
    for (const task of data?.rankedTasks ?? []) {
      nextDrafts[task.id] = task.progressMinutes;
    }
    setProgressDrafts(nextDrafts);
  }, [data?.rankedTasks]);
  const submitTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setStatusText("");

    try {
      const hours = Number(form.hours);
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          note: form.note,
          minutes: Math.max(30, Math.round(hours * 60)),
          canSplit: form.canSplit,
          importance: Number(form.importance),
          targetDate: form.targetDate ? `${form.targetDate}T00:00:00.000Z` : null,
          dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "保存失敗");
        return;
      }

      setForm({
        title: "",
        note: "",
        hours: "1",
        canSplit: false,
        importance: "3",
        targetDate: "",
        dueDate: ""
      });
      setStatusText("追加しました");
      await loadPlanner();
    } finally {
      setSaving(false);
    }
  };

  const patchTask = async (id: string, patch: Record<string, unknown>) => {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "更新失敗");
    }
  };

  const startEdit = (task: TaskItem) => {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      note: task.note ?? "",
      hours: String(task.minutes / 60),
      canSplit: task.canSplit,
      importance: String(task.importance),
      targetDate: formatDate(task.targetDate) === "-" ? "" : formatDate(task.targetDate),
      dueDate: formatDate(task.dueDate) === "-" ? "" : formatDate(task.dueDate)
    });
  };

  const saveEdit = async (id: string) => {
    if (!editForm) return;
    await patchTask(id, {
      title: editForm.title,
      note: editForm.note,
      minutes: Math.max(30, Math.round(Number(editForm.hours || "1") * 60)),
      canSplit: editForm.canSplit,
      importance: Number(editForm.importance),
      targetDate: editForm.targetDate ? `${editForm.targetDate}T00:00:00.000Z` : null,
      dueDate: editForm.dueDate ? `${editForm.dueDate}T00:00:00.000Z` : null
    });
    setEditingId(null);
    setEditForm(null);
    await loadPlanner();
  };

  const addProgress = async (task: RankedTask, minutesToAdd: number) => {
    await patchTask(task.id, {
      progressMinutes: Math.min(task.minutes, task.progressMinutes + minutesToAdd)
    });
    await loadPlanner();
  };

  const commitProgress = async (task: RankedTask, nextProgress: number) => {
    const clamped = Math.min(task.minutes, Math.max(0, nextProgress));
    const revertProgress = Math.max(0, task.minutes - 6);

    if (clamped >= task.minutes) {
      const confirmed = window.confirm("このタスクを完了にしますか？");
      if (!confirmed) {
        await patchTask(task.id, { progressMinutes: revertProgress, status: "todo" });
        await loadPlanner();
        return;
      }

      await patchTask(task.id, { progressMinutes: task.minutes, status: "done" });
      await loadPlanner();
      return;
    }

    await patchTask(task.id, {
      progressMinutes: clamped,
      status: "todo"
    });
    await loadPlanner();
  };

  const markDone = async (task: RankedTask | TaskItem) => {
    await patchTask(task.id, { progressMinutes: task.minutes, status: "done" });
    await loadPlanner();
  };

  const removeTask = async (id: string) => {
    const confirmed = window.confirm("このタスクを削除しますか？");
    if (!confirmed) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadPlanner();
  };

  const rankedTasks = data?.rankedTasks ?? [];
  const doneTasks = data?.doneTasks ?? [];
  const recommendedNow = data?.recommendedNow ?? null;

  return (
    <section className="stack-lg">
      <section className="panel task-hero-card">
        <div className="task-hero-grid">
          <div className="stack-sm">
            <p className="label-caption">TASK</p>
            <h2 className="budget-title">Task</h2>
          </div>

          <div className="task-overview-grid">
            <article className="task-overview-card">
              <p className="label-caption">todo</p>
              <h3>{rankedTasks.length}</h3>
            </article>
            <article className="task-overview-card">
              <p className="label-caption">warn</p>
              <h3>{data?.attentionCount ?? 0}</h3>
            </article>
            <article className="task-overview-card">
              <p className="label-caption">done</p>
              <h3>{doneTasks.length}</h3>
            </article>
          </div>
        </div>
      </section>

      <section className="task-layout-grid">
        <section className="panel task-form-panel">
          <div className="task-section-heading">
            <div>
              <p className="label-caption">new</p>
              <h3>追加</h3>
            </div>
            {statusText ? <p className="status-text">{statusText}</p> : null}
          </div>

          <form className="stack-md" onSubmit={submitTask}>
            <label className="field">
              <span>タスク名</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>メモ</span>
              <textarea
                rows={4}
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>

            <div className="grid-2">
              <label className="field">
                <span>工数（時間）</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={form.hours}
                  onChange={(event) => setForm((prev) => ({ ...prev, hours: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>重要度 (1-5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.importance}
                  onChange={(event) => setForm((prev) => ({ ...prev, importance: event.target.value }))}
                />
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.canSplit}
                onChange={(event) => setForm((prev) => ({ ...prev, canSplit: event.target.checked }))}
              />
              分割して進捗を管理する
            </label>

            <div className="grid-2">
              <label className="field">
                <span>期限</span>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>最終期限</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </label>
            </div>

            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? "追加中..." : "追加"}
            </button>
          </form>
        </section>

        <section className="stack-lg">
              {recommendedNow ? (
            <article className={`panel task-alert-card ${recommendedNow.warningLevel}`}>
              <p className="label-caption">next</p>
              <h3>{recommendedNow.title}</h3>
              <div className="chip-row">
                <span className={`task-score-chip ${recommendedNow.warningLevel}`}>{warningLabel(recommendedNow)}</span>
                <span className="task-score-chip">残り {formatHours(recommendedNow.remainingMinutes)}</span>
                <span className="task-score-chip">優先度 {recommendedNow.priorityScore}</span>
              </div>
            </article>
          ) : null}

          <article className="panel task-done-link-card">
            <p className="label-caption">done</p>
            <h3>完了済み</h3>
            <Link className="button-secondary" href="/tasks/done">
              開く
            </Link>
          </article>

          <article className="panel planner-list-card">
            <div className="task-section-heading">
              <div>
                <p className="label-caption">rank</p>
                <h3>順番</h3>
              </div>
            </div>

            {loading && !data ? <p className="status-text">読み込み中...</p> : null}
            <div className="task-list">
              {rankedTasks.map((task, index) => (
                <article className={`task-card ${task.warningLevel}`} key={task.id}>
                  <div className="task-card-head">
                    <div className="stack-sm">
                      <p className="task-rank-order">#{index + 1}</p>
                      <strong>{task.title}</strong>
                      {task.note ? <p className="task-meta">{task.note}</p> : null}
                    </div>
                    <div className="task-card-head-actions">
                      <span className={`task-score-chip ${task.warningLevel}`}>{warningLabel(task)}</span>
                      <button className="icon-button" type="button" onClick={() => startEdit(task)} aria-label="編集">
                        ✎
                      </button>
                      <button className="icon-button danger" type="button" onClick={() => removeTask(task.id)} aria-label="削除">
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="task-detail-grid">
                    <p className="task-detail-item">工数 {formatHours(task.minutes)}</p>
                    <p className="task-detail-item">残り {formatHours(task.remainingMinutes)}</p>
                    <p className="task-detail-item">重要度 {task.importance}</p>
                    <p className="task-detail-item">期限 {formatDate(task.targetDate)}</p>
                    <p className="task-detail-item">最終期限 {formatDate(task.dueDate)}</p>
                    <p className="task-detail-item">{task.canSplit ? `進捗 ${progressPercent(task)}%` : "一気に進める"}</p>
                  </div>

                  {task.canSplit ? (
                    <label className="field task-progress-slider-field">
                      <input
                        className={`task-progress-slider ${task.warningLevel}`}
                        type="range"
                        min={0}
                        max={task.minutes}
                        step={5}
                        value={progressDrafts[task.id] ?? task.progressMinutes}
                        style={progressStyle(task, progressDrafts[task.id] ?? task.progressMinutes)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setProgressDrafts((prev) => ({ ...prev, [task.id]: value }));
                        }}
                        onMouseUp={async () => {
                          await commitProgress(task, progressDrafts[task.id] ?? task.progressMinutes);
                        }}
                        onTouchEnd={async () => {
                          await commitProgress(task, progressDrafts[task.id] ?? task.progressMinutes);
                        }}
                      />
                      <small className="status-text">
                        {formatHours(progressDrafts[task.id] ?? task.progressMinutes)} / {formatHours(task.minutes)}
                      </small>
                    </label>
                  ) : null}

                  <p className="status-text">{warningCopy(task)}</p>
                  {task.warningLevel === "overdue" ? (
                    <p className="error-text">期限切れです。優先して処理してください。</p>
                  ) : null}

                  <div className="task-actions-row">
                    {task.canSplit ? (
                      <>
                        <button className="button-secondary" type="button" onClick={() => addProgress(task, 30)}>
                          +30分
                        </button>
                        <button className="button-secondary" type="button" onClick={() => addProgress(task, 60)}>
                          +1時間
                        </button>
                      </>
                    ) : null}
                    <button className="button-primary" type="button" onClick={() => markDone(task)}>
                      完了
                    </button>
                  </div>
                </article>
              ))}
              {rankedTasks.length === 0 ? <p className="status-text">未完了タスクはありません</p> : null}
            </div>
          </article>
        </section>
      </section>

      {editingId && editForm ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setEditingId(null);
            setEditForm(null);
          }}
        >
          <section className="modal-card task-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>編集</h3>
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditForm(null);
                }}
              >
                閉じる
              </button>
            </div>
            <div className="task-edit-grid">
              <input value={editForm.title} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))} />
              <input value={editForm.hours} type="number" min={0.5} step={0.5} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, hours: event.target.value } : prev))} />
              <input value={editForm.importance} type="number" min={1} max={5} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, importance: event.target.value } : prev))} />
              <input value={editForm.targetDate} type="date" onChange={(event) => setEditForm((prev) => (prev ? { ...prev, targetDate: event.target.value } : prev))} />
              <input value={editForm.dueDate} type="date" onChange={(event) => setEditForm((prev) => (prev ? { ...prev, dueDate: event.target.value } : prev))} />
              <label className="checkbox-row">
                <input type="checkbox" checked={editForm.canSplit} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, canSplit: event.target.checked } : prev))} />
                分割
              </label>
              <textarea rows={4} value={editForm.note} onChange={(event) => setEditForm((prev) => (prev ? { ...prev, note: event.target.value } : prev))} />
            </div>
            <div className="task-actions-row">
              <button className="button-primary" type="button" onClick={() => saveEdit(editingId)}>
                保存
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
