import { requireUser } from "@/lib/auth";
import { canPrepareInvoices } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/billing-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const { profile, supabase } = await requireUser();
  if (profile.role === "client" || profile.role === "paralegal") {
    redirect("/dashboard");
  }

  let q = supabase
    .from("invoices")
    .select("*, matters(matter_number, matter_name), clients(organization_name, first_name, last_name)")
    .order("invoice_date", { ascending: false });

  if (profile.role === "attorney") {
    // RLS will limit; still fine
  }

  const { data } = await q;
  const rows = (data || []) as (Invoice & {
    matters?: { matter_number: string; matter_name: string } | null;
    clients?: { organization_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
  })[];

  return (
    <>
      <PageHeader
        title={profile.role === "attorney" ? "Matter Billing" : "Invoices"}
        description="Invoice preparation, approval, and collection status (simulated)."
        actions={
          canPrepareInvoices(profile.role) ? (
            <Link href="/invoices/new" className="btn btn-primary btn-sm">
              Prepare invoice
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No invoices found." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Matter</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover">
                    <td>
                      <Link href={`/invoices/${r.id}`} className="link link-hover font-medium">
                        {r.invoice_number}
                      </Link>
                    </td>
                    <td className="text-sm">{formatDate(r.invoice_date)}</td>
                    <td className="text-sm">{formatDate(r.due_date)}</td>
                    <td className="text-sm">{r.matters?.matter_number}</td>
                    <td>{formatCurrency(Number(r.invoice_total))}</td>
                    <td className="font-semibold">{formatCurrency(Number(r.balance_due))}</td>
                    <td>
                      <StatusBadge status={r.invoice_status} />
                    </td>
                    <td>
                      <StatusBadge status={r.approval_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
