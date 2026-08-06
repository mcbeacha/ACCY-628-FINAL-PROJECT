import { requireUser } from "@/lib/auth";
import { canManageRetainers } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { clientDisplayName, formatCurrency, formatDate } from "@/lib/format";
import type { RetainerTransaction } from "@/lib/phase2-types";
import type { Client } from "@/lib/types";
import {
  SETTLEMENT_LEDGER_STEPS,
  settlementDisplayLabel,
  trustDecreaseAmount,
  trustIncreaseAmount,
} from "@/lib/trust-ledger";
import { redirect } from "next/navigation";

type TxnRow = RetainerTransaction & {
  matters?: {
    matter_number: string;
    matter_name: string;
    practice_area?: string | null;
    clients?: Client | null;
  } | null;
};

export default async function TrustLedgerPage() {
  const { profile, supabase } = await requireUser();
  if (!canManageRetainers(profile.role)) redirect("/dashboard");

  const { data } = await supabase
    .from("retainer_transactions")
    .select(
      "*, matters!inner(matter_number, matter_name, practice_area, clients(organization_name, first_name, last_name, client_type, primary_contact_name))"
    )
    .eq("approval_status", "Approved")
    .eq("matters.practice_area", "Personal Injury")
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data || []) as TxnRow[];

  const byMatter = new Map<string, TxnRow[]>();
  for (const r of rows) {
    const list = byMatter.get(r.matter_id) || [];
    list.push(r);
    byMatter.set(r.matter_id, list);
  }

  const ledgerLines: {
    id: string;
    client: string;
    matter: string;
    date: string;
    type: string;
    desc: string;
    increase: number;
    decrease: number;
    balance: number;
    ref: string;
    status: string;
  }[] = [];

  for (const [, list] of byMatter) {
    let bal = 0;
    for (const r of list) {
      const amt = Number(r.amount);
      const increase = trustIncreaseAmount(r.transaction_type, amt);
      const decrease = trustDecreaseAmount(r.transaction_type, amt);
      bal = bal + increase - decrease;
      ledgerLines.push({
        id: r.id,
        client: clientDisplayName(r.matters?.clients || null),
        matter: r.matters ? `${r.matters.matter_number} · ${r.matters.matter_name}` : r.matter_id,
        date: r.transaction_date,
        type: settlementDisplayLabel(r.transaction_type, r.description),
        desc: r.description || "—",
        increase,
        decrease,
        balance: bal,
        ref: r.reference_number || "—",
        status: r.approval_status,
      });
    }
  }

  ledgerLines.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  return (
    <>
      <PageHeader
        title="Client Trust Ledger"
        description="PI settlement proceeds, liens, cost reimbursement, attorney-fee transfers, and client distributions with running balances by matter."
      />
      <p className="text-sm opacity-70 -mt-2">
        Settlement sequence: {SETTLEMENT_LEDGER_STEPS.join(" → ")}. Operating retainers for hourly matters remain
        on Retainers.
      </p>

      {ledgerLines.length === 0 ? (
        <EmptyState title="No approved PI settlement trust transactions yet." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Matter</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Increase</th>
                  <th>Decrease</th>
                  <th>Running bal.</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledgerLines.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td className="text-sm">{r.client}</td>
                    <td className="text-sm">{r.matter}</td>
                    <td className="text-sm">{r.type}</td>
                    <td className="text-sm max-w-[12rem] truncate">{r.desc}</td>
                    <td className="text-success text-sm">
                      {r.increase ? formatCurrency(r.increase) : "—"}
                    </td>
                    <td className="text-error text-sm">
                      {r.decrease ? formatCurrency(r.decrease) : "—"}
                    </td>
                    <td className="font-semibold text-sm">{formatCurrency(r.balance)}</td>
                    <td className="text-sm">{r.ref}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
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
