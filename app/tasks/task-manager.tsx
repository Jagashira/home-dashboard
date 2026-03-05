"use client";

import { useEffect, useMemo, useState } from "react";

type TaskItem = {
  id: string;
  title: string;
  note: string | null;
  minutes: number;
  importance: number;
  fatigue: number;
  dueDate: string | null;
  status: "todo" | "done";
  createdAt: string;
  updatedAt: string;
};

type TaskForm = {
  title: string;
  minutes: string;
  importance: string;
  fatigue: string;
  dueDate: string;
  note: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

export function TaskManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const [form, setForm] = useState<TaskForm>({
    title: "",
    minutes: "30",
    importance: "3",
    fatigue: "20",
    dueDate: "",
    note: ""
  });

  const todoTasks = useMemo(() => tasks.filter((task) => task.status === "todo"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setTasks(payload.tasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const submitTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          minutes: Number(form.minutes),
          importance: Number(form.importance),
          fatigue: Number(form.fatigue),
          dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null,
          note: form.note
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusText(payload.error ?? "保存失敗");
        return;
      }

      setForm({ title: "", minutes: "30", importance: "3", fatigue: "20", dueDate: "", note: "" });
      setStatusText("追加しました");
      await loadTasks();
    } finally {
      setSaving(false);
    }
  };

  const patchTask = async (id: string, data: Record<string, unknown>) => {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "更新失敗");
    }
  };

  const removeTask = async (id: string) => {
    const confirmed = window.confirm("このタスクを削除しますか？");
    if (!confirmed) return;

    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadTasks();
  };

  return (
    <section className="stack-lg">
      <section className="panel task-form-card">
        <h2>タスク追加</h2>
        <form className="stack-md" onSubmit={submitTask}>
          <label className="field">
            <span>title *</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>

          <div className="grid-3">
            <label className="field">
              <span>minutes</span>
              <input
                type="number"
                min={1}
                value={form.minutes}
                onChange={(event) => setForm((prev) => ({ ...prev, minutes: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>importance (1-5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.importance}
                onChange={(event) => setForm((prev) => ({ ...prev, importance: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>fatigue (0-100)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.fatigue}
                onChange={(event) => setForm((prev) => ({ ...prev, fatigue: event.target.value }))}
              />
            </label>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>dueDate</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>note</span>
              <input
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </div>

          <div className="actions-row">
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? "追加中..." : "追加"}
            </button>
            {statusText ? <p className="status-text">{statusText}</p> : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>未完了</h2>
        {loading ? <p className="status-text">読み込み中...</p> : null}
        <div className="task-list">
          {todoTasks.map((task) => (
            <article className="task-item" key={task.id}>
              <div className="task-item-main">
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={task.status === "done"}
                    onChange={async (event) => {
                      await patchTask(task.id, { status: event.target.checked ? "done" : "todo" });
                      await loadTasks();
                    }}
                  />
                  <strong>{task.title}</strong>
                </label>
                <p className="task-meta">due: {formatDate(task.dueDate)} / note: {task.note || "-"}</p>
              </div>
              <div className="task-inline-edit">
                <label>
                  min
                  <input
                    type="number"
                    value={task.minutes}
                    onChange={async (event) => {
                      await patchTask(task.id, { minutes: Number(event.target.value) });
                      await loadTasks();
                    }}
                  />
                </label>
                <label>
                  imp
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={task.importance}
                    onChange={async (event) => {
                      await patchTask(task.id, { importance: Number(event.target.value) });
                      await loadTasks();
                    }}
                  />
                </label>
                <label>
                  fat
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={task.fatigue}
                    onChange={async (event) => {
                      await patchTask(task.id, { fatigue: Number(event.target.value) });
                      await loadTasks();
                    }}
                  />
                </label>
                <button className="button-secondary" type="button" onClick={() => removeTask(task.id)}>
                  削除
                </button>
              </div>
            </article>
          ))}
          {todoTasks.length === 0 ? <p className="status-text">未完了タスクはありません</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>完了</h2>
        <div className="task-list">
          {doneTasks.map((task) => (
            <article className="task-item" key={task.id}>
              <div className="task-item-main">
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={task.status === "done"}
                    onChange={async (event) => {
                      await patchTask(task.id, { status: event.target.checked ? "done" : "todo" });
                      await loadTasks();
                    }}
                  />
                  <strong>{task.title}</strong>
                </label>
                <p className="task-meta">due: {formatDate(task.dueDate)} / note: {task.note || "-"}</p>
              </div>
              <button className="button-secondary" type="button" onClick={() => removeTask(task.id)}>
                削除
              </button>
            </article>
          ))}
          {doneTasks.length === 0 ? <p className="status-text">完了タスクはありません</p> : null}
        </div>
      </section>
    </section>
  );
}
