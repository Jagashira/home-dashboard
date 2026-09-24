"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TIME_BLOCK_STATUS_LABELS,
  type OrganizerTimeBlockStatus
} from "@/lib/organizer/constants";
import {
  formatTokyoDate,
  formatTokyoTime,
  minutesBetween,
  todayInTokyo,
  tokyoDateTimeToUtc
} from "@/lib/organizer/dates";
import type { OrganizerTaskItem, OrganizerTimeBlockItem } from "@/lib/organizer/types";
import { organizerFetch } from "./api";

type Props = {
  open: boolean;
  task?: OrganizerTaskItem | null;
  timeBlock?: OrganizerTimeBlockItem | null;
  initialDate?: string;
  initialStartTime?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function TimeBlockDialog({
  open,
  task,
  timeBlock,
  initialDate,
  initialStartTime = "09:00",
  onClose,
  onSaved
}: Props) {
  const relatedTask = task ?? timeBlock?.task;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate ?? todayInTokyo());
  const [startTime, setStartTime] = useState(initialStartTime);
  const [duration, setDuration] = useState("60");
  const [status, setStatus] = useState<OrganizerTimeBlockStatus>("planned");
  const [actualStartTime, setActualStartTime] = useState("");
  const [actualEndTime, setActualEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(timeBlock?.title ?? relatedTask?.title ?? "");
    setDate(timeBlock ? formatTokyoDate(timeBlock.startAt) : initialDate ?? todayInTokyo());
    setStartTime(timeBlock ? formatTokyoTime(timeBlock.startAt) : initialStartTime);
    setDuration(String(timeBlock ? Math.max(1, minutesBetween(timeBlock.startAt, timeBlock.endAt)) : relatedTask?.estimatedMinutes ?? 60));
    setStatus((timeBlock?.status ?? "planned") as OrganizerTimeBlockStatus);
    setActualStartTime(timeBlock?.actualStartAt ? formatTokyoTime(timeBlock.actualStartAt) : "");
    setActualEndTime(timeBlock?.actualEndAt ? formatTokyoTime(timeBlock.actualEndAt) : "");
    setError("");
  }, [open, relatedTask, timeBlock, initialDate, initialStartTime]);

  const endAt = useMemo(() => {
    try {
      const start = tokyoDateTimeToUtc(date, startTime);
      return new Date(start.getTime() + Math.max(1, Number(duration) || 0) * 60_000);
    } catch {
      return null;
    }
  }, [date, startTime, duration]);

  if (!open || !relatedTask) return null;

  const save = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setError("");
    try {
      const startAt = tokyoDateTimeToUtc(date, startTime);
      if (!endAt) throw new Error("終了時刻を計算できません。");
      await organizerFetch(timeBlock ? `/api/organizer/time-blocks/${timeBlock.id}` : "/api/organizer/time-blocks", {
        method: timeBlock ? "PATCH" : "POST",
        body: JSON.stringify({
          taskId: relatedTask.id,
          title,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          status,
          actualStartAt: actualStartTime ? tokyoDateTimeToUtc(date, actualStartTime).toISOString() : null,
          actualEndAt: actualEndTime ? tokyoDateTimeToUtc(date, actualEndTime).toISOString() : null
        })
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!timeBlock || !window.confirm("このTimeBlockを削除しますか？")) return;
    setSaving(true);
    try {
      await organizerFetch(`/api/organizer/time-blocks/${timeBlock.id}`, { method: "DELETE" });
      await onSaved();
      onClose();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "削除に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="time-block-dialog-title" onMouseDown={onClose}>
      <section className="modal-card organizer-time-block-dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <header className="organizer-dialog-header">
          <div>
            <p className="organizer-eyebrow">TIME BLOCK</p>
            <h2 id="time-block-dialog-title">{timeBlock ? "時間割当を編集" : "Schedule Task"}</h2>
            <p className="organizer-dialog-subtitle">{relatedTask.title}</p>
          </div>
          <button className="organizer-icon-button" type="button" onClick={onClose} aria-label="閉じる">×</button>
        </header>
        <form className="organizer-form" onSubmit={save}>
          <label className="organizer-field"><span>表示名</span><input required value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} /></label>
          <div className="organizer-inline-fields">
            <label className="organizer-field"><span>日付</span><input required type="date" value={date} onChange={(inputEvent) => setDate(inputEvent.target.value)} /></label>
            <label className="organizer-field"><span>開始</span><input required type="time" value={startTime} onChange={(inputEvent) => setStartTime(inputEvent.target.value)} /></label>
            <label className="organizer-field"><span>所要時間</span><div className="organizer-input-suffix"><input required type="number" min="1" max="1440" value={duration} onChange={(inputEvent) => setDuration(inputEvent.target.value)} /><span>min</span></div></label>
          </div>
          <p className="organizer-time-preview">{startTime}–{endAt ? `${formatTokyoDate(endAt) !== date ? `${formatTokyoDate(endAt)} ` : ""}${formatTokyoTime(endAt)}` : "--:--"}</p>
          <label className="organizer-field"><span>Status</span><select value={status} onChange={(inputEvent) => setStatus(inputEvent.target.value as OrganizerTimeBlockStatus)}>{Object.entries(TIME_BLOCK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {timeBlock ? (
            <details className="organizer-details">
              <summary>実績時間</summary>
              <div className="organizer-inline-fields">
                <label className="organizer-field"><span>実績開始</span><input type="time" value={actualStartTime} onChange={(inputEvent) => setActualStartTime(inputEvent.target.value)} /></label>
                <label className="organizer-field"><span>実績終了</span><input type="time" value={actualEndTime} onChange={(inputEvent) => setActualEndTime(inputEvent.target.value)} /></label>
              </div>
            </details>
          ) : null}
          {error ? <p className="organizer-form-error" role="alert">{error}</p> : null}
          <footer className="organizer-dialog-actions">
            {timeBlock ? <button className="organizer-danger-button" type="button" onClick={remove} disabled={saving}>削除</button> : <span />}
            <div>
              <button className="organizer-secondary-button" type="button" onClick={onClose}>キャンセル</button>
              <button className="organizer-primary-button" type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

