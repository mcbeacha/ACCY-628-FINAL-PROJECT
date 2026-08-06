import { requireUser } from "@/lib/auth";
import { canViewJournal } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, clientDisplayName } from "@/lib/format";
import {
  buildMatterRecognitionRows,
  discoverFeeRevenueAccounts,
  requiresReviewCount,
  type InvoiceLineRow,
  type InvoiceRow,
  type JournalEntryRow,
  type JournalLineRow,
  type MatterInput,
  type MatterRecognitionRow,
  type PaymentRow,
  type RetainerAccountRow,
  type RetainerTxnRow,
  type TimeEntryRow,
  type BillingAdjustmentRow,
  type WriteOffRow,
  type MatterTaskRow,
} from "@/lib/revenue-recognition";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RevenueRecognitionFilters } from "./RevenueRecognitionFilters";
import { MatterReviewDrawer } from "./MatterReviewDrawer";

function keepFilterParams(
  sp: Record<string, string | undefined>,
  extra: Record<string, string>
) {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "matter", "method", "status"] as const) {
    if (sp[key]) params.set(key, sp[key]!);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  const qs = params.toString();
  return qs ? `/revenue-recognition?${qs}` : "/revenue-recognition";
}

function reviewAmountDisplay(row: MatterRecognitionRow): string {
  if (row.recognitionStatus === "Deferred") return "—";
  if (row.reviewAmount == null) return "—";
  return formatCurrency(row.reviewAmount);
}

