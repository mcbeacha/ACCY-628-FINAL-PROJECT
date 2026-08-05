"use client";

import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge } from "@/components/Badges";
import { dueLabel } from "@/components/workspace/TaskRow";
import { formatDate } from "@/lib/format";
import {
  daysUntil,
  priorityRank,
  type TaskLane,
  type WorkspaceTask,
} from "@/lib/workspace-mock";
import { KanbanSquare, List } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const LANES: TaskLane[] = ["To Do", "In Progress", "Waiting", "Review", "Completed"];
const DUE_FILTERS = ["Any due date", "Overdue", "Due today", "Next 7 days", "Later"] as const;
const SORTS = ["Due date", "Priority", "Matter", "Task name"] as const;

type DueFilter = (typeof DUE_FILTERS)[number];
type Sort = (typeof SORTS)[number];

function matchesDue(task: WorkspaceTask, filter: DueFilter): boolean {
  if (filter === "Any due date") return true;
  const days = daysUntil(task.dueDate);
  switch (filter) {
    case "Overdue":
      return days < 0 && task.lane !== "Completed";
    case "Due today":
      return days === 0;
    case "Next 7 days":
      return days > 0 && days <= 7;
    case "Later":
      return days > 7;
  }
}

const LANE_ACCENT: Record<TaskLane, string> = {
  "To Do": "border-t-base-content/30",
  "In Progress": "border-t-info",
  Waiting: "border-t-warning",
  Review: "border-t-secondary",
  Completed: "border-t-success",
};

