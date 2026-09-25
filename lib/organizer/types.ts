import type {
  OrganizerCategory,
  OrganizerTaskStatus,
  OrganizerTimeBlockStatus,
  TimeTreeSyncStatus
} from "./constants";

export type OrganizerTaskItem = {
  id: string;
  title: string;
  description: string | null;
  category: OrganizerCategory;
  status: OrganizerTaskStatus;
  importance: number;
  estimatedMinutes: number | null;
  targetDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  _count?: { timeBlocks: number };
};

export type OrganizerEventItem = {
  id: string;
  title: string;
  description: string | null;
  category: OrganizerCategory;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  shareWithPartner: boolean;
  googleCalendarEventId: string | null;
  timetreeEventId: string | null;
  timetreeSyncStatus: TimeTreeSyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerTimeBlockItem = {
  id: string;
  taskId: string;
  title: string;
  startAt: string;
  endAt: string;
  status: OrganizerTimeBlockStatus;
  actualStartAt: string | null;
  actualEndAt: string | null;
  createdAt: string;
  updatedAt: string;
  task?: Pick<OrganizerTaskItem, "id" | "title" | "category" | "status" | "estimatedMinutes">;
};

export type PlannerDayPayload = {
  date: string;
  timeZone: string;
  events: OrganizerEventItem[];
  timeBlocks: OrganizerTimeBlockItem[];
  unscheduledTasks: OrganizerTaskItem[];
};
