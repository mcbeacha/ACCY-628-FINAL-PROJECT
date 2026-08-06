"use client";

import { PriorityBadge, StatusBadge } from "@/components/Badges";
import {
  TaskCompletionModal,
  type TaskCompletionResult,
} from "@/components/TaskCompletionModal";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { celebrateTaskComplete } from "@/lib/fun-effects";
import { formatDate, isOverdue } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { MatterTask } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type TaskListRow = MatterTask & {
  matters?: { id: string; matter_number: string; matter_name: string } | null;
  assignee?: { full_name: string } | null;
};

export function TasksTableClient({
  initialTasks,
  canEdit,
  showAssignee,
}: {
  initialTasks: TaskListRow[];
  canEdit: boolean;
  showAssignee: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<TaskListRow | null>(null);

  async function persistUpdate(task: TaskListRow, patch: Partial<MatterTask>) {
    setBusyId(task.id);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: upErr } = await supabase.from("matter_tasks").update(patch).eq("id", task.id);
    if (upErr) {
      setError(upErr.message);
      setBusyId(null);
      return false;
    }

    if (patch.task_status === "Completed" && task.matters?.id) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("matter_activity").insert({
        matter_id: task.matter_id,
        action_type: "task_completed",
        action_description: patch.out_of_scope
          ? `Out-of-scope task completed: ${task.task_title}. Work: ${patch.completion_notes}. ${patch.exception_notes || ""}`
          : patch.exception_notes
            ? `Task completed with exception: ${task.task_title}. Work: ${patch.completion_notes}. Exception: ${patch.exception_notes}`
            : `Task completed: ${task.task_title}. Work documented: ${patch.completion_notes}`,
        performed_by: user?.id || task.assigned_to,
      });
    }

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    setMessage(
      patch.task_status === "Completed"
        ? `Completed “${task.task_title}” with work documentation.`
        : `Updated “${task.task_title}”.`
    );
    if (patch.task_status === "Completed") {
      celebrateTaskComplete();
    }
    setBusyId(null);
    router.refresh();
    return true;
  }

  async function updateTask(task: TaskListRow, patch: Partial<MatterTask>) {
    if (!canEdit) return;

    if (patch.task_status === "Completed") {
      setPendingComplete(task);
      return;
    }

    if (patch.task_status && patch.task_status !== "Completed") {
      patch.completed_at = null;
      patch.exception_notes = null;
      patch.out_of_scope = false;
    }

    await persistUpdate(task, patch);
  }

  async function confirmComplete(result: TaskCompletionResult) {
    if (!pendingComplete) return;
    const task = pendingComplete;
    setPendingComplete(null);
    await persistUpdate(task, {
      task_status: "Completed",
      completion_notes: result.completion_notes,
      exception_notes: result.exception_notes,
      out_of_scope: result.out_of_scope,
      completed_at: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-3">
      <TaskCompletionModal
        open={!!pendingComplete}
        taskTitle={pendingComplete?.task_title || ""}
        onCancel={() => setPendingComplete(null)}
        onConfirm={confirmComplete}
      />

      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="alert alert-success text-sm">
          <span>{message}</span>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Matter</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                {showAssignee && <th>Assignee</th>}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const overdue = isOverdue(t.due_date, t.task_status);
                return (
                  <tr key={t.id} className={overdue ? "bg-error/5" : ""}>
                    <td className="font-medium max-w-[18rem]">
                      {t.matters ? (
                        <Link href={`/matters/${t.matters.id}`} className="link link-hover">
                          {t.task_title}
                        </Link>
                      ) : (
                        t.task_title
                      )}
                      {t.task_description && (
                        <div className="text-xs opacity-60 mt-1 line-clamp-2">{t.task_description}</div>
                      )}
                      {t.task_status === "Completed" && t.completion_notes && (
                        <div className="text-xs mt-1 opacity-80">
                          <span className="font-semibold">Work:</span> {t.completion_notes}
                        </div>
                      )}
                      {t.task_status === "Completed" && t.exception_notes && (
                        <div className="text-xs mt-1 text-warning">
                          <span className="font-semibold">Exception:</span> {t.exception_notes}
                        </div>
                      )}
                      {t.task_status === "Completed" && t.out_of_scope && (
                        <div className="mt-1">
                          <span className="badge badge-warning badge-sm">Out of scope</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {t.matters ? (
                        <Link href={`/matters/${t.matters.id}`} className="link link-hover text-sm">
                          {t.matters.matter_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <select
                            className="select select-bordered select-sm min-w-[8.5rem]"
                            aria-label={`Status for ${t.task_title}`}
                            value={t.task_status}
                            disabled={busyId === t.id}
                            onChange={(e) => updateTask(t, { task_status: e.target.value })}
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          {overdue && <span className="badge badge-error">Overdue</span>}
                        </div>
                      ) : (
                        <>
                          <StatusBadge status={t.task_status} />
                          {overdue && <span className="badge badge-error ml-1">Overdue</span>}
                        </>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          className="select select-bordered select-sm min-w-[7rem]"
                          aria-label={`Priority for ${t.task_title}`}
                          value={t.priority}
                          disabled={busyId === t.id}
                          onChange={(e) => updateTask(t, { priority: e.target.value })}
                        >
                          {TASK_PRIORITIES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <PriorityBadge priority={t.priority} />
                      )}
                    </td>
                    <td className="text-sm">{formatDate(t.due_date)}</td>
                    {showAssignee && (
                      <td className="text-sm">{t.assignee?.full_name || "—"}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
