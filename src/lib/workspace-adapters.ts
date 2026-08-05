/**
 * Adapters that turn Supabase rows into the view models the workspace
 * components render. Keeping the mapping here means a schema change only has
 * to be handled in one place, and components stay presentational.
 */

import { clientDisplayName } from "./format";
import type { Client, Matter, MatterTask } from "./types";
import type { MatterCardData } from "@/components/workspace/MatterCard";
import type {
  ActivityEvent,
  ActivityKind,
  FocusItem,
  Priority,
  TaskLane,
  TimekeepingSummary,
  WorkspaceTask,
} from "./workspace-mock";

/** Rough completion percentage used for the matter progress indicator. */
const STAGE_BY_STATUS: Record<string, number> = {
  Draft: 10,
  "Pending Approval": 25,
  Active: 55,
  "On Hold": 40,
  Closing: 85,
  Closed: 100,
  Canceled: 0,
};

export function toMatterCards(
  matters: Matter[],
  responsibleNames: Map<string, string> = new Map()
): MatterCardData[] {
  return matters.map((matter) => ({
    id: matter.id,
    matterNumber: matter.matter_number,
    matterName: matter.matter_name,
    clientName: clientDisplayName(matter.clients as Client | undefined),
    practiceArea: matter.practice_area || "Unassigned",
    status: matter.matter_status,
    responsibleAttorney:
      matter.responsible?.full_name ||
      responsibleNames.get(matter.responsible_attorney_id ?? "") ||
      "Unassigned",
    nextDeadline: matter.expected_end_date ?? null,
    lastActivity: matter.updated_at ?? matter.created_at ?? null,
    stage: STAGE_BY_STATUS[matter.matter_status] ?? 50,
  }));
}

function toPriority(value: string | null | undefined): Priority {
  switch (value) {
    case "Urgent":
      return "Critical";
    case "High":
      return "High";
    case "Low":
      return "Low";
    default:
      return "Medium";
  }
}

function toLane(status: string | null | undefined): TaskLane {
  switch (status) {
    case "In Progress":
      return "In Progress";
    case "Waiting":
      return "Waiting";
    case "Completed":
    case "Canceled":
      return "Completed";
    default:
      return "To Do";
  }
}

export function toWorkspaceTasks(
  tasks: MatterTask[],
  fallbackAssignee = "Unassigned"
): WorkspaceTask[] {
  return tasks.map((task) => ({
    id: task.id,
    name: task.task_title,
    matterRef: task.matters?.matter_number ?? "—",
    matterName: task.matters?.matter_name ?? "Unlinked task",
    matterId: task.matter_id ?? null,
    assignee: task.assignee?.full_name ?? fallbackAssignee,
    dueDate: task.due_date ?? new Date().toISOString().slice(0, 10),
    priority: toPriority(task.priority),
    lane: toLane(task.task_status),
    practiceArea: "—",
  }));
}

const ACTIVITY_KIND_RULES: [RegExp, ActivityKind][] = [
  [/upload/i, "document_uploaded"],
  [/document|file/i, "document_edited"],
  [/task/i, "task_completed"],
  [/status|approv/i, "status_changed"],
  [/time|hour/i, "time_logged"],
  [/message|email|call/i, "message_received"],
  [/note/i, "note_added"],
  [/deadline|due/i, "deadline_created"],
];

function toActivityKind(actionType: string | null | undefined): ActivityKind {
  const value = actionType ?? "";
  for (const [pattern, kind] of ACTIVITY_KIND_RULES) {
    if (pattern.test(value)) return kind;
  }
  return "status_changed";
}

type ActivityRow = {
  id: string;
  action_type?: string | null;
  action_description?: string | null;
  created_at?: string | null;
  performer?: { full_name?: string | null } | null;
  matters?: { matter_number?: string | null } | null;
};

export function toActivityEvents(rows: ActivityRow[]): ActivityEvent[] {
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    kind: toActivityKind(row.action_type),
    actor: row.performer?.full_name ?? "A team member",
    description: row.action_description ?? row.action_type ?? "updated the matter",
    matterRef: row.matters?.matter_number ?? "—",
    minutesAgo: row.created_at
      ? Math.max(0, Math.round((now - new Date(row.created_at).getTime()) / 60_000))
      : 0,
  }));
}

type TimeRow = {
  work_date?: string | null;
  hours?: number | string | null;
  billable_status?: string | null;
};

export function buildTimekeeping(
  rows: TimeRow[],
  availableWeeklyHours = 40
): TimekeepingSummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekIso = weekStart.toISOString().slice(0, 10);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthIso = monthStart.toISOString().slice(0, 10);

  const hoursOf = (row: TimeRow) => Number(row.hours) || 0;
  const sum = (list: TimeRow[]) => list.reduce((total, row) => total + hoursOf(row), 0);

  const monthRows = rows.filter((r) => (r.work_date ?? "") >= monthIso);

  return {
    hoursToday: sum(rows.filter((r) => r.work_date === todayIso)),
    hoursWeek: sum(rows.filter((r) => (r.work_date ?? "") >= weekIso)),
    billableMonth: sum(monthRows.filter((r) => r.billable_status === "Billable")),
    nonBillableMonth: sum(monthRows.filter((r) => r.billable_status !== "Billable")),
    // Roughly 4.33 weeks per month at an 80% billable target.
    monthlyGoal: Math.round(availableWeeklyHours * 4.33 * 0.8),
  };
}

/** Turns tasks that are due today into Today's Focus entries. */
export function focusFromTasks(tasks: WorkspaceTask[]): FocusItem[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((task) => task.lane !== "Completed" && task.dueDate === todayIso)
    .map((task) => ({
      id: `focus-task-${task.id}`,
      kind: "task" as const,
      title: task.name,
      matterRef: task.matterRef,
      clientName: task.matterName,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.lane,
      href: "/tasks?filter=due_soon",
    }));
}
