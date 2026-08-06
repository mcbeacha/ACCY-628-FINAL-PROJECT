/**
 * Read-only revenue recognition review helpers (ASC 606 teaching model).
 * Reported recognized revenue comes from posted Invoice Finalized journal lines —
 * not from invoices or payments alone.
 */

import { calcBillableAmount } from "@/lib/phase2-types";
import { clientDisplayName } from "@/lib/format";
import type { Client } from "@/lib/types";

export const EXCLUDED_INVOICE_STATUSES = new Set(["Draft", "Canceled"]);

export const FEE_LINE_TYPES = new Set(["Time", "Fixed Fee", "Other", "Adjustment"]);

export const HOURLY_METHODS = new Set(["Hourly", "Retainer-Funded Hourly"]);

export const RECOGNITION_STATUSES = [
  "Posted",
  "Unbilled",
  "Client Funds",
  "Deferred",
  "Ready for Review",
  "Missing Support",
] as const;

export type RecognitionStatus = (typeof RECOGNITION_STATUSES)[number];

export type JournalEntryRow = {
  id: string;
  journal_entry_number?: string | null;
  entry_date: string;
  source_type: string;
  posting_status: string;
  description?: string | null;
};

export type JournalLineRow = {
  id: string;
  journal_entry_id: string;
  account_code: string | null;
  account_name: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
  matter_id: string | null;
  client_id?: string | null;
};

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  matter_id: string;
  invoice_status: string;
  invoice_total: number | null;
  payments_applied: number | null;
  retainer_applied: number | null;
  expense_total?: number | null;
  write_down_total?: number | null;
  balance_due?: number | null;
  dispute_status?: string | null;
  finalized_at?: string | null;
};

export type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  matter_id: string;
  line_type: string;
  final_amount: number | null;
};

export type TimeEntryRow = {
  id: string;
  matter_id: string;
  hours: number | null;
  billing_rate: number | null;
  billable_status: string;
  approval_status: string;
  invoice_status: string;
  work_date?: string | null;
};

export type RetainerAccountRow = {
  id: string;
  matter_id: string;
  current_balance: number | null;
  account_status?: string | null;
};

export type RetainerTxnRow = {
  id: string;
  retainer_account_id?: string;
  matter_id?: string | null;
  transaction_type: string;
  amount: number | null;
  approval_status?: string | null;
  related_invoice_id?: string | null;
};

export type PaymentRow = {
  id: string;
  payment_number: string;
  matter_id: string | null;
  payment_status: string;
  total_amount: number | null;
  payment_date?: string | null;
};

export type MatterTaskRow = {
  id: string;
  matter_id: string;
  title?: string | null;
  status?: string | null;
  client_visible?: boolean | null;
};

export type BillingAdjustmentRow = {
  id: string;
  matter_id: string | null;
  invoice_id?: string | null;
  adjustment_type?: string | null;
  adjustment_amount?: number | null;
  approval_status?: string | null;
};

export type WriteOffRow = {
  id: string;
  matter_id: string | null;
  invoice_id?: string | null;
  amount: number | null;
  approval_status: string;
};

export type MatterInput = {
  id: string;
  matter_number: string;
  matter_name: string;
  matter_description?: string | null;
  billing_method: string | null;
  hourly_rate: number | null;
  fixed_fee_amount: number | null;
  contingency_percentage: number | null;
  estimated_matter_value: number | null;
  approval_status: string | null;
  scope_summary: string | null;
  clients?: Partial<Client> | null;
  responsible?: { full_name?: string | null } | null;
};

export type FeeRevenueAccount = {
  account_code: string;
  account_name: string;
  creditTotal: number;
};

export type EvidenceItem = {
  label: string;
  present: boolean;
  detail: string;
  href?: string;
};

export type MatterRecognitionRow = {
  matterId: string;
  matterNumber: string;
  matterName: string;
  matterDescription: string | null;
  clientName: string;
  responsibleAttorney: string | null;
  billingMethod: string;
  amountBilled: number;
  amountCollected: number;
  reportedRecognizedRevenue: number;
  earnedButNotBilled: number | null;
  earnedButNotBilledNote: string | null;
  unearnedOrTrust: number;
  recognitionStatus: RecognitionStatus;
  statusDetail: string;
  accountingPosition: string;
  reviewAmount: number | null;
  recognitionBasis: string;
  recognitionTrigger: string;
  recommendedTreatment: string;
  evidenceStatements: string[];
  evidence: EvidenceItem[];
  collectionNotes: string[];
  journalEntryIds: string[];
  invoiceIds: string[];
};