export default async function RevenueRecognitionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewJournal(profile.role)) redirect("/dashboard");

  const [
    { data: mattersData },
    { data: invoicesData },
    { data: invoiceLinesData },
    { data: timeData },
    { data: retainerAccountsData },
    { data: retainerTxnsData },
    { data: paymentsData },
    { data: journalEntriesData },
    { data: journalLinesData },
    { data: tasksData },
    { data: adjustmentsData },
    { data: writeOffsData },
  ] = await Promise.all([
    supabase
      .from("matters")
      .select(
        "id, matter_number, matter_name, matter_description, billing_method, hourly_rate, fixed_fee_amount, contingency_percentage, estimated_matter_value, approval_status, scope_summary, clients(organization_name, first_name, last_name, client_type, client_number), responsible:profiles!matters_responsible_attorney_id_fkey(full_name)"
      )
      .order("matter_number"),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, matter_id, invoice_status, invoice_total, payments_applied, retainer_applied, expense_total, write_down_total, balance_due, dispute_status, finalized_at"
      ),
    supabase
      .from("invoice_lines")
      .select("id, invoice_id, matter_id, line_type, final_amount"),
    supabase
      .from("time_entries")
      .select(
        "id, matter_id, hours, billing_rate, billable_status, approval_status, invoice_status, work_date"
      ),
    supabase
      .from("retainer_accounts")
      .select("id, matter_id, current_balance, account_status"),
    supabase
      .from("retainer_transactions")
      .select(
        "id, retainer_account_id, matter_id, transaction_type, amount, approval_status, related_invoice_id"
      ),
    supabase
      .from("payments")
      .select("id, payment_number, matter_id, payment_status, total_amount, payment_date"),
    supabase
      .from("journal_entries")
      .select("id, journal_entry_number, entry_date, source_type, posting_status, description")
      .order("entry_date", { ascending: false })
      .limit(500),
    supabase
      .from("journal_entry_lines")
      .select(
        "id, journal_entry_id, account_code, account_name, debit_amount, credit_amount, matter_id, client_id"
      ),
    supabase.from("matter_tasks").select("id, matter_id, title, status, client_visible"),
    supabase
      .from("billing_adjustments")
      .select("id, matter_id, invoice_id, adjustment_type, adjustment_amount, approval_status"),
    supabase
      .from("write_offs")
      .select("id, matter_id, invoice_id, amount, approval_status"),
  ]);

  const matters = (mattersData || []) as MatterInput[];
  const invoices = (invoicesData || []) as InvoiceRow[];
  const invoiceLines = (invoiceLinesData || []) as InvoiceLineRow[];
  const timeEntries = (timeData || []) as TimeEntryRow[];
  const retainerAccounts = (retainerAccountsData || []) as RetainerAccountRow[];
  const retainerTxns = (retainerTxnsData || []) as RetainerTxnRow[];
  const payments = (paymentsData || []) as PaymentRow[];
  const journalEntries = (journalEntriesData || []) as JournalEntryRow[];
  const journalLines = (journalLinesData || []) as JournalLineRow[];
  const matterTasks = (tasksData || []) as MatterTaskRow[];
  const adjustments = (adjustmentsData || []) as BillingAdjustmentRow[];
  const writeOffs = (writeOffsData || []) as WriteOffRow[];

  const feeAccounts = discoverFeeRevenueAccounts(journalEntries, journalLines);
  const mappingNeedsReview = feeAccounts.length === 0;

  const allRows = buildMatterRecognitionRows({
    matters,
    invoices,
    invoiceLines,
    timeEntries,
    retainerAccounts,
    retainerTxns,
    payments,
    journalEntries,
    journalLines,
    matterTasks,
    adjustments,
    writeOffs,
    feeAccounts,
    dateFrom: sp.from,
    dateTo: sp.to,
  });

  let rows = allRows;
  if (sp.matter) rows = rows.filter((r) => r.matterId === sp.matter);
  if (sp.method) rows = rows.filter((r) => r.billingMethod === sp.method);
  if (sp.status) rows = rows.filter((r) => r.recognitionStatus === sp.status);

  const sumReported = rows.reduce((s, r) => s + r.reportedRecognizedRevenue, 0);
  const sumEarned = rows.reduce(
    (s, r) => s + (r.earnedButNotBilled != null ? r.earnedButNotBilled : 0),
    0
  );
  const sumTrust = rows.reduce((s, r) => s + r.unearnedOrTrust, 0);
  const reviewItems = requiresReviewCount(rows);

  const detailId = sp.review;
  const detail: MatterRecognitionRow | undefined = detailId
    ? allRows.find((r) => r.matterId === detailId)
    : undefined;

  const matterOptions = matters.map((m) => ({
    id: m.id,
    label: `${m.matter_number} — ${clientDisplayName(m.clients)} / ${m.matter_name}`,
  }));

  const recognizedHint = mappingNeedsReview
    ? "Revenue account mapping needs review."
    : sumReported === 0
      ? "No posted fee revenue this period."
      : "Posted legal-fee revenue this period";

  return (
    <>
      <PageHeader
        title="Revenue Recognition"
        description="Monitor recognized fees, unbilled work, client funds, and matters requiring accounting review."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Recognized This Period"
          value={formatCurrency(mappingNeedsReview ? 0 : sumReported)}
          hint={recognizedHint}
          tone={mappingNeedsReview ? "warning" : "default"}
        />
        <StatCard
          label="Unbilled Earned Fees"
          value={formatCurrency(sumEarned)}
          hint="Approved hourly work not yet invoiced"
        />
        <StatCard
          label="Client Funds Held"
          value={formatCurrency(sumTrust)}
          hint="Client funds — not revenue"
        />
        <StatCard
          label="Items Requiring Review"
          value={reviewItems}
          hint={
            reviewItems
              ? "Missing support or unresolved recognition questions"
              : "No matters need review"
          }
          tone={reviewItems ? "warning" : "default"}
        />
      </div>

      <div className="mt-4">
        <RevenueRecognitionFilters
          from={sp.from}
          to={sp.to}
          matter={sp.matter}
          method={sp.method}
          status={sp.status}
          review={sp.review}
          matters={matterOptions}
          resultCount={rows.length}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No matters match the selected filters." />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-base-300 bg-base-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-base-200 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Matter Recognition Review</h2>
            <span className="text-xs opacity-55 tabular-nums">{rows.length} matters</span>
          </div>

          {/* Mobile stacked cards */}
          <div className="md:hidden divide-y divide-base-200">
            {rows.map((r) => (
              <div key={r.matterId} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{r.matterNumber}</p>
                    <p className="text-sm opacity-70">{r.clientName}</p>
                    <p className="text-xs opacity-55">{r.billingMethod}</p>
                  </div>
                  <span className="whitespace-nowrap shrink-0">
                    <StatusBadge status={r.recognitionStatus} />
                  </span>
                </div>
                <p className="text-sm">{r.accountingPosition}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm tabular-nums font-medium">
                    {reviewAmountDisplay(r)}
                  </span>
                  <Link
                    href={keepFilterParams(sp, { review: r.matterId })}
                    className="btn btn-xs btn-primary"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table — six columns */}
          <div className="hidden md:block overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="text-xs">
                  <th className="w-[7rem]">Matter</th>
                  <th>Client</th>
                  <th className="w-[8.5rem]">Fee Arrangement</th>
                  <th>Current Accounting Position</th>
                  <th className="text-right w-[7rem]">Review Amount</th>
                  <th className="w-[11rem]">Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.matterId} className="hover">
                    <td className="font-medium whitespace-nowrap">{r.matterNumber}</td>
                    <td className="text-sm max-w-[10rem] truncate" title={r.clientName}>
                      {r.clientName}
                    </td>
                    <td className="text-sm whitespace-nowrap">{r.billingMethod}</td>
                    <td className="text-sm">{r.accountingPosition}</td>
                    <td className="text-sm text-right tabular-nums font-medium whitespace-nowrap">
                      {reviewAmountDisplay(r)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2 flex-nowrap">
                        <span className="whitespace-nowrap shrink-0">
                          <StatusBadge status={r.recognitionStatus} />
                        </span>
                        <Link
                          href={keepFilterParams(sp, { review: r.matterId })}
                          className="btn btn-xs btn-primary shrink-0"
                        >
                          Review
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs opacity-60 max-w-3xl">
        Revenue is reviewed separately from billing and collections to prevent premature or
        duplicate recognition.
      </p>

      {detail && <MatterReviewDrawer detail={detail} />}
    </>
  );
}
