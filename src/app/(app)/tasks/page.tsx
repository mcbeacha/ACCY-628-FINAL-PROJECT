import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TasksTableClient, type TaskListRow } from "@/components/TasksTableClient";
import { canManageInternalTasks } from "@/lib/permissions";
import { isOverdue } from "@/lib/format";
import type { MatterTask } from "@/lib/types";
import Link from "next/link";
import { redirect } from "next/navigation";

type TaskFilter = "open" | "overdue" | "due_soon" | "waiting" | "all";

const FILTER_LABELS: Record<TaskFilter, string> = {
  open: "Open assigned tasks",
  overdue: "Overdue tasks",
  due_soon: "Due within 7 days",
  waiting: "Waiting on others",
  all: "All tasks",
};

function matchesFilter(t: MatterTask, filter: TaskFilter) {
  const open = !["Completed", "Canceled"].includes(t.task_status);
  const overdue = isOverdue(t.due_date, t.task_status);
  if (filter === "all") return true;
  if (filter === "open") return open;
  if (filter === "overdue") return open && overdue;
  if (filter === "waiting") return t.task_status === "Waiting";
  if (filter === "due_soon") {
    if (!open || !t.due_date || overdue) return false;
    const days =
      (new Date(`${t.due_date}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }
  return true;
}

function countFor(tasks: MatterTask[], filter: TaskFilter) {
  return tasks.filter((t) => matchesFilter(t, filter)).length;
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { profile, supabase } = await requireUser();
  const params = await searchParams;

  if (profile.role === "client" || profile.role === "billing_staff") {
    redirect("/dashboard");
  }

  const filter = (
    ["open", "overdue", "due_soon", "waiting", "all"].includes(params.filter || "")
      ? params.filter
      : "open"
  ) as TaskFilter;

  let query = supabase
    .from("matter_tasks")
    .select(
      "*, matters(id, matter_number, matter_name), assignee:profiles!matter_tasks_assigned_to_fkey(full_name)"
    )
    .order("due_date", { ascending: true });

  if (profile.role !== "managing_partner") {
    query = query.eq("assigned_to", profile.id);
  }

  const { data } = await query;
  const allTasks = (data || []) as TaskListRow[];
  const tasks = allTasks.filter((t) => matchesFilter(t, filter));
  const canEdit = canManageInternalTasks(profile.role);

  const queueFilters = [
    ["open", "Open", countFor(allTasks, "open")],
    ["overdue", "Overdue", countFor(allTasks, "overdue")],
    ["due_soon", "Due soon", countFor(allTasks, "due_soon")],
    ["waiting", "Waiting", countFor(allTasks, "waiting")],
  ] as const;

  return (
    <>
      <PageHeader
        title={profile.role === "managing_partner" ? "Task Work Queue" : "My Tasks"}
        description={
          canEdit
            ? `${FILTER_LABELS[filter]}. Filter the queue, then update status and priority here.`
            : FILTER_LABELS[filter]
        }
        actions={
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            Back to dashboard
          </Link>
        }
      />

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body py-3 gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Work queue</p>
          <div className="flex flex-wrap gap-2">
            {queueFilters.map(([id, label, count]) => (
              <Link
                key={id}
                href={`/tasks?filter=${id}`}
                className={`btn btn-sm ${filter === id ? "btn-primary" : "btn-ghost"}`}
              >
                {label}
                <span className={`badge badge-sm ${filter === id ? "badge-primary" : ""}`}>
                  {count}
                </span>
              </Link>
            ))}
            <Link
              href="/tasks?filter=all"
              className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-ghost"}`}
            >
              All
              <span className={`badge badge-sm ${filter === "all" ? "badge-primary" : ""}`}>
                {allTasks.length}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks in this queue filter."
          description="Try Open, Overdue, Due soon, or Waiting — or view All."
          action={
            <Link href="/tasks?filter=open" className="btn btn-primary btn-sm">
              Show open tasks
            </Link>
          }
        />
      ) : (
        <TasksTableClient
          key={`${filter}-${tasks.map((t) => t.id).join(",")}`}
          initialTasks={tasks}
          canEdit={canEdit}
          showAssignee={profile.role === "managing_partner"}
        />
      )}
    </>
  );
}