export function TasksClient({
  tasks,
  usingSampleData,
}: {
  tasks: WorkspaceTask[];
  usingSampleData: boolean;
}) {
  const [view, setView] = useState<"List" | "Board">("List");
  const [query, setQuery] = useState("");
  const [matter, setMatter] = useState("All matters");
  const [assignee, setAssignee] = useState("All assignees");
  const [priority, setPriority] = useState("All priorities");
  const [lane, setLane] = useState("All statuses");
  const [due, setDue] = useState<DueFilter>("Any due date");
  const [sort, setSort] = useState<Sort>("Due date");

  const matters = useMemo(
    () => ["All matters", ...new Set(tasks.map((t) => t.matterRef))],
    [tasks]
  );
  const assignees = useMemo(
    () => ["All assignees", ...new Set(tasks.map((t) => t.assignee))],
    [tasks]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      if (matter !== "All matters" && task.matterRef !== matter) return false;
      if (assignee !== "All assignees" && task.assignee !== assignee) return false;
      if (priority !== "All priorities" && task.priority !== priority) return false;
      if (lane !== "All statuses" && task.lane !== lane) return false;
      if (!matchesDue(task, due)) return false;
      if (!q) return true;
      return (
        task.name.toLowerCase().includes(q) ||
        task.matterName.toLowerCase().includes(q) ||
        task.matterRef.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "Priority":
          return priorityRank(a.priority) - priorityRank(b.priority);
        case "Matter":
          return a.matterRef.localeCompare(b.matterRef);
        case "Task name":
          return a.name.localeCompare(b.name);
        default:
          return a.dueDate.localeCompare(b.dueDate);
      }
    });
  }, [tasks, query, matter, assignee, priority, lane, due, sort]);

  function resetFilters() {
    setQuery("");
    setMatter("All matters");
    setAssignee("All assignees");
    setPriority("All priorities");
    setLane("All statuses");
    setDue("Any due date");
  }

  return (
    <div className="space-y-4">
      {usingSampleData && (
        <div className="alert alert-info text-sm">
          <span>
            No tasks are recorded against your account, so the board is showing the fictional
            sample task set.
          </span>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="tabs tabs-box">
              <button
                role="tab"
                type="button"
                aria-selected={view === "List"}
                className={`tab gap-1.5 ${view === "List" ? "tab-active" : ""}`}
                onClick={() => setView("List")}
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={view === "Board"}
                className={`tab gap-1.5 ${view === "Board" ? "tab-active" : ""}`}
                onClick={() => setView("Board")}
              >
                <KanbanSquare className="h-4 w-4" />
                Kanban
              </button>
            </div>
            <p className="text-sm opacity-60">
              {visible.length} of {tasks.length} tasks
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="form-control">
              <span className="label-text text-sm font-medium">Search</span>
              <input
                className="input input-bordered w-full mt-1"
                placeholder="Task or matter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <Select label="Matter" value={matter} onChange={setMatter} options={matters} />
            <Select label="Assignee" value={assignee} onChange={setAssignee} options={assignees} />
            <Select
              label="Priority"
              value={priority}
              onChange={setPriority}
              options={["All priorities", "Critical", "High", "Medium", "Low"]}
            />
            <Select
              label="Status"
              value={lane}
              onChange={setLane}
              options={["All statuses", ...LANES]}
            />
            <Select
              label="Due date"
              value={due}
              onChange={(value) => setDue(value as DueFilter)}
              options={[...DUE_FILTERS]}
            />
            <Select
              label="Sort by"
              value={sort}
              onChange={(value) => setSort(value as Sort)}
              options={[...SORTS]}
            />
            <div className="flex items-end">
              <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No tasks match your filters"
          description="Adjust the filters above or clear them to see all of your work."
          action={
            <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
              Clear filters
            </button>
          }
        />
      ) : view === "List" ? (
        <ListView tasks={visible} />
      ) : (
        <BoardView tasks={visible} />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="form-control">
      <span className="label-text text-sm font-medium">{label}</span>
      <select
        className="select select-bordered w-full mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function MatterLink({ task }: { task: WorkspaceTask }) {
  if (!task.matterId) return <span>{task.matterRef}</span>;
  return (
    <Link href={`/matters/${task.matterId}`} className="link link-hover">
      {task.matterRef}
    </Link>
  );
}

function ListView({ tasks }: { tasks: WorkspaceTask[] }) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Matter</th>
              <th>Assignee</th>
              <th>Due</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const dueInfo = dueLabel(task);
              return (
                <tr key={task.id} className="hover">
                  <td className="font-medium">{task.name}</td>
                  <td className="text-sm">
                    <MatterLink task={task} />
                    <div className="text-xs opacity-60">{task.matterName}</div>
                  </td>
                  <td className="text-sm">{task.assignee}</td>
                  <td className={`text-sm ${dueInfo.className}`}>{dueInfo.text}</td>
                  <td>
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td>
                    <span className="badge badge-ghost">{task.lane}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BoardView({ tasks }: { tasks: WorkspaceTask[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {LANES.map((lane) => {
        const laneTasks = tasks.filter((task) => task.lane === lane);
        return (
          <section
            key={lane}
            className={`rounded-box border border-base-300 border-t-4 bg-base-100 ${LANE_ACCENT[lane]}`}
            aria-label={`${lane} column`}
          >
            <header className="flex items-center justify-between border-b border-base-200 px-3 py-2">
              <h2 className="text-sm font-semibold">{lane}</h2>
              <span className="badge badge-ghost badge-sm">{laneTasks.length}</span>
            </header>
            <div className="space-y-2 p-2">
              {laneTasks.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs opacity-50">Nothing here</p>
              ) : (
                laneTasks.map((task) => {
                  const dueInfo = dueLabel(task);
                  return (
                    <article
                      key={task.id}
                      className="rounded-box border border-base-200 bg-base-100 p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <p className="text-sm font-medium leading-snug">{task.name}</p>
                      <p className="mt-1 text-xs opacity-60 truncate">
                        <MatterLink task={task} /> · {task.assignee}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`text-xs ${dueInfo.className}`}>
                          {task.lane === "Completed" ? formatDate(task.dueDate) : dueInfo.text}
                        </span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
