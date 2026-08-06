import { requireUser } from "@/lib/auth";
import { canViewAR, arAgingBucket } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import { InteractiveTableRow } from "@/components/InteractiveTableRow";
import { formatCurrency, formatDate, clientDisplayName } from "@/lib/format";
import type { Invoice } from "@/lib/billing-types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ARPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewAR(profile.role)) redirect("/dashboard");

  const [{ data: invoices }, { data: payments }, { data: writeOffs }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, matters(matter_number, matter_name, practice_area, responsible_attorney_id, responsible:profiles!matters_responsible_attorney_id_fkey(full_name)), clients(organization_name, first_name, last_name, client_number, client_type, primary_contact_name)"
      )
      .not("finalized_at", "is", null)
      .order("due_date"),
    supabase
      .from("payments")
      .select("id, unapplied_amount, payment_status, total_amount")
      .eq("payment_status", "Posted")
      .gt("unapplied_amount", 0),
    supabase.from("write_offs").select("amount, approval_status"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (invoices || []) as any[];

  if (sp.client) rows = rows.filter((r) => r.client_id === sp.client);
  if (sp.matter) rows = rows.filter((r) => r.matter_id === sp.matter);
  if (sp.status) rows = rows.filter((r) => r.invoice_status === sp.status);
  if (sp.practice) rows = rows.filter((r) => r.matters?.practice_area === sp.practice);
  if (sp.attorney) rows = rows.filter((r) => r.matters?.responsible_attorney_id === sp.attorney);

  const withBucket = rows.map((r) => ({
    ...r,
    bucket: arAgingBucket(r.due_date, Number(r.balance_due), r.invoice_status),
  }));

  const PAST_DUE_BUCKETS = new Set(["1–30", "31–60", "61–90", "90+"]);
  const pastDueFilter = sp.bucket === "past_due";

  const filtered = pastDueFilter
    ? withBucket.filter((r) => PAST_DUE_BUCKETS.has(r.bucket))
    : sp.bucket
      ? withBucket.filter((r) => r.bucket === sp.bucket)
      : withBucket;

  const open = withBucket.filter((r) => Number(r.balance_due) > 0 && !["Written Off", "Canceled", "Paid"].includes(r.invoice_status));
  const sumBal = (list: typeof withBucket) =>
    list.reduce((s, r) => s + Math.max(0, Number(r.balance_due)), 0);

  const totalAR = sumBal(open);
  const current = sumBal(open.filter((r) => r.bucket === "Current"));
  const b1 = sumBal(open.filter((r) => r.bucket === "1–30"));
  const b2 = sumBal(open.filter((r) => r.bucket === "31–60"));
  const b3 = sumBal(open.filter((r) => r.bucket === "61–90"));
  const b4 = sumBal(open.filter((r) => r.bucket === "90+"));
  const pastDueTotal = b1 + b2 + b3 + b4;
  const partial = open.filter((r) => r.invoice_status === "Partially Paid").length;
  const disputed = open.filter((r) => r.invoice_status === "Disputed" || r.dispute_status === "Raised").length;
  const writtenOffAmt = ((writeOffs || []) as { amount: number; approval_status: string }[])
    .filter((w) => w.approval_status === "Approved")
    .reduce((s, w) => s + Number(w.amount), 0);
  const unapplied = ((payments || []) as { unapplied_amount: number }[]).reduce(
    (s, p) => s + Number(p.unapplied_amount),
    0
  );

  const practiceAreas = [
    ...new Set(rows.map((r) => r.matters?.practice_area).filter(Boolean)),
  ] as string[];

  const activeFilterCount = [sp.status, sp.bucket, sp.practice].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Accounts Receivable"
        description="Outstanding balances, AR aging by due date, disputed and written-off invoices."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Past-due AR"
          value={formatCurrency(pastDueTotal)}
          tone={pastDueTotal ? "error" : "default"}
          href="/ar?bucket=past_due"
        />
        <StatCard label="Total outstanding AR" value={formatCurrency(totalAR)} href="/ar" />
        <StatCard label="Current" value={formatCurrency(current)} href="/ar?bucket=Current" />
        <StatCard label="1–30 past due" value={formatCurrency(b1)} tone={b1 ? "warning" : "default"} href="/ar?bucket=1–30" />
        <StatCard label="31–60 past due" value={formatCurrency(b2)} tone={b2 ? "warning" : "default"} href="/ar?bucket=31–60" />
        <StatCard label="61–90 past due" value={formatCurrency(b3)} tone={b3 ? "error" : "default"} href="/ar?bucket=61–90" />
        <StatCard label="90+ past due" value={formatCurrency(b4)} tone={b4 ? "error" : "default"} href="/ar?bucket=90+" />
        <StatCard label="Partially paid (open)" value={partial} />
        <StatCard label="Disputed (open)" value={disputed} tone={disputed ? "warning" : "default"} />
        <StatCard label="Approved write-offs" value={formatCurrency(writtenOffAmt)} />
        <StatCard label="Unapplied payments" value={formatCurrency(unapplied)} />
      </div>

      <form>
        <FilterToolbar
          actions={
            <>
              <button type="submit" className="btn btn-sm btn-primary">
                Apply
              </button>
              <Link href="/ar" className="btn btn-sm btn-ghost">
                Clear
              </Link>
            </>
          }
          hint={
            activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active · ${filtered.length} shown`
              : undefined
          }
        >
          <FilterField label="Status" className="w-full sm:w-40">
            <select name="status" className="select select-bordered select-sm" defaultValue={sp.status || ""}>
              <option value="">All</option>
              {["Finalized", "Partially Paid", "Past Due", "Disputed", "Paid", "Written Off"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Aging" className="w-full sm:w-36">
            <select name="bucket" className="select select-bordered select-sm" defaultValue={sp.bucket || ""}>
              <option value="">All</option>
              <option value="past_due">All past due</option>
              {["Current", "1–30", "31–60", "61–90", "90+"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Practice" className="w-full sm:w-44">
            <select name="practice" className="select select-bordered select-sm" defaultValue={sp.practice || ""}>
              <option value="">All</option>
              {practiceAreas.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterToolbar>
      </form>

      {filtered.length === 0 ? (
        <EmptyState title="No invoices match these filters." />
      ) : (
        <div className="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-base-200 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Open &amp; finalized invoices</h2>
            <span className="text-xs opacity-55 tabular-nums">{filtered.length} rows</span>
          </div>
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr className="text-xs">
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Matter</th>
                  <th>Attorney</th>
                  <th>Due</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Balance</th>
                  <th>Aging</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <InteractiveTableRow key={r.id} href={`/invoices/${r.id}`}>
                    <td>
                      <Link href={`/invoices/${r.id}`} className="link link-hover font-medium">
                        {(r as Invoice).invoice_number}
                      </Link>
                    </td>
                    <td className="text-sm">{clientDisplayName(r.clients)}</td>
                    <td className="text-sm">{r.matters?.matter_number}</td>
                    <td className="text-sm">{r.matters?.responsible?.full_name || "—"}</td>
                    <td className="text-sm whitespace-nowrap">{formatDate(r.due_date)}</td>
                    <td className="text-sm text-right tabular-nums">
                      {formatCurrency(Number(r.invoice_total))}
                    </td>
                    <td className="text-sm text-right font-semibold tabular-nums">
                      {formatCurrency(Number(r.balance_due))}
                    </td>
                    <td className="text-sm whitespace-nowrap">{r.bucket}</td>
                    <td>
                      <StatusBadge status={r.invoice_status} />
                    </td>
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
