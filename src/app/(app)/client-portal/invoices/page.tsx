import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import {
  clientFacingInvoiceStatus,
  requireCurrentClientPortal,
} from "@/lib/client-portal-data";
import { formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";

export default async function ClientPortalInvoicesPage() {
  const { invoices } = await requireCurrentClientPortal();
  const open = invoices.reduce((s, i) => s + Number(i.balance_due), 0);

  return (
    <>
      <PageHeader
        title="My Invoices"
        description="Finalized invoices for your account. Draft invoices are not shown."
        actions={
          open > 0 ? (
            <Link href="/client-portal/pay" className="btn btn-primary btn-sm">
              Pay outstanding balance
            </Link>
          ) : null
        }
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      {invoices.length === 0 ? (
        <EmptyState title="No finalized invoices are available yet." />
      ) : (
        <div className="grid gap-3 md:hidden">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/client-portal/invoices/${inv.id}`}
              className="rounded-box border border-base-300 bg-base-100 p-4 block"
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{inv.invoice_number}</span>
                <StatusBadge status={clientFacingInvoiceStatus(inv)} />
              </div>
              <p className="text-sm opacity-70 mt-1">
                {inv.matters?.matter_name || "Matter"} · Due {formatDate(inv.due_date)}
              </p>
              <p className="text-sm mt-2">
                Balance due: <strong>{formatCurrency(Number(inv.balance_due))}</strong>
              </p>
            </Link>
          ))}
        </div>
      )}
      {invoices.length > 0 && (
        <div className="card bg-base-100 border border-base-300 shadow-sm hidden md:block">
          <div className="card-body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Matter</th>
                    <th>Invoice date</th>
                    <th>Due date</th>
                    <th>Total</th>
                    <th>Retainer applied</th>
                    <th>Payments</th>
                    <th>Balance due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link
                          href={`/client-portal/invoices/${inv.id}`}
                          className="link link-hover font-medium"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="text-sm">{inv.matters?.matter_name || "—"}</td>
                      <td className="text-sm">{formatDate(inv.invoice_date)}</td>
                      <td className="text-sm">{formatDate(inv.due_date)}</td>
                      <td className="text-sm">{formatCurrency(Number(inv.invoice_total))}</td>
                      <td className="text-sm">{formatCurrency(Number(inv.retainer_applied))}</td>
                      <td className="text-sm">{formatCurrency(Number(inv.payments_applied))}</td>
                      <td className="text-sm font-medium">
                        {formatCurrency(Number(inv.balance_due))}
                      </td>
                      <td>
                        <StatusBadge status={clientFacingInvoiceStatus(inv)} />
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
