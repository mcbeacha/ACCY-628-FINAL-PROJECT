import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import { formatCurrency, formatDate } from "@/lib/format";

const CLIENT_FACING_TYPES = new Set([
  "Deposit",
  "Applied to Invoice",
  "Refund",
  "Adjustment",
  "Initial Deposit",
  "Application",
  "Applied",
]);

export default async function ClientPortalRetainersPage() {
  const { retainers, retainerTx } = await requireCurrentClientPortal();

  return (
    <>
      <PageHeader
        title="Retainer Summary"
        description="A retainer is an ASC 606 contract liability: money held for future legal services, not revenue when received. It is applied to invoices after performance obligations are satisfied."
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      {retainers.length === 0 ? (
        <EmptyState title="No retainer accounts are linked to your matters." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {retainers.map((r) => (
            <article key={r.id} className="rounded-box border border-base-300 bg-base-100 p-5">
              <h2 className="font-display text-lg font-semibold">
                {r.matters?.matter_name || "Matter"}
              </h2>
              <p className="text-xs opacity-60">{r.matters?.matter_number}</p>
              <dl className="mt-3 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <dt className="opacity-60">Initial retainer</dt>
                  <dd>{formatCurrency(Number(r.initial_retainer_amount || 0))}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="opacity-60">Current balance</dt>
                  <dd className="font-semibold">{formatCurrency(Number(r.current_balance))}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="opacity-60">Replenishment threshold</dt>
                  <dd>{formatCurrency(Number(r.replenishment_threshold || 0))}</dd>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <dt className="opacity-60">Status</dt>
                  <dd>
                    <StatusBadge status={r.account_status} />
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Recent retainer activity</h2>
          {retainerTx.length === 0 ? (
            <p className="text-sm opacity-60">No retainer activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {retainerTx
                .filter(
                  (t) =>
                    CLIENT_FACING_TYPES.has(t.transaction_type) ||
                    !t.transaction_type.toLowerCase().includes("internal")
                )
                .slice(0, 20)
                .map((t) => (
                  <li key={t.id} className="flex flex-wrap justify-between gap-2 border-b border-base-200 pb-2">
                    <span>
                      {formatDate(t.transaction_date)} · {t.transaction_type}
                    </span>
                    <span className="font-medium">{formatCurrency(Number(t.amount))}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
