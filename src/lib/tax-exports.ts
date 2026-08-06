import { formatCurrency } from "@/lib/format";

/** Tax-oriented groupings for law-firm year-end CPA packages (academic / fictional). */
export type TaxCategoryId =
  | "income_fees"
  | "income_other"
  | "meals_50"
  | "entertainment_0"
  | "travel"
  | "professional_dues"
  | "insurance"
  | "office_ops"
  | "payroll_notes"
  | "trust_memo";

export type TaxLineItem = {
  id: string;
  categoryId: TaxCategoryId;
  description: string;
  amount: number;
  date: string | null;
  source: "live" | "demo";
  reference?: string | null;
  taxNote?: string;
};

export type TaxCategoryGroup = {
  id: TaxCategoryId;
  title: string;
  summary: string;
  deductibilityHint: string;
  items: TaxLineItem[];
  total: number;
};

export type TaxExportAudit = {
  exportedByName: string;
  exportedByEmail: string;
  exportedByRole: string;
  exportedAtIso: string;
  taxYear: number;
};

const DEMO_FALLBACKS: Array<
  Omit<TaxLineItem, "id" | "date"> & { monthDay: string }
> = [
  {
    categoryId: "entertainment_0",
    description: "Client development — sporting event tickets (demo)",
    amount: 480,
    monthDay: "06-14",
    source: "demo",
    reference: "DEMO-ENT-001",
    taxNote: "Generally nondeductible entertainment under IRC §274",
  },
  {
    categoryId: "entertainment_0",
    description: "Golf outing with referral source (demo)",
    amount: 320,
    monthDay: "08-02",
    source: "demo",
    reference: "DEMO-ENT-002",
    taxNote: "Generally nondeductible entertainment under IRC §274",
  },
  {
    categoryId: "meals_50",
    description: "Client lunch — matter strategy discussion (demo)",
    amount: 96.4,
    monthDay: "03-18",
    source: "demo",
    reference: "DEMO-MEAL-001",
    taxNote: "Typical business meal — often 50% deductible when substantiated",
  },
  {
    categoryId: "professional_dues",
    description: "State bar dues (demo)",
    amount: 375,
    monthDay: "01-15",
    source: "demo",
    reference: "DEMO-DUE-001",
    taxNote: "Ordinary professional dues — usually fully deductible",
  },
  {
    categoryId: "professional_dues",
    description: "CLE registration — ethics hours (demo)",
    amount: 249,
    monthDay: "04-09",
    source: "demo",
    reference: "DEMO-CLE-001",
    taxNote: "Continuing education — usually fully deductible",
  },
  {
    categoryId: "insurance",
    description: "Professional malpractice insurance premium (demo)",
    amount: 4200,
    monthDay: "02-01",
    source: "demo",
    reference: "DEMO-INS-001",
    taxNote: "Business insurance — usually fully deductible",
  },
  {
    categoryId: "office_ops",
    description: "Office rent — quarterly (demo)",
    amount: 9000,
    monthDay: "01-01",
    source: "demo",
    reference: "DEMO-RENT-001",
    taxNote: "Rent / occupancy — usually fully deductible",
  },
  {
    categoryId: "office_ops",
    description: "Legal research subscription (demo)",
    amount: 1800,
    monthDay: "01-05",
    source: "demo",
    reference: "DEMO-SOFT-001",
    taxNote: "Software / research tools — usually fully deductible",
  },
  {
    categoryId: "payroll_notes",
    description: "Wages & payroll taxes summary (demo placeholder)",
    amount: 186000,
    monthDay: "12-31",
    source: "demo",
    reference: "DEMO-PAY-001",
    taxNote: "Provide W-2 / payroll reports to CPA; owner draws tracked separately",
  },
  {
    categoryId: "trust_memo",
    description: "Client trust / IOLTA balances — informational only (demo)",
    amount: 0,
    monthDay: "12-31",
    source: "demo",
    reference: "DEMO-TRUST-001",
    taxNote: "Trust funds are not firm income; report for CPA reconciliation only",
  },
];

/** Calendar years available in the Tax Exports year picker (current + prior two). */
export function availableTaxYears(now = new Date()): number[] {
  const current = now.getFullYear();
  return [current, current - 1, current - 2];
}