function n(v: number | null | undefined): number {
  return Number(v) || 0;
}

export function isIncludedInvoice(status: string): boolean {
  return !EXCLUDED_INVOICE_STATUSES.has(status);
}

export function isFeeLineType(lineType: string): boolean {
  return FEE_LINE_TYPES.has(lineType);
}

/** Exclude AR, cash, trust/liability-style accounts from fee-revenue discovery. */
export function isLikelyNonRevenueAccount(
  accountCode: string | null | undefined,
  accountName: string | null | undefined
): boolean {
  const text = `${accountCode || ""} ${accountName || ""}`.toLowerCase();
  return /receivable|a\/r|\bar\b|accounts rec|cash|bank|checking|trust|iolta|retainer|unearned|contract liability|payable|liability|deposit liability|client funds/.test(
    text
  );
}

export function accountKey(code: string | null, name: string | null): string {
  return `${code || ""}||${name || ""}`;
}

/**
 * Discover legal-fee revenue accounts from Posted Invoice Finalized credit lines.
 * No hardcoded COA — accounts are denormalized on journal lines.
 */
export function discoverFeeRevenueAccounts(
  entries: JournalEntryRow[],
  lines: JournalLineRow[]
): FeeRevenueAccount[] {
  const postedFinalizeIds = new Set(
    entries
      .filter(
        (e) =>
          e.posting_status === "Posted" && e.source_type === "Invoice Finalized"
      )
      .map((e) => e.id)
  );

  const totals = new Map<string, FeeRevenueAccount>();

  for (const line of lines) {
    if (!postedFinalizeIds.has(line.journal_entry_id)) continue;
    const credit = n(line.credit_amount);
    if (credit <= 0) continue;
    if (isLikelyNonRevenueAccount(line.account_code, line.account_name)) continue;
    const key = accountKey(line.account_code, line.account_name);
    const existing = totals.get(key);
    if (existing) {
      existing.creditTotal += credit;
    } else {
      totals.set(key, {
        account_code: line.account_code || "",
        account_name: line.account_name || "",
        creditTotal: credit,
      });
    }
  }

  return [...totals.values()].sort((a, b) => b.creditTotal - a.creditTotal);
}

export function feeRevenueAccountSet(accounts: FeeRevenueAccount[]): Set<string> {
  return new Set(accounts.map((a) => accountKey(a.account_code, a.account_name)));
}

/** Net credits to discovered fee-revenue accounts on Posted Invoice Finalized lines. */
export function reportedRevenueByMatter(
  entries: JournalEntryRow[],
  lines: JournalLineRow[],
  feeAccounts: Set<string>,
  opts?: { from?: string; to?: string }
): Map<string, { amount: number; entryIds: string[] }> {
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const result = new Map<string, { amount: number; entryIds: string[] }>();

  for (const line of lines) {
    const entry = entryById.get(line.journal_entry_id);
    if (!entry) continue;
    if (entry.posting_status !== "Posted") continue;
    if (entry.source_type !== "Invoice Finalized") continue;
    if (!line.matter_id) continue;
    if (!feeAccounts.has(accountKey(line.account_code, line.account_name))) continue;
    if (opts?.from && entry.entry_date < opts.from) continue;
    if (opts?.to && entry.entry_date > opts.to) continue;

    const net = n(line.credit_amount) - n(line.debit_amount);
    if (net === 0) continue;

    const cur = result.get(line.matter_id) || { amount: 0, entryIds: [] };
    cur.amount += net;
    if (!cur.entryIds.includes(entry.id)) cur.entryIds.push(entry.id);
    result.set(line.matter_id, cur);
  }

  return result;
}

export function feeBilledForMatter(
  invoices: InvoiceRow[],
  linesByInvoice: Map<string, InvoiceLineRow[]>,
  matterId: string
): number {
  let total = 0;
  for (const inv of invoices) {
    if (inv.matter_id !== matterId) continue;
    if (!isIncludedInvoice(inv.invoice_status)) continue;
    const lines = linesByInvoice.get(inv.id) || [];
    const feeLines = lines.filter((l) => isFeeLineType(l.line_type));
    if (feeLines.length) {
      total += feeLines.reduce((s, l) => s + n(l.final_amount), 0);
    } else {
      // Fallback when lines missing: invoice_total minus expense_total
      total += Math.max(0, n(inv.invoice_total) - n(inv.expense_total));
    }
  }
  return Math.round(total * 100) / 100;
}

