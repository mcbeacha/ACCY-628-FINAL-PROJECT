"use client";

import { EmptyState } from "@/components/EmptyState";
import { TaskRow } from "@/components/workspace/TaskRow";
import { daysUntil, type WorkspaceTask } from "@/lib/workspace-mock";
import { useMemo, useState } from "react";

type TaskFilter = "Due Today" | "Upcoming" | "Overdue" | "Waiting" | "Completed";

const FILTERS: TaskFilter[] = ["Due Today", "Upcoming", "Overdue", "Waiting", "Completed"];

const EMPTY_COPY: Record<TaskFilter, string> = {
  "Due Today": "Nothing is due today. Check upcoming work to get ahead.",
  Upcoming: "No upcoming tasks are scheduled.",
  Overdue: "Nothing is overdue. Your assignments are on track.",
  Waiting: "No tasks are waiting on someone else.",
  Completed: "No tasks have been completed yet.",
};

function matchesFilter(task: WorkspaceTask, filter: TaskFilter, done: boolean): boolean {
  const completed = done || task.lane === "Completed";
  if (filter === "Completed") return completed;
  if (completed) return false;
  const days = daysUntil(task.dueDate);
  switch (filter) {
    case "Due Today":
      return days === 0;
    case "Upcoming":
      return days > 0;
    case "Overdue":
      return days < 0;
    case "Waiting":
      return task.lane === "Waiting";
  }
}

export function MyTasksPanel({ tasks }: { tasks: WorkspaceTask[] }) {
  const [filter, setFilter] = useState<TaskFilter>("Due Today");
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setCompletedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  const counts = useMemo(() => {
    const result = {} as Record<TaskFilter, number>;
    for (const f of FILTERS) {
      result[f] = tasks.filter((t) => matchesFilter(t, f, completedIds.includes(t.id))).length;
    }
    return result;
  }, [tasks, completedIds]);

  const visible = tasks.filter((t) => matchesFilter(t, filter, completedIds.includes(t.id)));

  return (
    <div>
      <div role="tablist" className="tabs tabs-box mb-3 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={filter === f}
            className={`tab gap-1.5 ${filter === f ? "tab-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
            <span className="badge badge-ghost badge-xs">{counts[f]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title={`No ${filter.toLowerCase()} tasks`} description={EMPTY_COPY[filter]} />
      ) : (
        <ul className="divide-y divide-base-200">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              done={completedIds.includes(task.id) || task.lane === "Completed"}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
