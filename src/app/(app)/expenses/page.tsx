import { requireUser } from "@/lib/auth";
import { canEnterTime } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExpenseEntry } from "@/lib/phase2-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MyExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { profile, supabase } = await requireUser();
  if (!canEnterTime(profile.role) && profile.role !== "billing_staff") {
    redirect("/dashboard");
  }
  const params = await searchParams;
  const personalOnly = profile.role === "attorney" || profile.role === "paralegal";
  const firmWide = !personalOnly;

  let query = supabase
    .from("expense_entries")
    .select("*, matters(id, matter_number, matter_name)")
    .order("expense_date", { ascending: false });

  if (personalOnly) {
    query = query.eq("created_by", profile.id);
  }
  if (params.status) {
    query = query.eq("approval_status", params.status);
  }

  const { data } = await query;
  let rows = (data || []) as ExpenseEntry[];
  if (params.q?.trim()) {
    const q = params.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.description, r.expense_type, r.matters?.matter_number, r.matters?.matter_name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const filterNote = [
    params.status ? `Status: ${params.status}` : null,
    params.q?.trim() ? `Search: ${params.q.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={firmWide ? "Expense Entries" : "My Expenses"}
        description={
          filterNote
            ? `Filtered view — ${filterNote}`
            : firmWide
              ? "Firm expense entries by matter, type, and approval status."
              : "Expense entries you created for assigned matters."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              Back to dashboard
            </Link>
            {canEnterTime(profile.role) ? (
              <Link href="/expenses/new" className="btn btn-primary btn-sm">
                Enter Expense
              </Link>
            ) : null}
          </div>
        }
      />

      <form className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body py-4 grid gap-3 sm:grid-cols-3">
          <input
            name="q"
            defaultValue={params.q || ""}
            className="input input-bordered"
            placeholder="Search type or description"
          />
          <select name="status" defaultValue={params.status || ""} className="select select-bordered">
            <option value="">All statuses</option>
            {["Draft", "Submitted", "Approved", "Rejected"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            Filter
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No expenses match your filters."
          action={
            <Link href="/expenses" className="btn btn-ghost btn-sm">
              Clear filters
            </Link>
          }
        />
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const canFix =
                    canEnterTime(profile.role) &&
                    !r.locked_status &&
                    (r.approval_status === "Draft" || r.approval_status === "Rejected") &&
                    (profile.role === "managing_partner" || r.created_by === profile.id);
                  return (
                    <tr key={r.id} className={r.needs_extra_review ? "bg-warning/5" : ""}>
                      <td className="text-sm">{formatDate(r.expense_date)}</td>
                      <td className="text-sm">
                        {r.matters ? (
                          <Link href={`/matters/${r.matters.id}`} className="link link-hover">
                            {r.matters.matter_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-sm">{r.expense_type}</td>
                      <td>{formatCurrency(Number(r.amount))}</td>
                      <td className="text-sm">{r.client_reimbursable ? "Yes" : "No"}</td>
                      <td>
                        <StatusBadge status={r.approval_status} />
                        {r.rejection_reason && (
                          <div className="text-xs text-error mt-1 max-w-[12rem]">{r.rejection_reason}</div>
                        )}
                        {r.needs_extra_review && (
                          <span className="badge badge-warning badge-sm ml-1">High value</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.invoice_status} />
                      </td>
                      <td className="text-sm max-w-xs truncate">{r.description}</td>
                      <td className="text-right whitespace-nowrap">
                        {canFix ? (
                          <Link href={`/expenses/new?edit=${r.id}`} className="btn btn-ghost btn-xs">
                            {r.approval_status === "Rejected" ? "Edit & Resubmit" : "Edit draft"}
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