export function collectedForMatter(invoices: InvoiceRow[], matterId: string): number {
  let total = 0;
  for (const inv of invoices) {
    if (inv.matter_id !== matterId) continue;
    if (!isIncludedInvoice(inv.invoice_status)) continue;
    if (!inv.finalized_at && inv.invoice_status === "Draft") continue;
    total += n(inv.payments_applied) + n(inv.retainer_applied);
  }
  return Math.round(total * 100) / 100;
}

export type UnbilledResult = {
  amount: number | null;
  note: string | null;
  entryCount: number;
  missingRateCount: number;
};

export function earnedButNotBilledForMatter(
  method: string,
  timeEntries: TimeEntryRow[],
  matterId: string,
  matterHourlyRate: number | null
): UnbilledResult {
  const supportsHourlyUnbilled =
    HOURLY_METHODS.has(method) ||
    (method === "Hybrid" && n(matterHourlyRate) > 0);

  if (!supportsHourlyUnbilled) {
    if (method === "Fixed Fee" || method === "Hybrid") {
      return {
        amount: null,
        note: "Needs Accounting Review — no reliable fixed-fee progress measure in system",
        entryCount: 0,
        missingRateCount: 0,
      };
    }
    if (method === "Contingency") {
      return {
        amount: null,
        note: "Contingency hours are operational only — not legal-fee revenue",
        entryCount: 0,
        missingRateCount: 0,
      };
    }
    if (method === "Pro Bono") {
      return {
        amount: null,
        note: "Pro bono — no client fee revenue",
        entryCount: 0,
        missingRateCount: 0,
      };
    }
    return {
      amount: null,
      note: "Needs Accounting Review — billing method does not support unbilled fee estimate",
      entryCount: 0,
      missingRateCount: 0,
    };
  }

  const candidates = timeEntries.filter(
    (t) =>
      t.matter_id === matterId &&
      t.approval_status === "Approved" &&
      t.billable_status === "Billable" &&
      t.invoice_status === "Unbilled"
  );

  let amount = 0;
  let missingRate = 0;
  for (const t of candidates) {
    if (!t.billing_rate || n(t.billing_rate) <= 0) {
      missingRate += 1;
      continue;
    }
    amount += calcBillableAmount(n(t.hours), n(t.billing_rate), t.billable_status);
  }

  if (missingRate > 0 && amount === 0 && candidates.length > 0) {
    return {
      amount: null,
      note: "Potential Unbilled Revenue — Needs Review (missing rate evidence)",
      entryCount: candidates.length,
      missingRateCount: missingRate,
    };
  }

  return {
    amount: Math.round(amount * 100) / 100,
    note:
      missingRate > 0
        ? `Potential Unbilled Revenue — Needs Review (${missingRate} entr${missingRate === 1 ? "y" : "ies"} missing rate; excluded from total)`
        : null,
    entryCount: candidates.length,
    missingRateCount: missingRate,
  };
}

