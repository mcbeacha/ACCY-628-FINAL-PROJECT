import { requireUser } from "@/lib/auth";
import { canEnterTime } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExpenseEntry } from "@/lib/phase2-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MyExpensesPage() {
  const { profile, supabase } = await requireUser();
  if (!canEnterTime(profile.role) && profile.role !== "billing_staff") {
    redirect("/dashboard");
  }

  let query = supabase
    .from("expense_entries")
    .select("*, matters(id, matter_number, matter_name)")
    .order("expense_date", { ascending: false });

  if (profile.role === "attorney" || profile.role === "paralegal") {
    query = query.eq("created_by", profile.id);
  }

  const { data } = await query;
  const rows = (data || []) as ExpenseEntry[];

  return (
    <>
      <PageHeader
        title="My Expenses"
        description="Expense entries you created for assigned matters."
        actions={
          canEnterTime(profile.role) ? (
            <Link href="/expenses/new" className="btn btn-primary btn-sm">
              Enter Expense
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No expenses recorded yet." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Matter</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Reimb.</th>
                  <th>Status</th>
                  <th>Invoice</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.needs_extra_review ? "bg-warning/5" : ""}>
                    <td className="text-sm">{formatDate(r.expense_date)}</td>
                    <td className="text-sm">{r.matters?.matter_number}</td>
                    <td className="text-sm">{r.expense_type}</td>
                    <td>{formatCurrency(Number(r.amount))}</td>
                    <td className="text-sm">{r.client_reimbursable ? "Yes" : "No"}</td>
                    <td>
                      <StatusBadge status={r.approval_status} />
                      {r.needs_extra_review && (
                        <span className="badge badge-warning badge-sm ml-1">High value</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={r.invoice_status} />
                    </td>
                    <td className="text-sm max-w-xs truncate">{r.description}</td>
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
