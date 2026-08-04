import { requireUser } from "@/lib/auth";
import { canViewUnbilled } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { calcBillableAmount } from "@/lib/phase2-types";
import type { ExpenseEntry, TimeEntry } from "@/lib/phase2-types";
import { redirect } from "next/navigation";

export default async function UnbilledPage() {
  const { profile, supabase } = await requireUser();
  if (!canViewUnbilled(profile.role)) redirect("/dashboard");

  const [{ data: timeData }, { data: expData }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*, matters(id, matter_number, matter_name, clients(organization_name, first_name, last_name)), employee:profiles!time_entries_employee_id_fkey(full_name)")
      .eq("approval_status", "Approved")
      .eq("invoice_status", "Unbilled")
      .eq("billable_status", "Billable")
      .order("work_date", { ascending: false }),
    supabase
      .from("expense_entries")
      .select("*, matters(id, matter_number, matter_name, clients(organization_name, first_name, last_name))")
      .eq("approval_status", "Approved")
      .eq("client_reimbursable", true)
      .eq("invoice_status", "Unbilled")
      .order("expense_date", { ascending: false }),
  ]);

  const timeRows = (timeData || []) as TimeEntry[];
  const expRows = (expData || []) as ExpenseEntry[];

  return (
    <>
      <PageHeader
        title="Unbilled Activity"
        description="Approved time and reimbursable expenses ready for invoicing. Prepare invoices from Invoices → Prepare Invoice."
      />

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Approved unbilled time</h2>
          {timeRows.length === 0 ? (
            <EmptyState title="No approved unbilled time entries." />
          ) : (
            <div className="table-wrap">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Matter</th>
                    <th>Employee</th>
                    <th>Hours</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {timeRows.map((r) => {
                    const missing: string[] = [];
                    if (!r.billing_description) missing.push("Missing description");
                    if (!r.billing_rate) missing.push("Missing rate");
                    return (
                      <tr key={r.id}>
                        <td>{formatDate(r.work_date)}</td>
                        <td>{r.matters?.matter_number}</td>
                        <td>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(r as any).employee?.full_name || "—"}
                        </td>
                        <td>{r.hours}</td>
                        <td>
                          {formatCurrency(
                            calcBillableAmount(Number(r.hours), Number(r.billing_rate), r.billable_status)
                          )}
                        </td>
                        <td className="max-w-xs truncate">{r.billing_description}</td>
                        <td className="text-xs text-warning">{missing.join("; ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Approved unbilled reimbursable expenses</h2>
          {expRows.length === 0 ? (
            <EmptyState title="No approved unbilled reimbursable expenses." />
          ) : (
            <div className="table-wrap">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Matter</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {expRows.map((r) => {
                    const missing: string[] = [];
                    if (!r.description) missing.push("Missing description");
                    if (Number(r.amount) >= 75 && !r.receipt_reference) missing.push("Missing receipt");
                    return (
                      <tr key={r.id}>
                        <td>{formatDate(r.expense_date)}</td>
                        <td>{r.matters?.matter_number}</td>
                        <td>{r.vendor_name || "—"}</td>
                        <td>{formatCurrency(Number(r.amount))}</td>
                        <td>{r.expense_type}</td>
                        <td className="max-w-xs truncate">{r.description}</td>
                        <td className="text-xs text-warning">{missing.join("; ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