function assignStatus(input: {
  method: string;
  reported: number;
  earnedNotBilled: number | null;
  earnedNote: string | null;
  trust: number;
  hasHourlyEvidence: boolean;
  hasFinalizedFeeInvoice: boolean;
  hasSettlementEvidence: boolean;
  hybridIncomplete: boolean;
}): { status: RecognitionStatus; detail: string } {
  const {
    method,
    reported,
    earnedNotBilled,
    earnedNote,
    trust,
    hasHourlyEvidence,
    hasFinalizedFeeInvoice,
    hasSettlementEvidence,
    hybridIncomplete,
  } = input;

  if (method === "Pro Bono" && reported > 0) {
    return {
      status: "Missing Support",
      detail: "Posted fee revenue connected to a pro bono matter",
    };
  }

  if (method === "Contingency") {
    if (reported > 0 && !hasSettlementEvidence) {
      return {
        status: "Missing Support",
        detail:
          "Supporting Evidence Not Found (settlement/judgment fee evidence missing; journal amount preserved). Contingency consideration remains constrained while the outcome is unresolved.",
      };
    }
    return {
      status: "Deferred",
      detail:
        "Outcome not resolved — contingency consideration is constrained until settlement or judgment and contractual fee are supported.",
    };
  }

  if (method === "Fixed Fee" || method === "Hybrid") {
    if (method === "Hybrid" && hybridIncomplete) {
      return {
        status: "Ready for Review",
        detail: "Hybrid allocation incomplete — hourly and/or fixed components unclear",
      };
    }
    if (method === "Fixed Fee") {
      if (reported > 0 && hasFinalizedFeeInvoice) {
        return {
          status: "Ready for Review",
          detail:
            "Fixed-fee progress evidence not reliably stored — invoice finalized but completion measure unknown",
        };
      }
      return {
        status: "Ready for Review",
        detail: "No reliable fixed-fee progress measure — do not invent percentage of completion",
      };
    }
    if (method === "Hybrid") {
      return {
        status: "Ready for Review",
        detail: "Hybrid engagement — do not guess allocation without complete evidence",
      };
    }
  }

  if (
    HOURLY_METHODS.has(method) &&
    earnedNote?.includes("Potential Unbilled Revenue") &&
    (earnedNotBilled === null || earnedNotBilled === 0)
  ) {
    return {
      status: "Ready for Review",
      detail: earnedNote,
    };
  }

  if (
    HOURLY_METHODS.has(method) &&
    earnedNotBilled != null &&
    earnedNotBilled > 0
  ) {
    return {
      status: "Unbilled",
      detail: "Approved billable time earned but not yet invoiced",
    };
  }

  if (trust > 0 && reported <= 0 && !(earnedNotBilled && earnedNotBilled > 0)) {
    return {
      status: "Client Funds",
      detail: "Retainer/trust balance remains — client funds are not revenue until earned",
    };
  }

  if (reported > 0) {
    if (HOURLY_METHODS.has(method) && (hasHourlyEvidence || hasFinalizedFeeInvoice)) {
      return {
        status: "Posted",
        detail: "Posted fee revenue with supporting hourly/invoice evidence",
      };
    }
    if (hasFinalizedFeeInvoice) {
      return {
        status: "Posted",
        detail: "Posted fee revenue with finalized fee invoice evidence",
      };
    }
    return {
      status: "Missing Support",
      detail: "Journal fee revenue without method-appropriate supporting documentation",
    };
  }

  if (!method) {
    return {
      status: "Ready for Review",
      detail: "Billing method missing",
    };
  }

  if (method === "Pro Bono") {
    return {
      status: "Posted",
      detail: "Pro bono — no client fee revenue expected",
    };
  }

  if (trust > 0) {
    return {
      status: "Client Funds",
      detail: "Unearned retainer/trust funds present",
    };
  }

  return {
    status: "Ready for Review",
    detail: "Insufficient evidence to classify recognition status",
  };
}

export function accountingPositionFor(
  status: RecognitionStatus,
  method: string
): string {
  switch (status) {
    case "Deferred":
      return "Contingency outcome unresolved";
    case "Unbilled":
      return "Approved work not yet billed";
    case "Client Funds":
      return "Client funds held in trust";
    case "Posted":
      return method === "Pro Bono"
        ? "No client fee revenue expected"
        : "Fee posted and supported";
    case "Missing Support":
      return "Supporting documentation needed";
    case "Ready for Review":
      return "Supporting documentation needed";
    default:
      return "Supporting documentation needed";
  }
}

export function reviewAmountFor(row: {
  recognitionStatus: RecognitionStatus;
  reportedRecognizedRevenue: number;
  earnedButNotBilled: number | null;
  unearnedOrTrust: number;
}): number | null {
  switch (row.recognitionStatus) {
    case "Unbilled":
      return row.earnedButNotBilled;
    case "Client Funds":
      return row.unearnedOrTrust;
    case "Posted":
      return row.reportedRecognizedRevenue;
    case "Deferred":
      return null;
    case "Missing Support":
      return row.reportedRecognizedRevenue > 0
        ? row.reportedRecognizedRevenue
        : row.unearnedOrTrust > 0
          ? row.unearnedOrTrust
          : row.earnedButNotBilled;
    case "Ready for Review":
      return row.earnedButNotBilled != null && row.earnedButNotBilled > 0
        ? row.earnedButNotBilled
        : row.unearnedOrTrust > 0
          ? row.unearnedOrTrust
          : row.reportedRecognizedRevenue > 0
            ? row.reportedRecognizedRevenue
            : null;
    default:
      return null;
  }
}

