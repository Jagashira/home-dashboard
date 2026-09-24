export const ORGANIZER_CATEGORIES = ["university", "work", "entertainment", "life"] as const;
export const ORGANIZER_TASK_STATUSES = ["inbox", "planned", "doing", "completed", "cancelled"] as const;
export const ORGANIZER_TIME_BLOCK_STATUSES = ["planned", "doing", "completed", "skipped"] as const;
export const TIMETREE_SYNC_STATUSES = ["not_requested", "pending", "synced", "error"] as const;

export type OrganizerCategory = (typeof ORGANIZER_CATEGORIES)[number];
export type OrganizerTaskStatus = (typeof ORGANIZER_TASK_STATUSES)[number];
export type OrganizerTimeBlockStatus = (typeof ORGANIZER_TIME_BLOCK_STATUSES)[number];
export type TimeTreeSyncStatus = (typeof TIMETREE_SYNC_STATUSES)[number];

export const CATEGORY_LABELS: Record<OrganizerCategory, string> = {
  university: "大学",
  work: "仕事",
  entertainment: "娯楽",
  life: "生活"
};

export const TASK_STATUS_LABELS: Record<OrganizerTaskStatus, string> = {
  inbox: "Inbox",
  planned: "計画済み",
  doing: "進行中",
  completed: "完了",
  cancelled: "キャンセル"
};

export const TIME_BLOCK_STATUS_LABELS: Record<OrganizerTimeBlockStatus, string> = {
  planned: "予定",
  doing: "実行中",
  completed: "完了",
  skipped: "スキップ"
};

export const TOKYO_TIME_ZONE = "Asia/Tokyo";

