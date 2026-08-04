import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { formatDate, isOverdue } from "@/lib/format";
import type { MatterTask } from "@/lib/types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function TasksPage() {
  const { profile, supabase } = await requireUser();

  if (profile.role === "client" || profile.role === "billing_staff") {
    redirect("/dashboard");
  }

  let query = supabase
    .from("matter_tasks")
    .select("*, matters(id, matter_number, matter_name), assignee:profiles!matter_tasks_assigned_to_fkey(full_name)")
    .order("due_date", { ascending: true });

  if (profile.role !== "managing_partner") {
    query = query.eq("assigned_to", profile.id);
  }

  const { data } = await query;
  const tasks = (data || []) as MatterTask[];

  return (
    <>
      <PageHeader
        title={profile.role === "managing_partner" ? "Tasks" : "My Tasks"}
        description="Work items connected to matters you can access."
      />
      {tasks.length === 0 ? (
        <EmptyState title="No tasks are assigned to you right now." />
      ) : (
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
                  {profile.role === "managing_partner" && <th>Assignee</th>}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const overdue = isOverdue(t.due_date, t.task_status);
                  return (
                    <tr key={t.id} className={overdue ? "bg-error/5" : ""}>
                      <td className="font-medium">{t.task_title}</td>
                      <td>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(t as any).matters ? (
                          <Link
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            href={`/matters/${(t as any).matters.id}`}
                            className="link link-hover"
                          >
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(t as any).matters.matter_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <StatusBadge status={t.task_status} />
                        {overdue && <span className="badge badge-error ml-1">Overdue</span>}
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="text-sm">{formatDate(t.due_date)}</td>
                      {profile.role === "managing_partner" && (
                        <td className="text-sm">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(t as any).assignee?.full_name || "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