function recognitionAssessment(
  status: RecognitionStatus,
  method: string
): { basis: string; trigger: string; treatment: string } {
  if (method === "Contingency") {
    return {
      basis: "Contingency fee arrangement — firm fee only when outcome supported",
      trigger:
        "Settlement, judgment, and contractual fee percentage with sufficient certainty",
      treatment:
        status === "Missing Support"
          ? "Preserve posted journal amount; obtain settlement/fee support before confirming recognition"
          : "Keep revenue deferred; do not recognize hours or expected gross settlement",
    };
  }
  if (HOURLY_METHODS.has(method)) {
    return {
      basis: "Hourly legal services transferred over time",
      trigger: "Approved billable time; recognition measured when fee invoices are finalized and posted",
      treatment:
        status === "Unbilled"
          ? "Track as unbilled earned fees until invoiced; do not treat retainers as revenue"
          : status === "Client Funds"
            ? "Hold retainer as client funds until services are earned and applied"
            : "Reconcile billed, collected, and posted fee revenue separately",
    };
  }
  if (method === "Fixed Fee" || method === "Hybrid") {
    return {
      basis: `${method} engagement — progress must be evidenced before full recognition`,
      trigger: "Reliable completion or milestone evidence plus finalized fee invoice",
      treatment: "Do not invent percentage of completion; flag for accounting review",
    };
  }
  if (method === "Pro Bono") {
    return {
      basis: "Pro bono — no client transaction price",
      trigger: "N/A",
      treatment: "No client fee revenue; investigate any posted fee revenue as an exception",
    };
  }
  return {
    basis: "Engagement terms incomplete or unknown",
    trigger: "Needs accounting review",
    treatment: "Obtain billing method and supporting documentation before recognizing fees",
  };
}

function plainEvidenceStatements(input: {
  method: string;
  approvalStatus: string | null;
  hasApprovedTime: boolean;
  hasFinalizedFeeInvoice: boolean;
  hasSettlementEvidence: boolean;
  contingencyPct: number;
  trust: number;
  hasRetainerTxn: boolean;
  hasPostedFeeJe: boolean;
}): string[] {
  const stmts: string[] = [];
  if (input.method && input.approvalStatus === "Approved") {
    stmts.push("Engagement agreement available");
  } else if (input.method) {
    stmts.push("Fee arrangement on file; engagement approval incomplete");
  } else {
    stmts.push("Engagement agreement missing");
  }

  if (input.hasApprovedTime) stmts.push("Approved time available");
  else if (HOURLY_METHODS.has(input.method) || input.method === "Hybrid") {
    stmts.push("Approved time missing");
  }

  if (input.hasFinalizedFeeInvoice) stmts.push("Finalized invoice available");
  else stmts.push("No finalized fee invoice");

  if (input.method === "Contingency") {
    if (input.hasSettlementEvidence) stmts.push("Settlement documentation available");
    else stmts.push("Settlement documentation missing");
    if (input.contingencyPct > 0) stmts.push("Contingency-fee percentage available");
    else stmts.push("Contingency-fee percentage missing");
  }

  if (input.trust > 0) stmts.push("Retainer remains unearned");
  else if (input.hasRetainerTxn) stmts.push("Retainer activity available");

  if (input.hasPostedFeeJe) stmts.push("Posted journal entry available");
  else stmts.push("No posted revenue entry");

  return stmts;
}

