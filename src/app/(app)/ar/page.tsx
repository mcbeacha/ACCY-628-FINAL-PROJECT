import { requireUser } from "@/lib/auth";
import { canViewAR, arAgingBucket } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { FilterField, FilterToolbar } from "@/components/FilterToolbar";
import { InteractiveTableRow } from "@/components/InteractiveTableRow";
import { formatCurrency, formatDate, clientDisplayName } from "@/lib/format";
import type { Invoice } from "@/lib/billing-types";
import {
  PAST_DUE_BUCKETS,
  buildOutstandingByClient,
  reconcileClientOutstanding,
  type ArOpenInvoice,
} from "@/lib/ar-client-summary";
import {
  ArSummaryPanel,
  type ArSummaryCategory,
  type ArSummaryInvoiceItem,
} from "./ArSummaryPanel";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArClientFocus } from "./ArClientFocus";

function arQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const key of ["status", "bucket", "practice", "client", "matter", "attorney", "focus"] as const) {
    if (params[key]) q.set(key, params[key]!);
  }
  const qs = q.toString();
  return qs ? `/ar?${qs}` : "/ar";
}

function toInvoiceItem(r: {
  id: string;
  invoice_number?: string;
  due_date?: string;
  balance_due?: number;
  invoice_status?: string;
  clients?: Parameters<typeof clientDisplayName>[0];
  matters?: { matter_number?: string } | null;
}): ArSummaryInvoiceItem {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number || "—",
    clientLabel: clientDisplayName(r.clients ?? null),
    matterNumber: r.matters?.matter_number || "—",
    dueDate: formatDate(r.due_date || null),
    balanceLabel: formatCurrency(Number(r.balance_due || 0)),
    status: r.invoice_status || "—",
  };
}

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
      .select("id, payment_number, unapplied_amount, payment_status, total_amount")
      .eq("payment_status", "Posted")
      .gt("unapplied_amount", 0),
    supabase
      .from("write_offs")
      .select(
        "amount, approval_status, invoice_id, invoices(id, invoice_number, due_date, balance_due, invoice_status, clients(organization_name, first_name, last_name, client_number, client_type, primary_contact_name), matters(matter_number))"
      )
      .eq("approval_status", "Approved"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allFinalized = (invoices || []) as any[];

  // Shared non-client filters (client filter options stay complete for the scoped set)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scoped = allFinalized as any[];
  if (sp.matter) scoped = scoped.filter((r) => r.matter_id === sp.matter);
  if (sp.status) scoped = scoped.filter((r) => r.invoice_status === sp.status);
  if (sp.practice) scoped = scoped.filter((r) => r.matters?.practice_area === sp.practice);
  if (sp.attorney) scoped = scoped.filter((r) => r.matters?.responsible_attorney_id === sp.attorney);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = scoped as any[];
  if (sp.client) rows = rows.filter((r) => r.client_id === sp.client);

  const withBucket = rows.map((r) => ({
    ...r,
    bucket: arAgingBucket(r.due_date, Number(r.balance_due), r.invoice_status),
  }));

  const pastDueFilter = sp.bucket === "past_due";

  const filtered = pastDueFilter
    ? withBucket.filter((r) => PAST_DUE_BUCKETS.has(r.bucket))
    : sp.bucket
      ? withBucket.filter((r) => r.bucket === sp.bucket)
      : withBucket;

  const open = withBucket.filter(
    (r) =>
      Number(r.balance_due) > 0 &&
      !["Written Off", "Canceled", "Paid"].includes(r.invoice_status)
  );
  const sumBal = (list: typeof withBucket) =>
    list.reduce((s, r) => s + Math.max(0, Number(r.balance_due)), 0);

  const pastDueOpen = open.filter((r) => PAST_DUE_BUCKETS.has(r.bucket));
  const currentOpen = open.filter((r) => r.bucket === "Current");
  const b1Open = open.filter((r) => r.bucket === "1–30");
  const b2Open = open.filter((r) => r.bucket === "31–60");
  const b3Open = open.filter((r) => r.bucket === "61–90");
  const b4Open = open.filter((r) => r.bucket === "90+");
  const partialOpen = open.filter((r) => r.invoice_status === "Partially Paid");
  const disputedOpen = open.filter(
    (r) => r.invoice_status === "Disputed" || r.dispute_status === "Raised"
  );

  const totalAR = sumBal(open);
  const current = sumBal(currentOpen);
  const b1 = sumBal(b1Open);
  const b2 = sumBal(b2Open);
  const b3 = sumBal(b3Open);
  const b4 = sumBal(b4Open);
  const pastDueTotal = b1 + b2 + b3 + b4;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approvedWriteOffs = (writeOffs || []) as any[];
  const writtenOffAmt = approvedWriteOffs.reduce(
    (s, w) => s + Number(w.amount || 0),
    0
  );
  const writeOffInvoiceItems: ArSummaryInvoiceItem[] = [];
  const seenWriteOffInvoices = new Set<string>();
  for (const w of approvedWriteOffs) {
    const inv = w.invoices;
    if (!inv?.id || seenWriteOffInvoices.has(inv.id)) continue;
    seenWriteOffInvoices.add(inv.id);
    writeOffInvoiceItems.push(toInvoiceItem(inv));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unappliedPayments = (payments || []) as any[];
  const unapplied = unappliedPayments.reduce(
    (s, p) => s + Number(p.unapplied_amount),
    0
  );

  const categories: ArSummaryCategory[] = [
    {
      id: "past_due",
      label: "Past-due AR",
      value: formatCurrency(pastDueTotal),
      tone: pastDueTotal ? "error" : "default",
      kind: "invoice",
      items: pastDueOpen.map(toInvoiceItem),
    },
    {
      id: "total",
      label: "Total outstanding AR",
      value: formatCurrency(totalAR),
      kind: "invoice",
      items: open.map(toInvoiceItem),
    },
    {
      id: "current",
      label: "Current",
      value: formatCurrency(current),
      kind: "invoice",
      items: currentOpen.map(toInvoiceItem),
    },
    {
      id: "b1",
      label: "1–30 past due",
      value: formatCurrency(b1),
      tone: b1 ? "warning" : "default",
      kind: "invoice",
      items: b1Open.map(toInvoiceItem),
    },
    {
      id: "b2",
      label: "31–60 past due",
      value: formatCurrency(b2),
      tone: b2 ? "warning" : "default",
      kind: "invoice",
      items: b2Open.map(toInvoiceItem),
    },
    {
      id: "b3",
      label: "61–90 past due",
      value: formatCurrency(b3),
      tone: b3 ? "error" : "default",
      kind: "invoice",
      items: b3Open.map(toInvoiceItem),
    },
    {
      id: "b4",
      label: "90+ past due",
      value: formatCurrency(b4),
      tone: b4 ? "error" : "default",
      kind: "invoice",
      items: b4Open.map(toInvoiceItem),
    },
    {
      id: "partial",
      label: "Partially paid (open)",
      value: partialOpen.length,
      kind: "invoice",
      items: partialOpen.map(toInvoiceItem),
    },
    {
      id: "disputed",
      label: "Disputed (open)",
      value: disputedOpen.length,
      tone: disputedOpen.length ? "warning" : "default",
      kind: "invoice",
      items: disputedOpen.map(toInvoiceItem),
    },
    {
      id: "write_offs",
      label: "Approved write-offs",
      value: formatCurrency(writtenOffAmt),
      kind: "invoice",
      items: writeOffInvoiceItems,
    },
    {
      id: "unapplied",
      label: "Unapplied payments",
      value: formatCurrency(unapplied),
      kind: "payment",
      items: unappliedPayments.map((p) => ({
        id: p.id,
        paymentNumber: p.payment_number || p.id.slice(0, 8),
        totalLabel: formatCurrency(Number(p.total_amount || 0)),
        unappliedLabel: formatCurrency(Number(p.unapplied_amount || 0)),
      })),
    },
  ];

  const practiceAreas = [
    ...new Set(scoped.map((r) => r.matters?.practice_area).filter(Boolean)),
  ] as string[];

  const clientSummary = buildOutstandingByClient(open as ArOpenInvoice[]);
  const reconciliation = reconcileClientOutstanding(clientSummary, totalAR);

  const scopedWithBucket = scoped.map((r) => ({
    ...r,
    bucket: arAgingBucket(r.due_date, Number(r.balance_due), r.invoice_status),
  }));
  const scopedOpen = scopedWithBucket.filter(
    (r) =>
      Number(r.balance_due) > 0 &&
      !["Written Off", "Canceled", "Paid"].includes(r.invoice_status)
  );
  const clientFilterOptions = buildOutstandingByClient(scopedOpen as ArOpenInvoice[]);

  const activeFilterCount = [sp.status, sp.bucket, sp.practice, sp.client].filter(
    Boolean
  ).length;

  const clearClientHref = arQuery({
    status: sp.status,
    bucket: sp.bucket,
    practice: sp.practice,
    matter: sp.matter,
    attorney: sp.attorney,
  });

  function viewInvoicesHref(clientId: string) {
    return arQuery({
      client: clientId,
      status: sp.status,
      bucket: sp.bucket,
      practice: sp.practice,
      matter: sp.matter,
      attorney: sp.attorney,
    });
  }

  return (
    <>
      <ArClientFocus active={sp.focus === "clients"} />

      <PageHeader
        title="Accounts Receivable"
        description="Outstanding balances, AR aging by due date, disputed and written-off invoices."
      />

      <ArSummaryPanel categories={categories} />

      <form className="mt-4">
        <FilterToolbar
          actions={
            <>
              <button type="submit" className="btn btn-sm btn-primary">
                Apply
              </button>
              <Link href="/ar" className="btn btn-sm btn-ghost">
                Clear
              </Link>
              {sp.client ? (
                <Link href={clearClientHref} className="btn btn-sm btn-outline">
                  Clear client
                </Link>
              ) : null}
            </>
          }
          hint={
            activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active · ${filtered.length} shown`
              : undefined
          }
        >
          <FilterField label="Client" className="w-full sm:w-56">
            <select
              name="client"
              className="select select-bordered select-sm"
              defaultValue={sp.client || ""}
            >
              <option value="">All</option>
              {clientFilterOptions.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientName}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Status" className="w-full sm:w-40">
            <select
              name="status"
              className="select select-bordered select-sm"
              defaultValue={sp.status || ""}
            >
              <option value="">All</option>
              {["Finalized", "Partially Paid", "Past Due", "Disputed", "Paid", "Written Off"].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </FilterField>
          <FilterField label="Aging" className="w-full sm:w-36">
            <select
              name="bucket"
              className="select select-bordered select-sm"
              defaultValue={sp.bucket || ""}
            >
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
            <select
              name="practice"
              className="select select-bordered select-sm"
              defaultValue={sp.practice || ""}
            >
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

      <div
        id="outstanding-by-client"
        className="mt-4 rounded-lg border border-base-300 bg-base-100 overflow-hidden scroll-mt-20"
      >
        <div className="px-3 py-2 border-b border-base-200 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Outstanding by Client</h2>
          <span className="text-xs opacity-55 tabular-nums">
            {clientSummary.length} client{clientSummary.length === 1 ? "" : "s"}
          </span>
        </div>

        {!reconciliation.ok && (
          <div className="px-3 py-2 text-xs text-warning border-b border-base-200 bg-warning/10">
            Client outstanding sum ({formatCurrency(reconciliation.clientSum)}) does not match
            Total Outstanding AR ({formatCurrency(reconciliation.expected)}). Data was not changed —
            review filters and balances.
          </div>
        )}

        {clientSummary.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No clients with an outstanding balance." />
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-base-200">
              {clientSummary.map((c) => (
                <div key={c.clientId} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{c.clientName}</p>
                    <span className="whitespace-nowrap shrink-0">
                      <StatusBadge status={c.collectionStatus} />
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="opacity-60">Outstanding</dt>
                    <dd className="text-right tabular-nums font-semibold">
                      {formatCurrency(c.totalOutstanding)}
                    </dd>
                    <dt className="opacity-60">Past due</dt>
                    <dd className="text-right tabular-nums">
                      {formatCurrency(c.pastDueAmount)}
                    </dd>
                    <dt className="opacity-60">Open invoices</dt>
                    <dd className="text-right tabular-nums">{c.openInvoiceCount}</dd>
                    <dt className="opacity-60">Oldest due</dt>
                    <dd className="text-right">{formatDate(c.oldestOpenDueDate)}</dd>
                  </dl>
                  <Link
                    href={viewInvoicesHref(c.clientId)}
                    className="btn btn-xs btn-primary"
                  >
                    View invoices
                  </Link>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="text-xs">
                    <th>Client</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right">Past due</th>
                    <th className="text-right">Open invoices</th>
                    <th>Oldest due</th>
                    <th>Collection status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientSummary.map((c) => (
                    <tr key={c.clientId} className="hover">
                      <td className="text-sm font-medium">{c.clientName}</td>
                      <td className="text-sm text-right tabular-nums font-semibold">
                        {formatCurrency(c.totalOutstanding)}
                      </td>
                      <td className="text-sm text-right tabular-nums">
                        {formatCurrency(c.pastDueAmount)}
                      </td>
                      <td className="text-sm text-right tabular-nums">
                        {c.openInvoiceCount}
                      </td>
                      <td className="text-sm whitespace-nowrap">
                        {formatDate(c.oldestOpenDueDate)}
                      </td>
                      <td>
                        <span className="whitespace-nowrap">
                          <StatusBadge status={c.collectionStatus} />
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          href={viewInvoicesHref(c.clientId)}
                          className="btn btn-xs btn-primary"
                        >
                          View invoices
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div id="ar-invoice-table" className="mt-4 scroll-mt-20">
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
                        <Link
                          href={`/invoices/${r.id}`}
                          className="link link-hover font-medium"
                        >
                          {(r as Invoice).invoice_number}
                        </Link>
                      </td>
                      <td className="text-sm">{clientDisplayName(r.clients)}</td>
                      <td className="text-sm">{r.matters?.matter_number}</td>
                      <td className="text-sm">
                        {r.matters?.responsible?.full_name || "—"}
                      </td>
                      <td className="text-sm whitespace-nowrap">
                        {formatDate(r.due_date)}
                      </td>
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
      </div>
    </>
  );
}
