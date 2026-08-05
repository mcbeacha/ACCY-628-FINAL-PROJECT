import { requireUser } from "@/lib/auth";
import { canEnterTime } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  BILLING_ACTIVITIES,
  matchesMatterActivity,
} from "@/lib/billing-codes";
import { calcBillableAmount } from "@/lib/phase2-types";
import type { TimeEntry } from "@/lib/phase2-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MyTimePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    billable?: string;
    q?: string;
    matter?: string;
    activity?: string;
    from?: string;
    oos?: string;
  }>;
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
  if (params.matter) query = query.eq("matter_id", params.matter);
  if (params.from) query = query.gte("work_date", params.from);
  if (params.oos === "1") query = query.eq("out_of_scope", true);

  const { data } = await query;
  let rows = (data || []) as TimeEntry[];

  if (params.activity) {
    rows = rows.filter((r) => matchesMatterActivity(r.billing_code, null, params.activity));
  }

  if (params.q?.trim()) {
    const q = params.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.billing_code, r.billing_description, r.matters?.matter_number, r.matters?.matter_name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const filterNote = [
    params.status ? `Status: ${params.status}` : null,
    params.from ? `From: ${params.from}` : null,
    params.billable ? `Billable: ${params.billable}` : null,
    params.matter ? "Matter filtered" : null,
    params.activity ? `Activity: ${params.activity}` : null,
    params.oos === "1" ? "Out-of-scope only" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let matterQuery = supabase
    .from("time_entries")
    .select("matter_id, matters(id, matter_number, matter_name)")
    .order("work_date", { ascending: false });
  if (profile.role !== "managing_partner") {
    matterQuery = matterQuery.eq("employee_id", profile.id);
  }
  const { data: matterSource } = await matterQuery;
  const matterOptionsMap = new Map<
    string,
    { id: string; matter_number: string; matter_name: string }
  >();
  for (const row of matterSource || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (row as any).matters;
    const matter = Array.isArray(m) ? m[0] : m;
    if (matter?.id && !matterOptionsMap.has(matter.id)) {
      matterOptionsMap.set(matter.id, {
        id: matter.id,
        matter_number: matter.matter_number,
        matter_name: matter.matter_name,
      });
    }
  }
  const matterOptions = [...matterOptionsMap.values()].sort((a, b) =>
    a.matter_number.localeCompare(b.matter_number)
  );

  return (
    <>
      <PageHeader
        title="My Time"
        description={
          filterNote
            ? `Filtered view — ${filterNote}`
            : "Your time entries by matter, date, billing activity, and approval status."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              Back to dashboard
            </Link>
            <Link href="/time/new" className="btn btn-primary btn-sm">
              Enter Time
            </Link>
          </div>
        }
      />

      <form className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Search</span>
            <input
              name="q"
              defaultValue={params.q || ""}
              className="input input-bordered"
              placeholder="Code or description"
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Matter</span>
            <select name="matter" defaultValue={params.matter || ""} className="select select-bordered">
              <option value="">All matters</option>
              {matterOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.matter_number} · {m.matter_name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Activity</span>
            <select
              name="activity"
              defaultValue={params.activity || ""}
              className="select select-bordered"
            >
              <option value="">All activities</option>
              {BILLING_ACTIVITIES.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Status</span>
            <select name="status" defaultValue={params.status || ""} className="select select-bordered">
              <option value="">All statuses</option>
              {["Draft", "Submitted", "Approved", "Rejected"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Billable</span>
            <select
              name="billable"
              defaultValue={params.billable || ""}
              className="select select-bordered"
            >
              <option value="">All billable</option>
              {["Billable", "Nonbillable", "No Charge"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">From date</span>
            <input
              name="from"
              type="date"
              defaultValue={params.from || ""}
              className="input input-bordered"
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Out of scope</span>
            <select name="oos" defaultValue={params.oos || ""} className="select select-bordered">
              <option value="">All entries</option>
              <option value="1">Out-of-scope only</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="submit">
              Filter
            </button>
          </div>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No time entries match your filters."
          action={
            <Link href="/time" className="btn btn-ghost btn-sm">
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
                  <th>Billing code</th>
                  <th>Hours</th>
                  <th>Billable amt</th>
                  <th>Status</th>
                  <th>Invoice</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const canFix =
                    !r.locked_status &&
                    (r.approval_status === "Draft" || r.approval_status === "Rejected") &&
                    (profile.role === "managing_partner" || r.employee_id === profile.id);
                  return (
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
                        {formatCurrency(
                          calcBillableAmount(Number(r.hours), Number(r.billing_rate), r.billable_status)
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.approval_status} />
                        {r.out_of_scope && (
                          <div className="mt-1">
                            <span className="badge badge-warning badge-sm">Out of scope</span>
                          </div>
                        )}
                        {r.rejection_reason && (
                          <div className="text-xs text-error mt-1 max-w-[12rem]">{r.rejection_reason}</div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={r.invoice_status} />
                      </td>
                      <td className="text-sm max-w-xs">
                        <div className="truncate">{r.billing_description || "—"}</div>
                        {r.out_of_scope && r.out_of_scope_reason && (
                          <div className="text-xs opacity-70 mt-1 line-clamp-2">
                            Ad hoc: {r.out_of_scope_reason}
                          </div>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {canFix ? (
                          <Link href={`/time/new?edit=${r.id}`} className="btn btn-ghost btn-xs">
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
