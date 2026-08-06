import { requireUser } from "@/lib/auth";
import { canCreateMatters } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { InteractiveTableRow } from "@/components/InteractiveTableRow";
import { clientDisplayName, formatDate } from "@/lib/format";
import {
  BILLING_METHODS,
  MATTER_STATUSES,
  PRACTICE_AREAS,
} from "@/lib/constants";
import { displayMatterStatus } from "@/lib/matter-status";
import type { Client, Matter, Profile } from "@/lib/types";
import Link from "next/link";

export default async function MattersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    practice?: string;
    billing?: string;
    attorney?: string;
  }>;
}) {
  const { profile, supabase } = await requireUser();
  const params = await searchParams;

  let query = supabase
    .from("matters")
    .select("*, clients(*), responsible:profiles!matters_responsible_attorney_id_fkey(full_name)")
    .order("updated_at", { ascending: false });

  if (params.status) query = query.eq("matter_status", params.status);
  if (params.practice) query = query.eq("practice_area", params.practice);
  if (params.billing) query = query.eq("billing_method", params.billing);
  if (params.attorney) query = query.eq("responsible_attorney_id", params.attorney);

  // Finance staff should see the same matters that power invoices/AR/retainers/trust.
  // If a nested profile embed fails under RLS, fall back to a simpler select so matters
  // like MT-05002 still appear for billing_staff.
  let { data, error } = await query;
  if (error && (profile.role === "billing_staff" || profile.role === "managing_partner")) {
    let fallback = supabase
      .from("matters")
      .select("*, clients(*)")
      .order("updated_at", { ascending: false });
    if (params.status) fallback = fallback.eq("matter_status", params.status);
    if (params.practice) fallback = fallback.eq("practice_area", params.practice);
    if (params.billing) fallback = fallback.eq("billing_method", params.billing);
    if (params.attorney) fallback = fallback.eq("responsible_attorney_id", params.attorney);
    const retry = await fallback;
    data = retry.data;
    error = retry.error;
  }

  let matters = (data || []) as Matter[];
  if (error) {
    console.error("Matters list query failed:", error.message);
  }

  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    matters = matters.filter((m) => {
      const clientName = clientDisplayName(m.clients as Client);
      return [m.matter_number, m.matter_name, clientName, m.practice_area]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  const { data: attorneys } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["attorney", "managing_partner"])
    .eq("active_status", true);

  const title =
    profile.role === "client"
      ? "My Matters"
      : profile.role === "attorney" || profile.role === "paralegal"
        ? "My Matters"
        : "Matters";

  return (
    <>
      <PageHeader
        title={title}
        description={
          profile.role === "client"
            ? "Matters connected to your client profile."
            : "Legal matters and engagement files available to your role."
        }
        actions={
          canCreateMatters(profile.role) ? (
            <Link href="/matters/new" className="btn btn-primary btn-sm">
              New matter
            </Link>
          ) : null
        }
      />

      {profile.role !== "client" && (
        <form className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body py-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="form-control">
              <span className="label-text font-semibold text-sm">Search</span>
              <input name="q" defaultValue={params.q || ""} className="input input-bordered" placeholder="Matter, client..." />
            </label>
            <label className="form-control">
              <span className="label-text font-semibold text-sm">Status</span>
              <select name="status" defaultValue={params.status || ""} className="select select-bordered">
                <option value="">All</option>
                {MATTER_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text font-semibold text-sm">Practice area</span>
              <select name="practice" defaultValue={params.practice || ""} className="select select-bordered">
                <option value="">All</option>
                {PRACTICE_AREAS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text font-semibold text-sm">Billing method</span>
              <select name="billing" defaultValue={params.billing || ""} className="select select-bordered">
                <option value="">All</option>
                {BILLING_METHODS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text font-semibold text-sm">Responsible attorney</span>
              <select name="attorney" defaultValue={params.attorney || ""} className="select select-bordered">
                <option value="">All</option>
                {((attorneys || []) as Profile[]).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-5">
              <button className="btn btn-primary btn-sm" type="submit">
                Apply filters
              </button>
            </div>
          </div>
        </form>
      )}

      {matters.length === 0 ? (
        <EmptyState
          title={
            profile.role === "client" || profile.role === "attorney" || profile.role === "paralegal"
              ? "You do not currently have any assigned matters."
              : "No matters match your current filters."
          }
        />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Matter #</th>
                  <th>Name</th>
                  {profile.role !== "client" && <th>Client</th>}
                  <th>Practice</th>
                  <th>Status</th>
                  {profile.role !== "client" && <th>Billing</th>}
                  <th>Expected end</th>
                </tr>
              </thead>
              <tbody>
                {matters.map((m) => (
                  <InteractiveTableRow key={m.id} href={`/matters/${m.id}`}>
                    <td>
                      <Link href={`/matters/${m.id}`} className="link link-hover font-medium">
                        {m.matter_number}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] truncate">{m.matter_name}</td>
                    {profile.role !== "client" && (
                      <td className="text-sm">{clientDisplayName(m.clients as Client)}</td>
                    )}
                    <td className="text-sm">{m.practice_area}</td>
                    <td>
                      <StatusBadge status={displayMatterStatus(m)} />
                    </td>
                    {profile.role !== "client" && (
                      <td className="text-sm">{m.billing_method || "—"}</td>
                    )}
                    <td className="text-sm">{formatDate(m.expected_end_date)}</td>
                  </InteractiveTableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
