"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DoneTask = {
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

type EditForm = {
  title: string;
  note: string;
  hours: string;
  canSplit: boolean;
  importance: string;
  targetDate: string;
  dueDate: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function formatHours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}時間`;
}

export function DoneTaskList() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<DoneTask[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks?status=done", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setTasks(payload.tasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchTask = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  };

  const removeTask = async (id: string) => {
    if (!window.confirm("このタスクを削除しますか？")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await load();
  };

  const reopen = async (task: DoneTask) => {
    await patchTask(task.id, {
      status: "todo",
      progressMinutes: Math.max(0, task.minutes - 30)
    });
    await load();
  };

  const startEdit = (task: DoneTask) => {
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
    await load();
  };

  return (
    <section className="stack-lg">
      <section className="panel task-hero-card">
        <div className="task-section-heading">
          <div>
            <p className="label-caption">DONE TASKS</p>
            <h2 className="budget-title">完了済み</h2>
          </div>
          <Link className="button-secondary" href="/tasks">
            未完了へ戻る
          </Link>
        </div>
      </section>

      <section className="panel planner-list-card">
        {loading ? <p className="status-text">読み込み中...</p> : null}
        <div className="task-list">
          {tasks.map((task) => (
            <article className="task-card done" key={task.id}>
              <div className="task-card-head">
                <div className="stack-sm">
                  <strong>{task.title}</strong>
                  {task.note ? <p className="task-meta">{task.note}</p> : null}
                </div>
                <div className="task-card-head-actions">
                  <span className="task-score-chip done">完了</span>
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
                <p className="task-detail-item">進捗 100%</p>
                <p className="task-detail-item">重要度 {task.importance}</p>
                <p className="task-detail-item">期限 {formatDate(task.targetDate)}</p>
                <p className="task-detail-item">最終期限 {formatDate(task.dueDate)}</p>
              </div>

              <div className="task-actions-row">
                <button className="button-secondary" type="button" onClick={() => reopen(task)}>
                  再開
                </button>
              </div>
            </article>
          ))}
          {tasks.length === 0 && !loading ? <p className="status-text">完了済みタスクはありません</p> : null}
        </div>
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
