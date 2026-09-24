"use client";

import { useEffect, useState } from "react";
import {
  CATEGORY_LABELS,
  ORGANIZER_CATEGORIES,
  TASK_STATUS_LABELS,
  type OrganizerCategory,
  type OrganizerTaskStatus
} from "@/lib/organizer/constants";
import {
  addDateOnlyDays,
  formatTokyoDate,
  formatTokyoTime,
  todayInTokyo,
  tokyoDateTimeToUtc
} from "@/lib/organizer/dates";
import type { OrganizerEventItem, OrganizerTaskItem } from "@/lib/organizer/types";
import { organizerFetch } from "./api";

type ItemType = "task" | "event";

type Props = {
  open: boolean;
  initialType?: ItemType;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  task?: OrganizerTaskItem | null;
  event?: OrganizerEventItem | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function defaultEnd(start: string) {
  const [hour, minute] = start.split(":").map(Number);
  const total = Math.min(hour * 60 + minute + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function QuickAddDialog({
  open,
  initialType = "task",
  initialDate,
  initialStartTime = "09:00",
  initialEndTime,
  task,
  event,
  onClose,
  onSaved
}: Props) {
  const editing = Boolean(task || event);
  const [type, setType] = useState<ItemType>(initialType);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<OrganizerCategory>("work");
  const [more, setMore] = useState(false);
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState(todayInTokyo());
  const [dueDate, setDueDate] = useState(todayInTokyo());
  const [importance, setImportance] = useState("2");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [status, setStatus] = useState<OrganizerTaskStatus>("inbox");
  const [date, setDate] = useState(initialDate ?? todayInTokyo());
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime ?? defaultEnd(initialStartTime));
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [shareWithPartner, setShareWithPartner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const nextType = task ? "task" : event ? "event" : initialType;
    setType(nextType);
    setTitle(task?.title ?? event?.title ?? "");
    setCategory((task?.category ?? event?.category ?? "work") as OrganizerCategory);
    setDescription(task?.description ?? event?.description ?? "");
    setTargetDate(task ? task.targetDate ?? "" : initialDate ?? todayInTokyo());
    setDueDate(task ? task.dueDate ?? "" : initialDate ?? todayInTokyo());
    setImportance(String(task?.importance ?? 2));
    setEstimatedMinutes(task?.estimatedMinutes ? String(task.estimatedMinutes) : "");
    setStatus((task?.status ?? "inbox") as OrganizerTaskStatus);
    setDate(event ? formatTokyoDate(event.startAt) : initialDate ?? todayInTokyo());
    setStartTime(event ? formatTokyoTime(event.startAt) : initialStartTime);
    setEndTime(event ? formatTokyoTime(event.endAt) : initialEndTime ?? defaultEnd(initialStartTime));
    setAllDay(event?.allDay ?? false);
    setLocation(event?.location ?? "");
    setShareWithPartner(event?.shareWithPartner ?? false);
    setMore(editing);
    setError("");
  }, [open, task, event, initialType, initialDate, initialStartTime, initialEndTime, editing]);

  if (!open) return null;

  const save = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (type === "task") {
        const payload = {
          title,
          category,
          description: description || null,
          targetDate: targetDate || null,
          dueDate: dueDate || null,
          importance: Number(importance),
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
          ...(task ? { status } : {})
        };
        await organizerFetch(task ? `/api/organizer/tasks/${task.id}` : "/api/organizer/tasks", {
          method: task ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        });
      } else {
        const startAt = allDay ? tokyoDateTimeToUtc(date, "00:00") : tokyoDateTimeToUtc(date, startTime);
        const endAt = allDay
          ? tokyoDateTimeToUtc(addDateOnlyDays(date, 1), "00:00")
          : tokyoDateTimeToUtc(date, endTime);
        await organizerFetch(event ? `/api/organizer/events/${event.id}` : "/api/organizer/events", {
          method: event ? "PATCH" : "POST",
          body: JSON.stringify({
            title,
            category,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            allDay,
            location: location || null,
            description: description || null,
            shareWithPartner
          })
        });
      }
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const target = task ? { url: `/api/organizer/tasks/${task.id}`, name: "タスク" } : event ? { url: `/api/organizer/events/${event.id}`, name: "予定" } : null;
    if (!target || !window.confirm(`${target.name}を削除しますか？`)) return;
    setSaving(true);
    try {
      await organizerFetch(target.url, { method: "DELETE" });
      await onSaved();
      onClose();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "削除に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="organizer-add-title" onMouseDown={onClose}>
      <section className="modal-card organizer-add-dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <header className="organizer-dialog-header">
          <div>
            <p className="organizer-eyebrow">{editing ? "EDIT" : "QUICK ADD"}</p>
            <h2 id="organizer-add-title">{editing ? "Edit" : "Add"}</h2>
          </div>
          <button className="organizer-icon-button" type="button" onClick={onClose} aria-label="閉じる">×</button>
        </header>

        {!editing ? (
          <div className="organizer-type-switch" aria-label="追加する種類">
            <button type="button" className={type === "task" ? "is-active" : ""} onClick={() => setType("task")}>TASK</button>
            <button type="button" className={type === "event" ? "is-active" : ""} onClick={() => setType("event")}>EVENT</button>
          </div>
        ) : null}

        <form className="organizer-form" onSubmit={save}>
          <label className="organizer-field organizer-title-field">
            <span>What?</span>
            <input autoFocus required maxLength={200} value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} placeholder={type === "task" ? "やることを入力" : "予定を入力"} />
          </label>

          <fieldset className="organizer-category-fieldset">
            <legend>Category</legend>
            <div className="organizer-category-options">
              {ORGANIZER_CATEGORIES.map((value) => (
                <button key={value} type="button" className={category === value ? `category-${value} is-active` : `category-${value}`} onClick={() => setCategory(value)}>
                  {CATEGORY_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          {type === "event" ? (
            <div className="organizer-inline-fields organizer-event-basics">
              <label className="organizer-field"><span>Date</span><input required type="date" value={date} onChange={(inputEvent) => setDate(inputEvent.target.value)} /></label>
              {!allDay ? <>
                <label className="organizer-field"><span>Start</span><input required type="time" value={startTime} onChange={(inputEvent) => setStartTime(inputEvent.target.value)} /></label>
                <label className="organizer-field"><span>End</span><input required type="time" value={endTime} onChange={(inputEvent) => setEndTime(inputEvent.target.value)} /></label>
              </> : null}
            </div>
          ) : null}

          <button className="organizer-more-button" type="button" onClick={() => setMore((value) => !value)} aria-expanded={more}>
            {more ? "Less options" : "More options"}
          </button>

          {more ? (
            <div className="organizer-more-panel">
              {type === "task" ? <>
                <div className="organizer-inline-fields">
                  <label className="organizer-field"><span>やりたい日</span><input type="date" value={targetDate} onChange={(inputEvent) => setTargetDate(inputEvent.target.value)} /></label>
                  <label className="organizer-field"><span>本当の締切</span><input type="date" value={dueDate} onChange={(inputEvent) => setDueDate(inputEvent.target.value)} /></label>
                </div>
                <div className="organizer-inline-fields">
                  <label className="organizer-field"><span>重要度</span><select value={importance} onChange={(inputEvent) => setImportance(inputEvent.target.value)}><option value="1">1 · 低</option><option value="2">2 · 中</option><option value="3">3 · 高</option></select></label>
                  <label className="organizer-field"><span>見積時間（分）</span><input type="number" min="1" max="1440" value={estimatedMinutes} onChange={(inputEvent) => setEstimatedMinutes(inputEvent.target.value)} placeholder="60" /></label>
                  {task ? <label className="organizer-field"><span>Status</span><select value={status} onChange={(inputEvent) => setStatus(inputEvent.target.value as OrganizerTaskStatus)}>{Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
                </div>
              </> : <>
                <label className="organizer-switch-row"><input type="checkbox" checked={allDay} onChange={(inputEvent) => setAllDay(inputEvent.target.checked)} /><span>終日</span></label>
                <label className="organizer-field"><span>場所</span><input value={location} onChange={(inputEvent) => setLocation(inputEvent.target.value)} placeholder="任意" /></label>
                <label className="organizer-switch-row organizer-partner-switch"><input type="checkbox" checked={shareWithPartner} onChange={(inputEvent) => setShareWithPartner(inputEvent.target.checked)} /><span>彼女と共有</span><small>明示的にONにした予定だけが将来のTimeTree同期対象になります。</small></label>
              </>}
              <label className="organizer-field"><span>Description</span><textarea rows={3} value={description} onChange={(inputEvent) => setDescription(inputEvent.target.value)} /></label>
            </div>
          ) : null}

          {error ? <p className="organizer-form-error" role="alert">{error}</p> : null}
          <footer className="organizer-dialog-actions">
            {editing ? <button className="organizer-danger-button" type="button" onClick={remove} disabled={saving}>削除</button> : <span />}
            <div>
              <button className="organizer-secondary-button" type="button" onClick={onClose}>キャンセル</button>
              <button className="organizer-primary-button" type="submit" disabled={saving}>{saving ? "保存中…" : editing ? "保存" : "Add"}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
