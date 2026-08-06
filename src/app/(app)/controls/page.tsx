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
  const matterStartById = new Map<string, string>();
  for (const m of raw.matterRows) {
    if (m.id && m.engagement_start_date) {
      matterStartById.set(String(m.id), String(m.engagement_start_date).slice(0, 10));
    }
  }
  const linesByInvoice = new Map<string, any[]>();
  for (const line of raw.invoiceLines || []) {
    const invId = String(line.invoice_id || "");
    if (!invId) continue;
    const list = linesByInvoice.get(invId) || [];
    list.push(line);
    linesByInvoice.set(invId, list);
  }
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

  // Duplicate invoice numbers (unique numbering control)
  {
    const byNumber = new Map<string, typeof raw.invoices>();
    for (const inv of raw.invoices) {
      const key = String(inv.invoice_number || "")
        .trim()
        .toUpperCase();
      if (!key) continue;
      const list = byNumber.get(key) || [];
      list.push(inv);
      byNumber.set(key, list);
    }
    for (const [, list] of byNumber) {
      if (list.length < 2) continue;
      const first = list[0];
      rows.push({
        risk: "High",
        record: `Duplicate invoice number ${first.invoice_number} (${list.length} invoices)`,
        href: `/invoices/${first.id}`,
        user: pmap.get(first.created_by) || "—",
        date: first.created_at,
        status: "Control fail",
        followUp: "Stop billing on duplicate numbers; void/cancel extras and keep one authoritative invoice",
      });
    }
  }

  // Invoice date before matter engagement start and/or billed service dates
  for (const inv of raw.invoices) {
    const invoiceDate = inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : "";
    if (!invoiceDate) continue;

    const engagementStart = inv.matter_id ? matterStartById.get(String(inv.matter_id)) : undefined;
    const beforeMatterStart = !!engagementStart && invoiceDate < engagementStart;

    let earliestServiceAfterInvoice: string | null = null;
    for (const line of linesByInvoice.get(String(inv.id)) || []) {
      const serviceDate = line.service_date ? String(line.service_date).slice(0, 10) : "";
      if (!serviceDate || invoiceDate >= serviceDate) continue;
      if (!earliestServiceAfterInvoice || serviceDate < earliestServiceAfterInvoice) {
        earliestServiceAfterInvoice = serviceDate;
      }
    }
    const beforeServiceWork = !!earliestServiceAfterInvoice;

    if (!beforeMatterStart && !beforeServiceWork) continue;

    const predates: string[] = [];
    if (beforeMatterStart) predates.push("matter start");
    if (beforeServiceWork) predates.push("billed work");

    const followBits: string[] = [`Invoice ${formatDate(invoiceDate)}`];
    if (beforeMatterStart && engagementStart) {
      followBits.push(`predates engagement start ${formatDate(engagementStart)}`);
    }
    if (beforeServiceWork && earliestServiceAfterInvoice) {
      followBits.push(`predates service date ${formatDate(earliestServiceAfterInvoice)}`);
    }

    rows.push({
      risk: "High",
      record: `Invoice date predates ${predates.join(" / ")} — ${inv.invoice_number}`,
      href: `/invoices/${inv.id}`,
      user: pmap.get(inv.created_by) || "—",
      date: invoiceDate,
      status: "Control fail",
      followUp: `${followBits.join("; ")}. Confirm billing period and matter open date.`,
    });
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

  // Case-type approval matrix: Contingency / PI invoice approved by non-MP
  {
    type MatterRow = {
      id?: string;
      billing_method?: string | null;
      practice_area?: string | null;
    };
    const matterById = new Map<string, MatterRow>(
      (raw.matterRows || []).map((m: MatterRow) => [String(m.id), m])
    );
    const roleById = new Map(
      raw.profiles.map((p: any) => [String(p.id), String(p.role || "")])
    );
    for (const inv of raw.invoices) {
      if (inv.approval_status !== "Approved" || !inv.approved_by) continue;
      const matter = matterById.get(String(inv.matter_id));
      if (!matter) continue;
      const elevated =
        matter.billing_method === "Contingency" ||
        matter.practice_area === "Personal Injury";
      if (!elevated) continue;
      const approverRole = roleById.get(String(inv.approved_by));
      if (approverRole && approverRole !== "managing_partner") {
        rows.push({
          risk: "High",
          record: `Contingency / PI invoice ${inv.invoice_number} approved by non-partner`,
          href: `/invoices/${inv.id}`,
          user: pmap.get(inv.approved_by) || "—",
          date: inv.approved_at || inv.created_at,
          status: inv.invoice_status,
          followUp:
            "Policy requires Managing Partner approval for Contingency and Personal Injury invoices",
        });
      }
    }

    // Routine hourly invoice under $5k still waiting on MP (matrix not clearing workload)
    for (const inv of raw.invoices) {
      if (inv.approval_status !== "Submitted") continue;
      const matter = matterById.get(String(inv.matter_id));
      if (!matter) continue;
      const elevated =
        matter.billing_method === "Contingency" ||
        matter.practice_area === "Personal Injury";
      const total = n(inv.invoice_total ?? inv.total_amount);
      if (elevated || total >= 5000) continue;
      if (
        matter.billing_method === "Hourly" ||
        matter.billing_method === "Fixed Fee" ||
        matter.billing_method === "Retainer-Funded Hourly"
      ) {
        rows.push({
          risk: "Medium",
          record: `Routine ${matter.billing_method} invoice ${inv.invoice_number} (${formatCurrency(total)}) still submitted — billing should clear under matrix`,
          href: `/invoices/${inv.id}`,
          user: pmap.get(inv.created_by) || "—",
          date: inv.created_at,
          status: "Submitted",
          followUp:
            "Confirm Billing Staff can approve under $5k routine invoices so Managing Partner is not the bottleneck",
        });
      }
    }
  }

  // Out-of-scope time awaiting attorney authorization (unauthorized work control)
  for (const t of raw.time) {
    if (t.out_of_scope && t.approval_status === "Submitted") {
      rows.push({
        risk: "High",
        record: `Out-of-scope time awaiting attorney approval (${t.hours} hrs · ${t.work_date})`,
        href: "/time/review",
        user: pmap.get(t.employee_id) || "—",
        date: t.created_at || t.work_date,
        status: "Submitted",
        followUp: t.out_of_scope_reason
          ? `Authorize or reject before billing — ${t.out_of_scope_reason}`
          : "Authorize or reject additional work before billing",
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
        description="Exception list for segregation of duties, invoice date ordering (before matter start or billed work), duplicate invoice numbers, high-value adjustments, reversals, and lock gaps."
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
