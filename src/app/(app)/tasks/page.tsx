import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { TasksClient } from "./TasksClient";
import { toWorkspaceTasks } from "@/lib/workspace-adapters";
import { TASKS as SAMPLE_TASKS } from "@/lib/workspace-mock";
import type { MatterTask } from "@/lib/types";
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
  const rows = (data || []) as MatterTask[];
  const tasks = toWorkspaceTasks(rows, profile.full_name);
  const usingSampleData = tasks.length === 0;

  return (
    <>
      <PageHeader
        title={profile.role === "managing_partner" ? "Tasks" : "My Tasks"}
        description="Work items connected to matters you can access. Switch between the list and the Kanban board."
      />
      <TasksClient
        tasks={usingSampleData ? SAMPLE_TASKS : tasks}
        usingSampleData={usingSampleData}
      />
    </>
  );
}
