"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  ORGANIZER_CATEGORIES,
  TASK_STATUS_LABELS,
  type OrganizerCategory
} from "@/lib/organizer/constants";
import { dateOnlyWeekEnd, todayInTokyo } from "@/lib/organizer/dates";
import type { OrganizerTaskItem } from "@/lib/organizer/types";
import { organizerFetch } from "@/components/organizer/api";
import { OrganizerNav } from "@/components/organizer/organizer-nav";
import { QuickAddDialog } from "@/components/organizer/quick-add-dialog";
import { TimeBlockDialog } from "@/components/organizer/time-block-dialog";

type Scope = "today" | "week" | "all";
type StatusFilter = "active" | "completed" | "cancelled" | "all";
type Sort = "date" | "importance" | "created";

function taskDate(task: OrganizerTaskItem) {
  return task.targetDate ?? task.dueDate;
}

function bucket(task: OrganizerTaskItem, today: string, weekEnd: string) {
  const dates = [task.targetDate, task.dueDate].filter(Boolean) as string[];
  if (dates.some((value) => value <= today)) return "today";
  if (dates.some((value) => value <= weekEnd)) return "week";
  return "later";
}

function importanceMarks(value: number) {
  return "!".repeat(value);
}

function sortTasks(tasks: OrganizerTaskItem[], sort: Sort) {
  return [...tasks].sort((a, b) => {
    if (sort === "importance" && a.importance !== b.importance) return b.importance - a.importance;
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    const aDate = taskDate(a) ?? "9999-12-31";
    const bDate = taskDate(b) ?? "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    if (a.importance !== b.importance) return b.importance - a.importance;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function TaskWorkspace() {
  const [tasks, setTasks] = useState<OrganizerTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<Scope>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [category, setCategory] = useState<OrganizerCategory | "all">("all");
  const [sort, setSort] = useState<Sort>("date");
  const [addOpen, setAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OrganizerTaskItem | null>(null);
  const [schedulingTask, setSchedulingTask] = useState<OrganizerTaskItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await organizerFetch<{ ok: true; tasks: OrganizerTaskItem[] }>("/api/organizer/tasks");
      setTasks(payload.tasks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "タスクを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayInTokyo();
  const weekEnd = dateOnlyWeekEnd(today);
  const filtered = useMemo(() => {
    const statusMatches = (task: OrganizerTaskItem) => {
      if (statusFilter === "active") return !["completed", "cancelled"].includes(task.status);
      if (statusFilter === "all") return true;
      return task.status === statusFilter;
    };
    return sortTasks(
      tasks.filter((task) => {
        if (!statusMatches(task) || (category !== "all" && task.category !== category)) return false;
        const taskBucket = bucket(task, today, weekEnd);
        return scope === "all" || taskBucket === scope || (scope === "week" && taskBucket === "today");
      }),
      sort
    );
  }, [tasks, statusFilter, category, scope, sort, today, weekEnd]);

  const groups = [
    { key: "today", label: "TODAY", items: filtered.filter((task) => bucket(task, today, weekEnd) === "today") },
    { key: "week", label: "THIS WEEK", items: filtered.filter((task) => bucket(task, today, weekEnd) === "week") },
    { key: "later", label: "LATER", items: filtered.filter((task) => bucket(task, today, weekEnd) === "later") }
  ].filter((group) => group.items.length > 0);

  const patchTask = async (task: OrganizerTaskItem, patch: Record<string, unknown>) => {
    setError("");
    try {
      await organizerFetch(`/api/organizer/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "更新に失敗しました。");
    }
  };

  const removeTask = async (task: OrganizerTaskItem) => {
    if (!window.confirm(`「${task.title}」を削除しますか？関連するTimeBlockも削除されます。`)) return;
    try {
      await organizerFetch(`/api/organizer/tasks/${task.id}`, { method: "DELETE" });
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "削除に失敗しました。");
    }
  };

  return (
    <section className="organizer-page">
      <header className="organizer-page-header">
        <div>
          <p className="organizer-eyebrow">WHAT</p>
          <h1>Tasks</h1>
          <p>必要なことを集め、選び、完了させる。</p>
        </div>
        <button className="organizer-primary-button organizer-add-button" type="button" onClick={() => setAddOpen(true)}>＋ Add</button>
      </header>

      <OrganizerNav current="tasks" />

      <section className="organizer-task-toolbar" aria-label="Task filters">
        <div className="organizer-segmented">
          {(["today", "week", "all"] as Scope[]).map((value) => (
            <button key={value} type="button" className={scope === value ? "is-active" : ""} onClick={() => setScope(value)}>
              {value === "today" ? "Today" : value === "week" ? "This Week" : "All"}
            </button>
          ))}
        </div>
        <div className="organizer-filter-row">
          <select aria-label="ステータス" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="active">未完了</option><option value="completed">完了</option><option value="cancelled">キャンセル</option><option value="all">すべて</option>
          </select>
          <select aria-label="カテゴリ" value={category} onChange={(event) => setCategory(event.target.value as OrganizerCategory | "all")}>
            <option value="all">全カテゴリ</option>{ORGANIZER_CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}
          </select>
          <select aria-label="並び順" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="date">日付順</option><option value="importance">重要度順</option><option value="created">追加順</option>
          </select>
        </div>
      </section>

      {error ? <p className="organizer-banner-error" role="alert">{error}</p> : null}
      {loading ? <div className="organizer-empty-state">読み込み中…</div> : null}
      {!loading && groups.length === 0 ? <div className="organizer-empty-state"><strong>表示するタスクはありません</strong><span>Addから最初のタスクを追加できます。</span></div> : null}

      <div className="organizer-task-groups">
        {groups.map((group) => (
          <section className="organizer-task-group" key={group.key}>
            <header><h2>{group.label}</h2><span>{group.items.length}</span></header>
            <div className="organizer-task-list">
              {group.items.map((task) => {
                const overdue = task.dueDate && task.dueDate < today && !["completed", "cancelled"].includes(task.status);
                const completed = task.status === "completed";
                return (
                  <article className={`organizer-task-row${overdue ? " is-overdue" : ""}${completed ? " is-completed" : ""}`} key={task.id}>
                    <button className="organizer-complete-button" type="button" onClick={() => patchTask(task, { status: completed ? "inbox" : "completed" })} aria-label={completed ? "完了を取り消す" : "完了にする"}>{completed ? "✓" : ""}</button>
                    <button className="organizer-task-main" type="button" onClick={() => setEditingTask(task)}>
                      <span className={`organizer-importance importance-${task.importance}`} aria-label={`重要度${task.importance}`}>{importanceMarks(task.importance)}</span>
                      <strong>{task.title}</strong>
                      <span className="organizer-task-meta">
                        {task.estimatedMinutes ? `${task.estimatedMinutes} min` : "時間未設定"}
                        {task.targetDate ? ` · ${task.targetDate}にやる` : ""}
                        {task.dueDate ? ` · ${task.dueDate}締切` : ""}
                      </span>
                    </button>
                    <div className="organizer-task-tags">
                      {overdue ? <span className="organizer-overdue-chip">期限超過</span> : null}
                      <span className={`organizer-category-chip category-${task.category}`}>{CATEGORY_LABELS[task.category]}</span>
                      <span className="organizer-status-chip">{TASK_STATUS_LABELS[task.status]}</span>
                    </div>
                    <div className="organizer-row-actions">
                      {!completed && task.status !== "cancelled" ? <button type="button" onClick={() => setSchedulingTask(task)}>Plan</button> : null}
                      {!completed && task.status !== "cancelled" ? <button type="button" onClick={() => patchTask(task, { status: "cancelled" })}>Cancel</button> : null}
                      <button type="button" onClick={() => setEditingTask(task)}>Edit</button>
                      <button className="is-danger" type="button" onClick={() => removeTask(task)}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <QuickAddDialog open={addOpen} initialType="task" onClose={() => setAddOpen(false)} onSaved={load} />
      <QuickAddDialog open={Boolean(editingTask)} task={editingTask} onClose={() => setEditingTask(null)} onSaved={load} />
      <TimeBlockDialog open={Boolean(schedulingTask)} task={schedulingTask} initialDate={today} onClose={() => setSchedulingTask(null)} onSaved={load} />
    </section>
  );
}

