import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import { formatDate } from "@/lib/format";

function milestoneLabel(status: string) {
  if (status === "Completed") return "Completed";
  if (status === "In Progress") return "In Progress";
  if (status === "Waiting") return "Waiting on Third Party";
  if (status === "Not Started") return "Upcoming";
  return status;
}

export default async function ClientPortalMilestonesPage() {
  const { tasks, matters } = await requireCurrentClientPortal();
  const matterName = (id: string) => matters.find((m) => m.id === id)?.matter_name || "Matter";

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Client-visible milestones and progress checkpoints on your matters."
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="No client-visible milestones are available right now." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((t) => (
            <article key={t.id} className="rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-semibold">{t.task_title}</h2>
                <StatusBadge status={milestoneLabel(t.task_status)} />
              </div>
              <p className="text-xs opacity-60 mt-1">{matterName(t.matter_id)}</p>
              <p className="text-sm opacity-80 mt-2">{t.task_description || "No additional description."}</p>
              <p className="text-xs opacity-60 mt-3">
                {t.task_status === "Completed"
                  ? `Completed ${formatDate(t.completed_at || t.due_date)}`
                  : `Due ${formatDate(t.due_date)}`}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
