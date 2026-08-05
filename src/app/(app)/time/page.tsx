import { requireUser } from "@/lib/auth";
import { canEnterTime } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import { calcBillableAmount } from "@/lib/phase2-types";
import type { TimeEntry } from "@/lib/phase2-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MyTimePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; billable?: string; q?: string }>;
}) {
  const { profile, supabase } = await requireUser();
  if (!canEnterTime(profile.role)) redirect("/dashboard");
  const params = await searchParams;

  let query = supabase
    .from("time_entries")
    .select("*, matters(id, matter_number, matter_name)")
    .order("work_date", { ascending: false });

  if (profile.role !== "managing_partner") {
    query = query.eq("employee_id", profile.id);
  }
  if (params.status) query = query.eq("approval_status", params.status);
  if (params.billable) query = query.eq("billable_status", params.billable);

  const { data } = await query;
  let rows = (data || []) as TimeEntry[];
  if (params.q?.trim()) {
    const q = params.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.billing_code, r.billing_description, r.matters?.matter_number, r.matters?.matter_name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  return (
    <>
      <PageHeader
        title="My Time"
        description="Your time entries by matter, date, and approval status."
        actions={
          <Link href="/time/new" className="btn btn-primary btn-sm">
            Enter Time
          </Link>
        }
      />

      <form className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body py-4 grid gap-3 sm:grid-cols-4">
          <input name="q" defaultValue={params.q || ""} className="input input-bordered" placeholder="Search code or description" />
          <select name="status" defaultValue={params.status || ""} className="select select-bordered">
            <option value="">All statuses</option>
            {["Draft", "Submitted", "Approved", "Rejected"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select name="billable" defaultValue={params.billable || ""} className="select select-bordered">
            <option value="">All billable</option>
            {["Billable", "Nonbillable", "No Charge"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            Filter
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No time entries match your filters." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Matter</th>
                  <th>Billing code</th>
                  <th>Hours</th>
                  <th>Billable amt</th>
                  <th>Status</th>
                  <th>Invoice</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-sm">{formatDate(r.work_date)}</td>
                    <td className="text-sm">
                      {r.matters ? (
                        <Link href={`/matters/${r.matters.id}`} className="link link-hover">
                          {r.matters.matter_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-sm font-mono">{r.billing_code || "—"}</td>
                    <td>{r.hours}</td>
                    <td className="text-sm">
                      {formatCurrency(calcBillableAmount(Number(r.hours), Number(r.billing_rate), r.billable_status))}
                    </td>
                    <td>
                      <StatusBadge status={r.approval_status} />
                      {r.rejection_reason && (
                        <div className="text-xs text-error mt-1 max-w-[12rem]">{r.rejection_reason}</div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={r.invoice_status} />
                    </td>
                    <td className="text-sm max-w-xs truncate">{r.billing_description || "—"}</td>
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
