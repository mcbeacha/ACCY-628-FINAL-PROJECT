import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import { formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";

export default async function ClientPortalPaymentsPage() {
  const { payments, matters, invoices } = await requireCurrentClientPortal();
  const matterName = (id: string | null) =>
    matters.find((m) => m.id === id)?.matter_name || "—";
  const invoiceForMatter = (matterId: string | null) =>
    invoices.find((i) => i.matter_id === matterId)?.invoice_number || "—";

  return (
    <>
      <PageHeader
        title="Payment History"
        description="Posted and reversed payments on your client account."
        actions={
          <Link href="/client-portal/pay" className="btn btn-sm btn-primary">
            Make a payment
          </Link>
        }
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      {payments.length === 0 ? (
        <EmptyState title="No payments have been recorded for this account yet." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payment</th>
                    <th>Matter</th>
                    <th>Related invoice</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-sm">{formatDate(p.payment_date)}</td>
                      <td className="text-sm font-medium">{p.payment_number}</td>
                      <td className="text-sm">{matterName(p.matter_id)}</td>
                      <td className="text-sm">{invoiceForMatter(p.matter_id)}</td>
                      <td className="text-sm">{p.payment_method}</td>
                      <td className="text-sm">{formatCurrency(Number(p.total_amount))}</td>
                      <td className="text-sm">{p.reference_number || "—"}</td>
                      <td>
                        <StatusBadge status={p.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
