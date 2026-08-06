/**
 * Mocked self-tests for Prepare Invoice matter helpers (no database).
 * Run: npx --yes tsx src/lib/billing/prepare-invoice-matters.selftest.ts
 */
import assert from "node:assert/strict";
import {
  canEnableCreateDraftInvoice,
  formatPrepareInvoiceMatterOption,
  hasEligibleInvoiceActivity,
  INVALID_MATTER_STATUS_APPROVED,
  isMatterStatusEligibleForPrepareInvoice,
  isOrdinaryInvoiceMethod,
  PREPARE_INVOICE_MATTER_STATUSES,
  prepareInvoiceClientLabel,
} from "./prepare-invoice-matters";

function testStatuses() {
  assert.ok(PREPARE_INVOICE_MATTER_STATUSES.includes("Active"));
  assert.ok(PREPARE_INVOICE_MATTER_STATUSES.includes("On Hold"));
  assert.ok(PREPARE_INVOICE_MATTER_STATUSES.includes("Closing"));
  assert.ok(PREPARE_INVOICE_MATTER_STATUSES.includes("Closed"));
  assert.ok(
    !(PREPARE_INVOICE_MATTER_STATUSES as readonly string[]).includes(
      INVALID_MATTER_STATUS_APPROVED
    ),
    '"Approved" must not be treated as a matter_status'
  );
  assert.equal(isMatterStatusEligibleForPrepareInvoice("On Hold"), true);
  assert.equal(isMatterStatusEligibleForPrepareInvoice("Approved"), false);
  assert.equal(isMatterStatusEligibleForPrepareInvoice("Active"), true);
}

function testMethods() {
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Hourly" }),
    true
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Retainer-Funded Hourly" }),
    true
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Fixed Fee", fixed_fee_amount: 5000 }),
    true
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Fixed Fee", fixed_fee_amount: 0 }),
    false
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Hybrid", hourly_rate: 250 }),
    true
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Hybrid", fixed_fee_amount: 1000 }),
    true
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Hybrid" }),
    false
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Contingency" }),
    false
  );
  assert.equal(
    isOrdinaryInvoiceMethod({ billing_method: "Pro Bono" }),
    false
  );
}

function testLabels() {
  assert.equal(
    prepareInvoiceClientLabel({
      client_type: "Individual",
      first_name: "Elena",
      last_name: "Cruz",
    }),
    "Elena Cruz"
  );
  assert.equal(
    prepareInvoiceClientLabel({
      client_type: "Business",
      organization_name: "Harbor Logistics",
      first_name: null,
      last_name: null,
    }),
    "Harbor Logistics"
  );
  assert.equal(
    prepareInvoiceClientLabel({
      client_type: "Business",
      organization_name: null,
      first_name: "Ada",
      last_name: "Lovelace",
    }),
    "Ada Lovelace"
  );

  const option = formatPrepareInvoiceMatterOption({
    matter_number: "MT-2002",
    matter_name: "Vendor Dispute",
    client: {
      client_type: "Business",
      organization_name: "Harbor Logistics",
    },
  });
  assert.equal(option, "MT-2002 — Harbor Logistics — Vendor Dispute");
  // Formatter is field-driven — no hardcoded Harbor ID in the helper module.
  assert.ok(!option.includes("bbbbbbbb"));
}

function testDraftGating() {
  const base = {
    matterSelected: true,
    billingMethod: "Hourly" as string,
    invoiceDate: "2026-08-06",
    dueDate: "2026-09-05",
    invoiceTotal: 100,
    hasSelectedTimeOrExpense: true,
    fixedFeeLineAmount: 0,
  };
  assert.equal(canEnableCreateDraftInvoice(base), true);
  assert.equal(canEnableCreateDraftInvoice({ ...base, matterSelected: false }), false);
  assert.equal(canEnableCreateDraftInvoice({ ...base, invoiceTotal: 0 }), false);
  assert.equal(
    canEnableCreateDraftInvoice({
      ...base,
      hasSelectedTimeOrExpense: false,
      fixedFeeLineAmount: 0,
    }),
    false
  );
  assert.equal(
    canEnableCreateDraftInvoice({
      ...base,
      hasSelectedTimeOrExpense: false,
      fixedFeeLineAmount: 250,
      invoiceTotal: 250,
      billingMethod: "Fixed Fee",
      fixedFeeAmountOnMatter: 250,
    }),
    true
  );
  assert.equal(
    canEnableCreateDraftInvoice({
      ...base,
      billingMethod: "Contingency",
    }),
    false
  );
  assert.equal(
    canEnableCreateDraftInvoice({
      ...base,
      dueDate: "2026-08-01",
    }),
    false
  );
}

function testActivityMessage() {
  assert.equal(
    hasEligibleInvoiceActivity({ timeCount: 0, expenseCount: 0, fixedFeeLineAmount: 0 }),
    false
  );
  assert.equal(
    hasEligibleInvoiceActivity({ timeCount: 1, expenseCount: 0, fixedFeeLineAmount: 0 }),
    true
  );
  assert.equal(
    hasEligibleInvoiceActivity({ timeCount: 0, expenseCount: 0, fixedFeeLineAmount: 100 }),
    true
  );
}

testStatuses();
testMethods();
testLabels();
testDraftGating();
testActivityMessage();
console.log("prepare-invoice-matters selftests: ok");