export function buildMatterRecognitionRows(input: {
  matters: MatterInput[];
  invoices: InvoiceRow[];
  invoiceLines: InvoiceLineRow[];
  timeEntries: TimeEntryRow[];
  retainerAccounts: RetainerAccountRow[];
  retainerTxns: RetainerTxnRow[];
  payments: PaymentRow[];
  journalEntries: JournalEntryRow[];
  journalLines: JournalLineRow[];
  matterTasks: MatterTaskRow[];
  adjustments: BillingAdjustmentRow[];
  writeOffs: WriteOffRow[];
  feeAccounts: FeeRevenueAccount[];
  dateFrom?: string;
  dateTo?: string;
}): MatterRecognitionRow[] {
  const {
    matters,
    invoices,
    invoiceLines,
    timeEntries,
    retainerAccounts,
    retainerTxns,
    journalEntries,
    journalLines,
    feeAccounts,
    dateFrom,
    dateTo,
  } = input;

  void input.payments;
  void input.matterTasks;
  void input.adjustments;
  void input.writeOffs;

  const feeSet = feeRevenueAccountSet(feeAccounts);
  const reportedMap = reportedRevenueByMatter(journalEntries, journalLines, feeSet, {
    from: dateFrom,
    to: dateTo,
  });

  const linesByInvoice = new Map<string, InvoiceLineRow[]>();
  for (const line of invoiceLines) {
    const arr = linesByInvoice.get(line.invoice_id) || [];
    arr.push(line);
    linesByInvoice.set(line.invoice_id, arr);
  }

  const trustByMatter = new Map<string, number>();
  for (const a of retainerAccounts) {
    trustByMatter.set(a.matter_id, n(a.current_balance) + (trustByMatter.get(a.matter_id) || 0));
  }

  const entryById = new Map(journalEntries.map((e) => [e.id, e]));

  return matters.map((m) => {
    const method = m.billing_method || "";
    const reportedInfo = reportedMap.get(m.id) || { amount: 0, entryIds: [] };
    const amountBilled = feeBilledForMatter(invoices, linesByInvoice, m.id);
    const amountCollected = collectedForMatter(invoices, m.id);
    const unbilled = earnedButNotBilledForMatter(
      method,
      timeEntries,
      m.id,
      m.hourly_rate
    );
    const trust = Math.round((trustByMatter.get(m.id) || 0) * 100) / 100;

    const matterInvoices = invoices.filter(
      (i) => i.matter_id === m.id && isIncludedInvoice(i.invoice_status)
    );
    const finalizedFeeInvoices = matterInvoices.filter((i) => {
      if (!i.finalized_at && i.invoice_status === "Draft") return false;
      const lines = linesByInvoice.get(i.id) || [];
      const feeLines = lines.filter((l) => isFeeLineType(l.line_type));
      return feeLines.length > 0 || n(i.invoice_total) > n(i.expense_total);
    });

    const approvedTime = timeEntries.filter(
      (t) =>
        t.matter_id === m.id &&
        t.approval_status === "Approved" &&
        t.billable_status === "Billable"
    );
    const matterRetainerTxns = retainerTxns.filter((t) => {
      if (t.matter_id) return t.matter_id === m.id;
      return false;
    });

    // No settlement/judgment table exists — contingency never has settlement evidence
    const hasSettlementEvidence = false;
    const hybridIncomplete =
      method === "Hybrid" &&
      !(n(m.hourly_rate) > 0 && n(m.fixed_fee_amount) > 0);

    const { status, detail } = assignStatus({
      method,
      reported: reportedInfo.amount,
      earnedNotBilled: unbilled.amount,
      earnedNote: unbilled.note,
      trust,
      hasHourlyEvidence: approvedTime.length > 0,
      hasFinalizedFeeInvoice: finalizedFeeInvoices.length > 0,
      hasSettlementEvidence,
      hybridIncomplete,
    });

    const collectionNotes: string[] = [];
    for (const inv of matterInvoices) {
      if (inv.invoice_status === "Disputed" || inv.dispute_status === "Raised") {
        collectionNotes.push(`Disputed invoice ${inv.invoice_number}`);
      } else if (inv.invoice_status === "Past Due") {
        collectionNotes.push(`Past due invoice ${inv.invoice_number}`);
      } else if (inv.invoice_status === "Partially Paid") {
        collectionNotes.push(`Partially paid invoice ${inv.invoice_number}`);
      } else if (
        ["Finalized", "Past Due", "Partially Paid"].includes(inv.invoice_status) &&
        n(inv.balance_due) > 0
      ) {
        collectionNotes.push(`Unpaid balance on ${inv.invoice_number}`);
      }
    }

    const evidence: EvidenceItem[] = [
      {
        label: "Engagement agreement",
        present: Boolean(method) && m.approval_status === "Approved",
        detail:
          method && m.approval_status === "Approved"
            ? `${method} engagement approved`
            : method
              ? "Fee arrangement on file; approval incomplete"
              : "Missing",
      },
      {
        label: "Approved time",
        present: approvedTime.length > 0,
        detail:
          approvedTime.length > 0
            ? `${approvedTime.length} approved billable entr${approvedTime.length === 1 ? "y" : "ies"}`
            : "None",
        href: "/unbilled",
      },
      {
        label: "Finalized invoice",
        present: finalizedFeeInvoices.length > 0,
        detail:
          finalizedFeeInvoices.length > 0
            ? finalizedFeeInvoices.map((i) => i.invoice_number).join(", ")
            : "None",
        href: finalizedFeeInvoices[0]
          ? `/invoices/${finalizedFeeInvoices[0].id}`
          : "/invoices",
      },
      {
        label: "Settlement or judgment",
        present: false,
        detail:
          method === "Contingency"
            ? "Missing — no settlement record in system"
            : "Not applicable",
      },
      {
        label: "Contingency-fee percentage",
        present: n(m.contingency_percentage) > 0,
        detail:
          n(m.contingency_percentage) > 0
            ? `${m.contingency_percentage}% firm fee`
            : method === "Contingency"
              ? "Missing"
              : "Not applicable",
      },
      {
        label: "Retainer activity",
        present: trust > 0 || matterRetainerTxns.length > 0,
        detail:
          trust > 0
            ? "Retainer remains unearned"
            : matterRetainerTxns.length > 0
              ? "Retainer activity on file"
              : "None",
        href: "/retainers",
      },
      {
        label: "Posted journal entry",
        present: reportedInfo.entryIds.length > 0,
        detail:
          reportedInfo.entryIds.length > 0
            ? "Posted fee-revenue entry available"
            : "No posted revenue entry",
        href: reportedInfo.entryIds[0]
          ? `/journal?entry=${reportedInfo.entryIds[0]}`
          : "/journal",
      },
    ];

    const evidenceStatements = plainEvidenceStatements({
      method,
      approvalStatus: m.approval_status,
      hasApprovedTime: approvedTime.length > 0,
      hasFinalizedFeeInvoice: finalizedFeeInvoices.length > 0,
      hasSettlementEvidence,
      contingencyPct: n(m.contingency_percentage),
      trust,
      hasRetainerTxn: matterRetainerTxns.length > 0,
      hasPostedFeeJe: reportedInfo.entryIds.length > 0,
    });

    const assessment = recognitionAssessment(status, method);
    const accountingPosition = accountingPositionFor(status, method);

    const relatedJeIds = [
      ...new Set(
        journalLines
          .filter((l) => l.matter_id === m.id)
          .map((l) => l.journal_entry_id)
          .filter((id) => {
            const e = entryById.get(id);
            return e && e.posting_status === "Posted";
          })
      ),
    ];

    const rowBase = {
      matterId: m.id,
      matterNumber: m.matter_number,
      matterName: m.matter_name,
      matterDescription: m.matter_description || m.scope_summary || null,
      clientName: clientDisplayName(m.clients),
      responsibleAttorney: m.responsible?.full_name || null,
      billingMethod: method || "—",
      amountBilled,
      amountCollected,
      reportedRecognizedRevenue: Math.round(reportedInfo.amount * 100) / 100,
      earnedButNotBilled: unbilled.amount,
      earnedButNotBilledNote: unbilled.note,
      unearnedOrTrust: trust,
      recognitionStatus: status,
      statusDetail: detail,
      accountingPosition,
      recognitionBasis: assessment.basis,
      recognitionTrigger: assessment.trigger,
      recommendedTreatment: assessment.treatment,
      evidenceStatements,
      evidence,
      collectionNotes,
      journalEntryIds: relatedJeIds,
      invoiceIds: matterInvoices.map((i) => i.id),
    };

    return {
      ...rowBase,
      reviewAmount: reviewAmountFor(rowBase),
    };
  });
}

/** Matters that need staff action — excludes Deferred (properly deferred contingency). */
export function requiresReviewCount(rows: MatterRecognitionRow[]): number {
  return rows.filter(
    (r) =>
      r.recognitionStatus === "Ready for Review" ||
      r.recognitionStatus === "Missing Support"
  ).length;
}

export function isExceptionStatus(status: RecognitionStatus): boolean {
  return status === "Missing Support" || status === "Ready for Review";
}
