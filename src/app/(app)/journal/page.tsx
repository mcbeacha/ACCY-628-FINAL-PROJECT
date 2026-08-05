import { requireUser } from "@/lib/auth";
import { canViewJournal } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { formatCurrency, formatDate } from "@/lib/format";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { profile, supabase } = await requireUser();
  if (!canViewJournal(profile.role)) redirect("/dashboard");

  let q = supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .limit(200);

  if (sp.source) q = q.eq("source_type", sp.source);
  if (sp.from) q = q.gte("entry_date", sp.from);
  if (sp.to) q = q.lte("entry_date", sp.to);

  const { data: entries } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (entries || []) as any[];

  const ids = rows.map((r) => r.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lines: any[] = [];
  if (ids.length) {
    const { data: l } = await supabase
      .from("journal_entry_lines")
      .select("*")
      .in("journal_entry_id", ids);
    lines = l || [];
  }

  if (sp.client) {
    const jeIds = new Set(
      lines.filter((l) => l.client_id === sp.client).map((l) => l.journal_entry_id)
    );
    rows = rows.filter((r) => jeIds.has(r.id));
  }
  if (sp.matter) {
    const jeIds = new Set(
      lines.filter((l) => l.matter_id === sp.matter).map((l) => l.journal_entry_id)
    );
    rows = rows.filter((r) => jeIds.has(r.id));
  }

  const detailId = sp.entry;
  const detail = detailId ? rows.find((r) => r.id === detailId) : null;
  const detailLines = detailId
    ? lines.filter((l) => l.journal_entry_id === detailId)
    : [];

  // CSV export via data URL is client-side; provide simple download link params
  const csvRows = [
    ["entry_number", "date", "source", "description", "status", "account", "debit", "credit"].join(","),
  ];
  for (const e of rows) {
    const els = lines.filter((l) => l.journal_entry_id === e.id);
    for (const l of els) {
      csvRows.push(
        [
          e.journal_entry_number,
          e.entry_date,
          `"${e.source_type}"`,
          `"${(e.description || "").replace(/"/g, '""')}"`,
          e.posting_status,
          `"${l.account_code} ${l.account_name}"`,
          l.debit_amount,
          l.credit_amount,
        ].join(",")
      );
    }
  }
  const csv = csvRows.join("\n");

  return (
    <>
      <PageHeader
        title="Simulated Journal Entries"
        description="Read-only report of balanced simulated GL postings from financial events."
      />

      <form className="card bg-base-100 border border-base-300">
        <div className="card-body flex flex-wrap gap-3 items-end">
          <label className="form-control">
            <span className="label-text text-xs">From</span>
            <input type="date" name="from" className="input input-bordered input-sm" defaultValue={sp.from || ""} />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">To</span>
            <input type="date" name="to" className="input input-bordered input-sm" defaultValue={sp.to || ""} />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Source</span>
            <select name="source" className="select select-bordered select-sm" defaultValue={sp.source || ""}>
              <option value="">All</option>
              {[
                "Retainer Deposit",
                "Invoice Finalized",
                "Customer Payment",
                "Retainer Application",
                "Write-Off",
                "Payment Reversal",
                "Adjustment",
                "Other",
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-sm btn-primary" type="submit">
            Filter
          </button>
          <a
            className="btn btn-sm btn-outline"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
            download="journal-entries.csv"
          >
            Export CSV
          </a>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No journal entries match." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="table-wrap">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>JE #</th>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className={detailId === e.id ? "bg-base-200" : "hover"}>
                      <td>
                        <Link
                          href={`/journal?entry=${e.id}${sp.source ? `&source=${encodeURIComponent(sp.source)}` : ""}`}
                          className="link link-hover font-medium"
                        >
                          {e.journal_entry_number}
                        </Link>
                      </td>
                      <td>{formatDate(e.entry_date)}</td>
                      <td className="text-sm">{e.source_type}</td>
                      <td>
                        <StatusBadge status={e.posting_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Entry detail</h2>
              {!detail ? (
                <p className="text-sm opacity-60">Select a journal entry to view debit and credit lines.</p>
              ) : (
                <>
                  <p className="text-sm font-medium">{detail.journal_entry_number}</p>
                  <p className="text-sm opacity-70">{detail.description}</p>
                  <p className="text-xs opacity-60 mb-2">
                    {formatDate(detail.entry_date)} · {detail.source_type}
                  </p>
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Debit</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {l.account_code} {l.account_name}
                          </td>
                          <td>{Number(l.debit_amount) ? formatCurrency(Number(l.debit_amount)) : ""}</td>
                          <td>{Number(l.credit_amount) ? formatCurrency(Number(l.credit_amount)) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td>Totals</td>
                        <td>
                          {formatCurrency(
                            detailLines.reduce((s, l) => s + Number(l.debit_amount), 0)
                          )}
                        </td>
                        <td>
                          {formatCurrency(
                            detailLines.reduce((s, l) => s + Number(l.credit_amount), 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
