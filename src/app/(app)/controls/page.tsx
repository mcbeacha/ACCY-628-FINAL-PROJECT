/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireUser } from "@/lib/auth";
import { canViewControls } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { loadAnalyticsData } from "@/lib/analytics-data";
import { n } from "@/lib/analytics";
import { formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";
import { redirect } from "next/navigation";

type ControlRow = {
  risk: "High" | "Medium" | "Low";
  record: string;
  href?: string;
  user: string;
  date: string;
  status: string;
  followUp: string;
};

export default async function ControlsPage() {
  const { profile, supabase } = await requireUser();
  if (!canViewControls(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const pmap = new Map<string, string>(
    raw.profiles.map((p: any) => [String(p.id), String(p.full_name || "—")])
  );
  const rows: ControlRow[] = [];

  // Self-approved invoices (created_by == approved_by) high value
  for (const inv of raw.invoices) {
    if (inv.created_by && inv.approved_by && inv.created_by === inv.approved_by && n(inv.invoice_total) >= 1000) {
      rows.push({
        risk: "High",
        record: `Self-approved invoice ${inv.invoice_number} (${formatCurrency(n(inv.invoice_total))})`,
        href: `/invoices/${inv.id}`,
        user: pmap.get(inv.approved_by) || "—",
        date: inv.approved_at || inv.created_at,
        status: inv.invoice_status,
        followUp: "Confirm secondary review for high-value self-approval",
      });
    }
  }

  // High-value write-downs
  const { data: adjs } = await supabase.from("billing_adjustments").select("*").limit(100);
  for (const a of adjs || []) {
    if (n(a.adjustment_amount) >= 500) {
      rows.push({
        risk: n(a.adjustment_amount) >= 1000 ? "High" : "Medium",
        record: `Write-down ${formatCurrency(n(a.adjustment_amount))} (${a.adjustment_type})`,
        href: a.invoice_id ? `/invoices/${a.invoice_id}` : undefined,
        user: pmap.get(a.approved_by || a.requested_by) || "—",
        date: a.approved_at || a.created_at,
        status: a.approval_status,
        followUp: "Validate write-down reason and authority",
      });
    }
  }

  for (const w of raw.writeOffs) {
    if (n(w.amount) >= 250) {
      rows.push({
        risk: "High",
        record: `Write-off ${formatCurrency(n(w.amount))}`,
        href: `/invoices/${w.invoice_id}`,
        user: pmap.get(w.approved_by || w.requested_by) || "—",
        date: w.approved_at || w.created_at,
        status: w.approval_status,
        followUp: w.approval_status === "Approved" ? "Logged — no re-open without reverse" : "Pending partner approval",
      });
    }
  }

  // Payment reversals
  for (const p of raw.payments) {
    if (p.payment_status === "Reversed" || p.reversal_of) {
      rows.push({
        risk: "Medium",
        record: `Payment reversal ${p.payment_number}`,
        href: "/payments",
        user: pmap.get(p.entered_by) || "—",
        date: p.created_at,
        status: p.payment_status,
        followUp: p.reverse_reason || "Ensure reason documented",
      });
    }
  }

  // Canceled invoices
  for (const inv of raw.invoices) {
    if (inv.invoice_status === "Canceled") {
      rows.push({
        risk: "Medium",
        record: `Canceled invoice ${inv.invoice_number}`,
        href: `/invoices/${inv.id}`,
        user: pmap.get(inv.created_by) || "—",
        date: inv.updated_at || inv.created_at,
        status: "Canceled",
        followUp: "Confirm source time not double-billed elsewhere",
      });
    }
  }

  // Missing approval on finalized
  for (const inv of raw.invoices) {
    if (inv.finalized_at && !inv.approved_by && !inv.approved_at) {
      rows.push({
        risk: "High",
        record: `Finalized without approver ${inv.invoice_number}`,
        href: `/invoices/${inv.id}`,
        user: pmap.get(inv.finalized_by) || "—",
        date: inv.finalized_at,
        status: inv.invoice_status,
        followUp: "Review segregation of duties",
      });
    }
  }

  // Billed entries still not locked
  for (const t of raw.time) {
    if (t.invoice_status === "Billed" && t.locked_status === false) {
      rows.push({
        risk: "High",
        record: `Billed time not locked (${t.work_date})`,
        href: "/time/review",
        user: pmap.get(t.employee_id) || "—",
        date: t.approved_at || t.created_at,
        status: "Lock gap",
        followUp: "Re-run finalize or lock entry",
      });
    }
  }

  // Rate cards (recent) from financial activity
  for (const a of raw.financialActivity) {
    if (
      ["rate_change", "retainer_adjustment", "invoice_canceled", "payment_reversed", "writeoff_approved"].some(
        (k) => (a.action_type || "").includes(k.replace("_", "")) || a.action_type === k
      ) ||
      ["payment_reversed", "retainer_applied", "writeoff_approved", "invoice_finalized"].includes(a.action_type)
    ) {
      // keep significant only
    }
    if (["payment_reversed", "writeoff_approved"].includes(a.action_type)) {
      rows.push({
        risk: a.action_type === "writeoff_approved" ? "High" : "Medium",
        record: a.action_description || a.action_type,
        href: a.matter_id ? `/matters/${a.matter_id}` : undefined,
        user: pmap.get(a.performed_by) || "—",
        date: a.created_at,
        status: "Logged",
        followUp: "Retain in append-only history",
      });
    }
  }

  // Matters Needs Review after term style activity
  for (const m of raw.matterRows) {
    if (m.approval_status === "Needs Review" || m.matter_status === "Needs Review") {
      rows.push({
        risk: "Medium",
        record: `Matter ${m.matter_number} needs re-approval after term change`,
        href: `/matters/${m.id}`,
        user: pmap.get(m.created_by) || "—",
        date: m.updated_at || m.created_at,
        status: m.approval_status,
        followUp: "Partner re-approval required before full billing use",
      });
    }
  }

  // Deduplicate roughly
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = r.record + r.date;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <>
      <PageHeader
        title="Control Monitoring"
        description="Exception list for segregation of duties, high-value adjustments, reversals, and lock gaps."
      />
      <p className="text-sm opacity-70">
        Failed sign-in attempt telemetry is not stored in app tables; monitor via Supabase Auth logs. Generated{" "}
        {new Date().toLocaleString()}.
      </p>
      {unique.length === 0 ? (
        <EmptyState title="No control exceptions flagged from current data." />
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Record</th>
                  <th>User</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {unique.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className={`badge badge-sm ${
                          r.risk === "High" ? "badge-error" : r.risk === "Medium" ? "badge-warning" : "badge-ghost"
                        }`}
                      >
                        {r.risk}
                      </span>
                    </td>
                    <td className="text-sm max-w-xs">
                      {r.href ? (
                        <Link href={r.href} className="link link-hover">
                          {r.record}
                        </Link>
                      ) : (
                        r.record
                      )}
                    </td>
                    <td className="text-sm">{r.user}</td>
                    <td className="text-xs">{formatDate(r.date)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-xs max-w-xs">{r.followUp}</td>
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
