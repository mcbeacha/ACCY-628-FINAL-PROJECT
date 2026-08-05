"use client";

import { PriorityBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { daysUntil, type WorkspaceTask } from "@/lib/workspace-mock";

export function dueLabel(task: WorkspaceTask): { text: string; className: string } {
  if (task.lane === "Completed") return { text: formatDate(task.dueDate), className: "opacity-60" };
  const days = daysUntil(task.dueDate);
  if (days < 0) return { text: `Overdue · ${formatDate(task.dueDate)}`, className: "text-error font-medium" };
  if (days === 0) return { text: "Due today", className: "text-warning font-medium" };
  return { text: formatDate(task.dueDate), className: "opacity-70" };
}

export function TaskRow({
  task,
  done,
  onToggle,
}: {
  task: WorkspaceTask;
  done: boolean;
  onToggle: (id: string) => void;
}) {
  const due = dueLabel(task);

  return (
    <li className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        className="checkbox checkbox-sm mt-1"
        checked={done}
        onChange={() => onToggle(task.id)}
        aria-label={`Mark ${task.name} as complete`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium leading-snug ${done ? "line-through opacity-60" : ""}`}>
          {task.name}
        </p>
        <p className="text-xs opacity-60 mt-0.5 truncate">
          {task.matterRef} · {task.matterName}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className={due.className}>{due.text}</span>
          <span className="opacity-50">·</span>
          <span className="opacity-70">{task.assignee}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <PriorityBadge priority={task.priority} />
        <span className="badge badge-ghost badge-sm">{done ? "Completed" : task.lane}</span>
      </div>
    </li>
  );
}
