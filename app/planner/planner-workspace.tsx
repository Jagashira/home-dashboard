"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/organizer/constants";
import {
  addDateOnlyDays,
  formatTokyoTime,
  todayInTokyo
} from "@/lib/organizer/dates";
import { layoutTimelineItems } from "@/lib/organizer/timeline";
import type {
  OrganizerEventItem,
  OrganizerTaskItem,
  OrganizerTimeBlockItem,
  PlannerDayPayload
} from "@/lib/organizer/types";
import { organizerFetch } from "@/components/organizer/api";
import { OrganizerNav } from "@/components/organizer/organizer-nav";
import { QuickAddDialog } from "@/components/organizer/quick-add-dialog";
import { TimeBlockDialog } from "@/components/organizer/time-block-dialog";

const START_HOUR = 6;
const END_HOUR = 24;
const PIXELS_PER_MINUTE = 1;

function minuteOfDay(value: string) {
  const [hour, minute] = formatTokyoTime(value).split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function dateHeading(date: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date(`${date}T00:00:00+09:00`));
}

export function PlannerWorkspace() {
  const [date, setDate] = useState(todayInTokyo());
  const [data, setData] = useState<PlannerDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addStartTime, setAddStartTime] = useState("09:00");
  const [editingEvent, setEditingEvent] = useState<OrganizerEventItem | null>(null);
  const [schedulingTask, setSchedulingTask] = useState<OrganizerTaskItem | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00");
  const [editingTimeBlock, setEditingTimeBlock] = useState<OrganizerTimeBlockItem | null>(null);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await organizerFetch<{ ok: true } & PlannerDayPayload>(`/api/organizer/planner?date=${date}`);
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Plannerを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const timedEvents = data?.events.filter((event) => !event.allDay) ?? [];
  const allDayEvents = data?.events.filter((event) => event.allDay) ?? [];
  const timelineItems = useMemo(() => {
    const startBoundary = START_HOUR * 60;
    const endBoundary = END_HOUR * 60;
    const raw = [
      ...timedEvents.map((event) => ({ id: `event:${event.id}`, start: Math.max(startBoundary, minuteOfDay(event.startAt)), end: Math.min(endBoundary, minuteOfDay(event.endAt)) })),
      ...(data?.timeBlocks ?? []).map((block) => ({ id: `block:${block.id}`, start: Math.max(startBoundary, minuteOfDay(block.startAt)), end: Math.min(endBoundary, minuteOfDay(block.endAt)) }))
    ].filter((item) => item.end > item.start);
    return new Map(layoutTimelineItems(raw).map((item) => [item.id, item]));
  }, [timedEvents, data?.timeBlocks]);

  const nowMinutes = minuteOfDay(new Date().toISOString());
  const showNow = date === todayInTokyo() && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  const openEventAt = (time: string) => {
    setAddStartTime(time);
    setAddOpen(true);
  };

  const openSchedule = (task: OrganizerTaskItem, time = "09:00") => {
    setScheduleStartTime(time);
    setSchedulingTask(task);
    setUnscheduledOpen(false);
  };

  const dropTask = (dropEvent: React.DragEvent, minutes: number) => {
    dropEvent.preventDefault();
    const taskId = dropEvent.dataTransfer.getData("application/x-organizer-task");
    const task = data?.unscheduledTasks.find((item) => item.id === taskId);
    if (task) openSchedule(task, timeFromMinutes(minutes));
  };

  const renderBlock = (item: OrganizerEventItem | OrganizerTimeBlockItem, kind: "event" | "block") => {
    const layout = timelineItems.get(`${kind}:${item.id}`);
    if (!layout) return null;
    const top = (layout.start - START_HOUR * 60) * PIXELS_PER_MINUTE;
    const height = Math.max(28, (layout.end - layout.start) * PIXELS_PER_MINUTE);
    const width = 100 / layout.columnCount;
    const style = {
      top,
      height,
      left: `calc(${layout.column * width}% + 4px)`,
      width: `calc(${width}% - 8px)`
    };
    const category = kind === "event" ? (item as OrganizerEventItem).category : (item as OrganizerTimeBlockItem).task?.category ?? "life";
    return (
      <button
        key={`${kind}:${item.id}`}
        className={`organizer-calendar-item is-${kind} category-${category}`}
        style={style}
        type="button"
        onClick={() => kind === "event" ? setEditingEvent(item as OrganizerEventItem) : setEditingTimeBlock(item as OrganizerTimeBlockItem)}
      >
        <span>{formatTokyoTime(item.startAt)}–{formatTokyoTime(item.endAt)}</span>
        <strong>{item.title}</strong>
        {kind === "event" && (item as OrganizerEventItem).location ? <small>{(item as OrganizerEventItem).location}</small> : null}
      </button>
    );
  };

  return (
    <section className="organizer-page organizer-planner-page">
      <header className="organizer-page-header organizer-planner-header">
        <div>
          <p className="organizer-eyebrow">WHEN</p>
          <h1>Planner</h1>
          <p>EventとTaskの時間割当を、ひとつの一日に。</p>
        </div>
        <div className="organizer-header-actions">
          <button className="organizer-secondary-button organizer-mobile-unscheduled-button" type="button" onClick={() => setUnscheduledOpen(true)}>未割当 {data?.unscheduledTasks.length ?? 0}</button>
          <button className="organizer-primary-button organizer-add-button" type="button" onClick={() => openEventAt("09:00")}>＋ Add</button>
        </div>
      </header>

      <OrganizerNav current="planner" />

      <section className="organizer-date-nav">
        <button type="button" onClick={() => setDate((value) => addDateOnlyDays(value, -1))} aria-label="前日">‹</button>
        <div>
          <strong>{dateHeading(date)}</strong>
          <input aria-label="日付を選択" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <button type="button" onClick={() => setDate((value) => addDateOnlyDays(value, 1))} aria-label="翌日">›</button>
        {date !== todayInTokyo() ? <button className="organizer-today-button" type="button" onClick={() => setDate(todayInTokyo())}>今日</button> : null}
      </section>

      {error ? <p className="organizer-banner-error" role="alert">{error}</p> : null}

      <div className="organizer-planner-layout">
        <main className="organizer-calendar-panel">
          {allDayEvents.length > 0 ? (
            <section className="organizer-all-day-row">
              <span>ALL DAY</span>
              <div>{allDayEvents.map((event) => <button key={event.id} type="button" className={`category-${event.category}`} onClick={() => setEditingEvent(event)}>{event.title}</button>)}</div>
            </section>
          ) : null}

          <div className="organizer-timeline-scroll">
            <div className="organizer-timeline" style={{ height: (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE }}>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index).map((hour) => (
                <div className="organizer-hour-line" key={hour} style={{ top: (hour - START_HOUR) * 60 * PIXELS_PER_MINUTE }}><span>{String(hour).padStart(2, "0")}</span></div>
              ))}
              <div className="organizer-slot-layer">
                {Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => START_HOUR * 60 + index * 30).map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-label={`${timeFromMinutes(minutes)}に予定を追加`}
                    style={{ top: (minutes - START_HOUR * 60) * PIXELS_PER_MINUTE, height: 30 * PIXELS_PER_MINUTE }}
                    onClick={() => openEventAt(timeFromMinutes(minutes))}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropTask(event, minutes)}
                  />
                ))}
              </div>
              <div className="organizer-calendar-items">
                {timedEvents.map((event) => renderBlock(event, "event"))}
                {(data?.timeBlocks ?? []).map((block) => renderBlock(block, "block"))}
              </div>
              {showNow ? <div className="organizer-now-line" style={{ top: (nowMinutes - START_HOUR * 60) * PIXELS_PER_MINUTE }}><span>NOW</span></div> : null}
              {loading ? <div className="organizer-calendar-loading">読み込み中…</div> : null}
            </div>
          </div>
        </main>

        <aside className={`organizer-unscheduled-panel${unscheduledOpen ? " is-mobile-open" : ""}`}>
          <header>
            <div><p className="organizer-eyebrow">BACKLOG</p><h2>Unscheduled Tasks</h2></div>
            <button className="organizer-icon-button organizer-mobile-close" type="button" onClick={() => setUnscheduledOpen(false)} aria-label="閉じる">×</button>
          </header>
          <p className="organizer-panel-help">タップして時刻を指定。Desktopでは時間軸へドラッグできます。</p>
          <div className="organizer-unscheduled-list">
            {(data?.unscheduledTasks ?? []).map((task) => (
              <button
                className={`organizer-unscheduled-task importance-${task.importance}`}
                key={task.id}
                type="button"
                draggable
                onDragStart={(event) => event.dataTransfer.setData("application/x-organizer-task", task.id)}
                onClick={() => openSchedule(task)}
              >
                <span>{"!".repeat(task.importance)}</span>
                <strong>{task.title}</strong>
                <small>{task.estimatedMinutes ? `${task.estimatedMinutes}m` : "時間未設定"}</small>
                <em>{CATEGORY_LABELS[task.category]}</em>
              </button>
            ))}
            {!loading && (data?.unscheduledTasks.length ?? 0) === 0 ? <p className="organizer-empty-compact">未割当タスクはありません。</p> : null}
          </div>
        </aside>
      </div>

      {unscheduledOpen ? <button className="organizer-drawer-backdrop" type="button" aria-label="未割当一覧を閉じる" onClick={() => setUnscheduledOpen(false)} /> : null}
      <QuickAddDialog open={addOpen} initialType="event" initialDate={date} initialStartTime={addStartTime} onClose={() => setAddOpen(false)} onSaved={load} />
      <QuickAddDialog open={Boolean(editingEvent)} event={editingEvent} onClose={() => setEditingEvent(null)} onSaved={load} />
      <TimeBlockDialog open={Boolean(schedulingTask)} task={schedulingTask} initialDate={date} initialStartTime={scheduleStartTime} onClose={() => setSchedulingTask(null)} onSaved={load} />
      <TimeBlockDialog open={Boolean(editingTimeBlock)} timeBlock={editingTimeBlock} onClose={() => setEditingTimeBlock(null)} onSaved={load} />
    </section>
  );
}
