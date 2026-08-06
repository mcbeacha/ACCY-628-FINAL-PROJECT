/**
 * Client-level Outstanding AR rollups.
 * Uses the same open-invoice and aging rules as /ar (balance_due + arAgingBucket).
 */

import { arAgingBucket } from "@/lib/permissions";
import { clientDisplayName } from "@/lib/format";
import type { Client } from "@/lib/types";

export const PAST_DUE_BUCKETS = new Set(["1–30", "31–60", "61–90", "90+"]);

export type ArOpenInvoice = {
  id: string;
  client_id: string;
  due_date: string;
  balance_due: number | null;
  invoice_status: string;
  dispute_status?: string | null;
  bucket?: string;
  clients?: Partial<Client> | null;
};

export type ClientCollectionStatus =
  | "Disputed"
  | "Past Due"
  | "Partially Paid"
  | "Current";

export type OutstandingClientRow = {
  clientId: string;
  clientName: string;
  totalOutstanding: number;
  pastDueAmount: number;
  openInvoiceCount: number;
  oldestOpenDueDate: string | null;
  collectionStatus: ClientCollectionStatus;
};

function n(v: number | null | undefined): number {
  return Number(v) || 0;
}

function isPastDueBucket(bucket: string): boolean {
  return PAST_DUE_BUCKETS.has(bucket);
}

export function collectionStatusForInvoices(
  invoices: ArOpenInvoice[]
): ClientCollectionStatus {
  const disputed = invoices.some(
    (i) => i.invoice_status === "Disputed" || i.dispute_status === "Raised"
  );
  if (disputed) return "Disputed";

  const pastDue = invoices.some((i) => {
    const bucket =
      i.bucket ??
      arAgingBucket(i.due_date, n(i.balance_due), i.invoice_status);
    return isPastDueBucket(bucket);
  });
  if (pastDue) return "Past Due";

  if (invoices.some((i) => i.invoice_status === "Partially Paid")) {
    return "Partially Paid";
  }

  return "Current";
}

/** Group open AR invoices by client_id; only clients with outstanding > 0. */
export function buildOutstandingByClient(
  openInvoices: ArOpenInvoice[]
): OutstandingClientRow[] {
  const byClient = new Map<
    string,
    {
      clientId: string;
      clients: Partial<Client> | null | undefined;
      invoices: ArOpenInvoice[];
    }
  >();

  for (const inv of openInvoices) {
    if (!inv.client_id) continue;
    const bal = Math.max(0, n(inv.balance_due));
    if (bal <= 0) continue;

    const existing = byClient.get(inv.client_id);
    if (existing) {
      existing.invoices.push(inv);
    } else {
      byClient.set(inv.client_id, {
        clientId: inv.client_id,
        clients: inv.clients,
        invoices: [inv],
      });
    }
  }

  const rows: OutstandingClientRow[] = [];

  for (const group of byClient.values()) {
    let totalOutstanding = 0;
    let pastDueAmount = 0;
    let oldest: string | null = null;

    for (const inv of group.invoices) {
      const bal = Math.max(0, n(inv.balance_due));
      totalOutstanding += bal;
      const bucket =
        inv.bucket ??
        arAgingBucket(inv.due_date, bal, inv.invoice_status);
      if (isPastDueBucket(bucket)) pastDueAmount += bal;
      if (inv.due_date && (!oldest || inv.due_date < oldest)) {
        oldest = inv.due_date;
      }
    }

    if (totalOutstanding <= 0) continue;

    rows.push({
      clientId: group.clientId,
      clientName: clientDisplayName(group.clients),
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      pastDueAmount: Math.round(pastDueAmount * 100) / 100,
      openInvoiceCount: group.invoices.length,
      oldestOpenDueDate: oldest,
      collectionStatus: collectionStatusForInvoices(group.invoices),
    });
  }

  rows.sort(
    (a, b) =>
      b.totalOutstanding - a.totalOutstanding ||
      a.clientName.localeCompare(b.clientName)
  );

  return rows;
}

export function reconcileClientOutstanding(
  clientRows: OutstandingClientRow[],
  totalOutstandingAR: number
): { ok: boolean; clientSum: number; expected: number } {
  const clientSum =
    Math.round(
      clientRows.reduce((s, r) => s + r.totalOutstanding, 0) * 100
    ) / 100;
  const expected = Math.round(totalOutstandingAR * 100) / 100;
  const ok = clientSum === expected;
  if (!ok && process.env.NODE_ENV !== "production") {
    console.error(
      `[AR client summary] reconciliation mismatch: client sum ${clientSum} !== Total Outstanding AR ${expected}`
    );
  }
  return { ok, clientSum, expected };
}
