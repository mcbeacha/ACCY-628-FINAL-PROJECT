import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import { formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ClientPortalMatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { matters, tasks, invoices, payments, retainers, paralegal } =
    await requireCurrentClientPortal();
  const matter = matters.find((m) => m.id === id);
  if (!matter) notFound();

  const matterTasks = tasks.filter((t) => t.matter_id === id);
  const matterInvoices = invoices.filter((i) => i.matter_id === id);
  const matterPayments = payments.filter((p) => p.matter_id === id);
  const retainer = retainers.find((r) => r.matter_id === id);

  return (
    <>
      <PageHeader
        title={matter.matter_name}
        description={`${matter.matter_number} · ${matter.practice_area}`}
        actions={
          <Link href="/client-portal/matters" className="btn btn-sm btn-ghost">
            Back to matters
          </Link>
        }
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={matter.matter_status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body text-sm space-y-2">
            <h2 className="card-title text-base">Matter overview</h2>
            <p className="opacity-80 whitespace-pre-wrap">
              {matter.matter_description || matter.scope_summary || "No client-facing description."}
            </p>
            <p>
              <span className="opacity-60">Lead attorney:</span>{" "}
              {matter.responsible?.full_name || "—"}
            </p>
            <p>
              <span className="opacity-60">Primary paralegal:</span> {paralegal?.full_name || "—"}
            </p>
            <p>
              <span className="opacity-60">Engagement start:</span>{" "}
              {formatDate(matter.engagement_start_date)}
            </p>
            <p>
              <span className="opacity-60">Expected end:</span>{" "}
              {formatDate(matter.expected_end_date)}
            </p>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body text-sm space-y-2">
            <h2 className="card-title text-base">Billing snapshot</h2>
            <p>
              Retainer balance:{" "}
              <strong>
                {retainer ? formatCurrency(Number(retainer.current_balance)) : "—"}
              </strong>
            </p>
            <ul className="space-y-1">
              {matterInvoices.slice(0, 5).map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <Link href={`/client-portal/invoices/${i.id}`} className="link link-hover">
                    {i.invoice_number}
                  </Link>
                  <span>{formatCurrency(Number(i.balance_due))}</span>
                </li>
              ))}
              {!matterInvoices.length && <li className="opacity-60">No finalized invoices.</li>}
            </ul>
            <Link href="/client-portal/contact" className="btn btn-sm btn-outline w-fit mt-2">
              Contact legal team
            </Link>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Client-visible milestones</h2>
          {matterTasks.length === 0 ? (
            <EmptyState title="No client-visible milestones for this matter." />
          ) : (
            <ul className="space-y-2">
              {matterTasks.map((t) => (
                <li key={t.id} className="flex flex-wrap justify-between gap-2 text-sm border-b border-base-200 pb-2">
                  <div>
                    <p className="font-medium">{t.task_title}</p>
                    <p className="opacity-70 text-xs">{t.task_description || "—"}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={t.task_status} />
                    <p className="text-xs opacity-60 mt-1">{formatDate(t.due_date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Payments on this matter</h2>
          {matterPayments.length === 0 ? (
            <p className="text-sm opacity-60">No posted payments yet.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {matterPayments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>
                    {formatDate(p.payment_date)} · {p.payment_number}
                  </span>
                  <span>{formatCurrency(Number(p.total_amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
