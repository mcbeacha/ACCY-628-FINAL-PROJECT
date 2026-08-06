/** PI client-trust / settlement ledger helpers (stored types reuse retainer_transactions). */

export const SETTLEMENT_LEDGER_STEPS = [
  "Settlement Proceeds",
  "Lien Payment",
  "Cost Reimbursement",
  "Attorney Fee Transfer",
  "Client Distribution",
] as const;

export type SettlementLedgerLabel = (typeof SETTLEMENT_LEDGER_STEPS)[number] | string;

const TRUST_INCREASE_TYPES = new Set(["Deposit", "Adjustment Increase"]);
const TRUST_DECREASE_TYPES = new Set([
  "Refund",
  "Adjustment Decrease",
  "Applied to Fees",
  "Applied to Expenses",
]);

/** Map stored retainer txn type + description to PI settlement display labels. */
export function settlementDisplayLabel(
  transactionType: string,
  description?: string | null
): SettlementLedgerLabel {
  const desc = (description || "").toLowerCase();
  const type = transactionType || "";

  // Prefer description markers (word-boundary where short tokens collide, e.g. "lien" in "client")
  // Client distribution first — descriptions often say "net settlement proceeds to client"
  if (
    desc.includes("client distribution") ||
    desc.includes("client disbursement") ||
    desc.includes("net to client") ||
    desc.includes("net settlement proceeds to client") ||
    desc.includes("proceeds to client")
  ) {
    return "Client Distribution";
  }
  if (
    desc.includes("settlement proceed") ||
    desc.includes("settlement check") ||
    desc.includes("insurer settlement") ||
    desc.includes("deposited to client trust")
  ) {
    return "Settlement Proceeds";
  }
  if (/\blien\b/.test(desc) || desc.includes("lien payment") || desc.includes("medical lien")) {
    return "Lien Payment";
  }
  if (desc.includes("cost reimburs") || desc.includes("case cost")) {
    return "Cost Reimbursement";
  }
  if (desc.includes("attorney fee") || desc.includes("contingency fee")) {
    return "Attorney Fee Transfer";
  }

  if (type === "Deposit" || type === "Adjustment Increase") return "Settlement Proceeds";
  if (type === "Applied to Expenses") return "Cost Reimbursement";
  if (type === "Applied to Fees") return "Attorney Fee Transfer";
  if (type === "Adjustment Decrease") return "Lien Payment";
  if (type === "Refund") return "Client Distribution";

  return type || "Trust Entry";
}

export function trustIncreaseAmount(transactionType: string, amount: number) {
  return TRUST_INCREASE_TYPES.has(transactionType) ? amount : 0;
}

export function trustDecreaseAmount(transactionType: string, amount: number) {
  return TRUST_DECREASE_TYPES.has(transactionType) ? amount : 0;
}