export function resolveTaxYear(
  raw: string | string[] | undefined,
  now = new Date()
): number {
  const years = availableTaxYears(now);
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && years.includes(parsed)) return parsed;
  return years[0];
}

export const TAX_CATEGORY_META: Record<
  TaxCategoryId,
  { title: string; summary: string; deductibilityHint: string }
> = {
  income_fees: {
    title: "Fee & billing income",
    summary: "Collected fees and posted client payments from firm operations.",
    deductibilityHint: "Report as gross receipts / fee income for the tax year.",
  },
  income_other: {
    title: "Other firm income",
    summary: "Non-fee income that should be disclosed to the CPA separately.",
    deductibilityHint: "Classify per CPA guidance (interest, reimbursements, etc.).",
  },
  meals_50: {
    title: "Business meals",
    summary: "Client / travel / meeting meals kept separate from entertainment.",
    deductibilityHint:
      "Often 50% deductible when business purpose is documented (IRC §274).",
  },
  entertainment_0: {
    title: "Entertainment",
    summary: "Sporting events, golf, theater, and similar entertainment costs.",
    deductibilityHint: "Generally nondeductible under current federal rules.",
  },
  travel: {
    title: "Travel (non-meal)",
    summary: "Airfare, lodging, mileage, parking, and related travel costs.",
    deductibilityHint: "Ordinary travel costs are typically fully deductible.",
  },
  professional_dues: {
    title: "Professional dues & CLE",
    summary: "Bar dues, CLE, professional memberships, and related education.",
    deductibilityHint: "Usually fully deductible ordinary business expenses.",
  },
  insurance: {
    title: "Insurance",
    summary: "Malpractice and other business insurance premiums.",
    deductibilityHint: "Usually fully deductible.",
  },
  office_ops: {
    title: "Office & operating expenses",
    summary: "Rent, utilities, software, research, copying, postage, and similar.",
    deductibilityHint: "Usually fully deductible when ordinary and necessary.",
  },
  payroll_notes: {
    title: "Payroll & compensation notes",
    summary: "Wage and payroll summary for CPA payroll reconciliation.",
    deductibilityHint: "Pair with W-2 / payroll filings; separate owner draws.",
  },
  trust_memo: {
    title: "Trust / client funds (memo)",
    summary: "Informational trust balances — not firm taxable income.",
    deductibilityHint: "For CPA trust reconciliation only; do not treat as revenue.",
  },
};

function mapExpenseType(expenseType: string, description: string): TaxCategoryId {
  const t = expenseType.toLowerCase();
  const d = description.toLowerCase();
  if (t.includes("meal") || d.includes("meal") || d.includes("lunch") || d.includes("dinner")) {
    return "meals_50";
  }
  if (
    t.includes("entertain") ||
    d.includes("entertain") ||
    d.includes("golf") ||
    d.includes("ticket") ||
    d.includes("concert") ||
    d.includes("sport")
  ) {
    return "entertainment_0";
  }
  if (
    ["travel", "mileage", "parking", "lodging"].includes(t) ||
    d.includes("airfare") ||
    d.includes("hotel")
  ) {
    return "travel";
  }
  if (d.includes("cle") || d.includes("bar due") || d.includes("dues") || d.includes("membership")) {
    return "professional_dues";
  }
  if (d.includes("insurance") || d.includes("malpractice")) {
    return "insurance";
  }
  return "office_ops";
}

type PaymentRow = {
  id: string;
  payment_number?: string | null;
  payment_date?: string | null;
  total_amount?: number | null;
  payment_status?: string | null;
};

type ExpenseRow = {
  id: string;
  expense_date?: string | null;
  amount?: number | null;
  expense_type?: string | null;
  description?: string | null;
  approval_status?: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  invoice_total?: number | null;
  payments_applied?: number | null;
  invoice_status?: string | null;
  finalized_at?: string | null;
};

function inTaxYear(isoDate: string | null | undefined, taxYear: number) {
  if (!isoDate) return false;
  return isoDate.slice(0, 4) === String(taxYear);
}

