import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export default async function ClientPortalMattersPage() {
  const { matters, tasks, paralegal } = await requireCurrentClientPortal();

  return (
    <>
      <PageHeader
        title="My Matters"
        description="A plain-English view of your legal matters with Rebel Law Group."
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      {matters.length === 0 ? (
        <EmptyState title="No matters are linked to this client account yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {matters.map((m) => {
            const nextTask = tasks
              .filter(
                (t) =>
                  t.matter_id === m.id && !["Completed", "Canceled"].includes(t.task_status)
              )
              .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0];
            return (
              <article
                key={m.id}
                className="rounded-box border border-base-300 bg-base-100 p-5 flex flex-col gap-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      <Link href={`/client-portal/matters/${m.id}`} className="link link-hover">
                        {m.matter_name}
                      </Link>
                    </h2>
                    <p className="text-xs opacity-60">{m.matter_number}</p>
                  </div>
                  <StatusBadge status={m.matter_status} />
                </div>
                <p className="text-sm opacity-80">{m.practice_area}</p>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <dt className="opacity-60">Lead attorney</dt>
                    <dd>{m.responsible?.full_name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="opacity-60">Primary paralegal</dt>
                    <dd>{paralegal?.full_name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="opacity-60">Engagement start</dt>
                    <dd>{formatDate(m.engagement_start_date)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="opacity-60">Next important date</dt>
                    <dd>
                      {nextTask?.due_date
                        ? formatDate(nextTask.due_date)
                        : formatDate(m.expected_end_date)}
                    </dd>
                  </div>
                </dl>
                <p className="text-sm opacity-75">
                  {nextTask
                    ? `Milestone: ${nextTask.task_title} (${nextTask.task_status})`
                    : "No open client-visible milestones right now."}
                </p>
                <Link href={`/client-portal/matters/${m.id}`} className="btn btn-sm btn-outline w-fit">
                  Open matter
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
