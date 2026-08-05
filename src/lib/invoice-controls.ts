/** Unique invoice numbering control helpers (Billing / Accounting Staff). */

export const DUPLICATE_INVOICE_NUMBER_MESSAGE =
  "Duplicate invoice number is not allowed. Each invoice must use a unique invoice number.";

export type DuplicateInvoiceNumberGroup = {
  invoice_number: string;
  ids: string[];
  count: number;
};

export function findDuplicateInvoiceNumbers(
  invoices: { id: string; invoice_number: string | null | undefined }[]
): DuplicateInvoiceNumberGroup[] {
  const map = new Map<string, { display: string; ids: string[] }>();
  for (const inv of invoices) {
    const raw = (inv.invoice_number || "").trim();
    if (!raw) continue;
    const key = raw.toUpperCase();
    const existing = map.get(key);
    if (existing) {
      existing.ids.push(inv.id);
    } else {
      map.set(key, { display: raw, ids: [inv.id] });
    }
  }
  return [...map.values()]
    .filter((g) => g.ids.length > 1)
    .map((g) => ({
      invoice_number: g.display,
      ids: g.ids,
      count: g.ids.length,
    }));
}

export function isDuplicateInvoiceNumberError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("invoices_invoice_number_key") ||
    (m.includes("invoice_number") && (m.includes("duplicate") || m.includes("unique"))) ||
    (m.includes("duplicate key") && m.includes("invoice_number"))
  );
}