/** Build hybrid tax package: live rows when present, demo fill for sparse categories. */
export function buildTaxExportGroups(input: {
  taxYear: number;
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  invoices: InvoiceRow[];
}): TaxCategoryGroup[] {
  const items: TaxLineItem[] = [];
  let liveIncome = 0;

  for (const p of input.payments) {
    if (p.payment_status && !["Posted", "Applied"].includes(p.payment_status)) continue;
    if (!inTaxYear(p.payment_date, input.taxYear)) continue;
    const amount = Number(p.total_amount || 0);
    if (!amount) continue;
    liveIncome += amount;
    items.push({
      id: `pay-${p.id}`,
      categoryId: "income_fees",
      description: "Posted client payment",
      amount,
      date: p.payment_date || null,
      source: "live",
      reference: p.payment_number || p.id,
      taxNote: "Fee / collection income from payments register",
    });
  }

  if (liveIncome === 0) {
    for (const inv of input.invoices) {
      if (!inv.finalized_at) continue;
      if (!inTaxYear(inv.invoice_date || inv.finalized_at, input.taxYear)) continue;
      const collected = Number(inv.payments_applied || 0);
      if (collected <= 0) continue;
      items.push({
        id: `inv-${inv.id}`,
        categoryId: "income_fees",
        description: "Invoice collections (payments applied)",
        amount: collected,
        date: inv.invoice_date || inv.finalized_at || null,
        source: "live",
        reference: inv.invoice_number || inv.id,
        taxNote: "Derived from invoice payments_applied when payment rows are sparse",
      });
    }
  }

  for (const e of input.expenses) {
    if (e.approval_status && !["Approved", "Submitted"].includes(e.approval_status)) {
      // still include Approved primarily; allow Submitted for demo visibility
      if (e.approval_status !== "Approved") continue;
    }
    if (!inTaxYear(e.expense_date, input.taxYear)) continue;
    const amount = Number(e.amount || 0);
    if (!amount) continue;
    const categoryId = mapExpenseType(e.expense_type || "Other", e.description || "");
    items.push({
      id: `exp-${e.id}`,
      categoryId,
      description: e.description || e.expense_type || "Expense",
      amount,
      date: e.expense_date || null,
      source: "live",
      reference: e.id.slice(0, 8),
      taxNote:
        categoryId === "meals_50"
          ? "Mapped to business meals — typically 50% deductible when substantiated"
          : categoryId === "entertainment_0"
            ? "Mapped to entertainment — generally nondeductible"
            : undefined,
    });
  }

  const present = new Set(items.map((i) => i.categoryId));
  let demoIdx = 0;
  for (const demo of DEMO_FALLBACKS) {
    // Always ensure meals/entertainment/dues/insurance/office/payroll/trust have something
    const mustHave: TaxCategoryId[] = [
      "meals_50",
      "entertainment_0",
      "professional_dues",
      "insurance",
      "office_ops",
      "payroll_notes",
      "trust_memo",
    ];
    if (!present.has(demo.categoryId) && mustHave.includes(demo.categoryId)) {
      const { monthDay, ...rest } = demo;
      items.push({
        ...rest,
        id: `demo-${demoIdx++}`,
        date: `${input.taxYear}-${monthDay}`,
      });
      present.add(demo.categoryId);
    }
  }

  // If still no income at all, add demo income
  if (!items.some((i) => i.categoryId === "income_fees")) {
    items.push({
      id: "demo-income-1",
      categoryId: "income_fees",
      description: "Collected legal fees (demo fallback)",
      amount: 128500,
      date: `${input.taxYear}-12-15`,
      source: "demo",
      reference: "DEMO-INC-001",
      taxNote: "Demo fallback — replace with live collections when available",
    });
  }

  const order: TaxCategoryId[] = [
    "income_fees",
    "income_other",
    "meals_50",
    "entertainment_0",
    "travel",
    "professional_dues",
    "insurance",
    "office_ops",
    "payroll_notes",
    "trust_memo",
  ];

  return order
    .map((id) => {
      const meta = TAX_CATEGORY_META[id];
      const groupItems = items
        .filter((i) => i.categoryId === id)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const total = groupItems.reduce((s, i) => s + i.amount, 0);
      return {
        id,
        title: meta.title,
        summary: meta.summary,
        deductibilityHint: meta.deductibilityHint,
        items: groupItems,
        total,
      };
    })
    .filter((g) => g.items.length > 0);
}

export function formatTaxTotal(n: number) {
  return formatCurrency(n);
}
