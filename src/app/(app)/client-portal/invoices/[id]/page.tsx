import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import {
  clientFacingInvoiceStatus,
  requireCurrentClientPortal,
} from "@/lib/client-portal-data";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ClientPortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { invoices, payments } = await requireCurrentClientPortal();
  const inv = invoices.find((i) => i.id === id);
  if (!inv) notFound();

  const { supabase } = await requireUser();
  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("id, description, final_amount, line_type, service_date")
    .eq("invoice_id", id)
    .order("created_at");

  const relatedPayments = payments.filter((p) => p.matter_id === inv.matter_id);

  return (
    <>
      <PageHeader
        title={inv.invoice_number}
        description={`${inv.matters?.matter_name || "Matter"} · Due ${formatDate(inv.due_date)}`}
        actions={
          <>
            <Link href="/client-portal/invoices" className="btn btn-sm btn-ghost">
              Back
            </Link>
            {Number(inv.balance_due) > 0 && (
              <Link href={`/client-portal/pay?invoice=${inv.id}`} className="btn btn-sm btn-primary">
                Pay this invoice
              </Link>
            )}
          </>
        }
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      <StatusBadge status={clientFacingInvoiceStatus(inv)} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Invoice total</div>
          <div className="stat-value text-xl">{formatCurrency(Number(inv.invoice_total))}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Retainer applied</div>
          <div className="stat-value text-xl">{formatCurrency(Number(inv.retainer_applied))}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Payments applied</div>
          <div className="stat-value text-xl">{formatCurrency(Number(inv.payments_applied))}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-box">
          <div className="stat-title">Balance due</div>
          <div className="stat-value text-xl">{formatCurrency(Number(inv.balance_due))}</div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Invoice lines</h2>
          <ul className="space-y-2 text-sm">
            {(lines || []).map((l) => (
              <li key={l.id} className="flex justify-between gap-2 border-b border-base-200 pb-2">
                <span>
                  {l.description}
                  <span className="opacity-50 text-xs block">{l.line_type}</span>
                </span>
                <span>{formatCurrency(Number(l.final_amount))}</span>
              </li>
            ))}
            {!(lines || []).length && <li className="opacity-60">No line items.</li>}
          </ul>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Related payment history</h2>
          <ul className="text-sm space-y-1">
            {relatedPayments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {formatDate(p.payment_date)} · {p.payment_number} · {p.payment_method}
                </span>
                <span>{formatCurrency(Number(p.total_amount))}</span>
              </li>
            ))}
            {!relatedPayments.length && <li className="opacity-60">No payments yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
