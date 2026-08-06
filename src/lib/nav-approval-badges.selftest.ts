/**
 * Smoke-check actionable nav approval badge filtering by role (no database).
 * Run: npx --yes tsx src/lib/nav-approval-badges.selftest.ts
 */
import assert from "node:assert/strict";
import { viewerCanApprove } from "./approval-tiers";
import { APPROVAL_BADGE_HREFS } from "./nav-approval-badges";
import { calcBillableAmount } from "./phase2-types";
import {
  canApproveExpenses,
  canApproveInvoices,
  canApproveMatterCosts,
  canApproveMatters,
  canApproveTime,
  canApproveVendors,
  canApproveWriteOffs,
} from "./permissions";
import type { UserRole } from "./types";

type Matter = {
  billing_method: string | null;
  practice_area: string | null;
  responsible_attorney_id: string | null;
};

type Fixture = {
  expenses: Array<{ amount: number; created_by: string | null; matter: Matter }>;
  costs: Array<{ total_cost: number; created_by: string | null; matter: Matter }>;
  time: Array<{
    hours: number;
    billing_rate: number;
    billable_status: string;
    matter: Matter;
  }>;
  allocations: number;
  vendors: number;
  invoices: Array<{ amount: number; created_by: string | null; matter: Matter }>;
  writeOffs: Array<{ amount: number; matter: Matter }>;
  matters: Matter[];
  marketing: number;
};

function countFor(role: UserRole, userId: string, rows: Fixture) {
  const next: Record<string, number> = {};
  if (canApproveExpenses(role)) {
    next["/expenses/review"] = rows.expenses.filter((r) =>
      viewerCanApprove({
        kind: "expense",
        viewerRole: role,
        viewerId: userId,
        matter: r.matter,
        amount: r.amount,
        preparerId: r.created_by,
      }).allowed
    ).length;
  }
  if (canApproveMatterCosts(role)) {
    next["/costs/review"] = rows.costs.filter((r) =>
      viewerCanApprove({
        kind: "cost",
        viewerRole: role,
        viewerId: userId,
        matter: r.matter,
        amount: r.total_cost,
        preparerId: r.created_by,
      }).allowed
    ).length;
  }
  if (canApproveTime(role)) {
    next["/time/review"] = rows.time.filter((r) =>
      viewerCanApprove({
        kind: "time",
        viewerRole: role,
        viewerId: userId,
        matter: r.matter,
        amount: calcBillableAmount(
          r.hours,
          r.billing_rate,
          r.billable_status
        ),
      }).allowed
    ).length;
  }
  if (role === "managing_partner") next["/costs/allocations"] = rows.allocations;
  if (canApproveVendors(role)) next["/vendors"] = rows.vendors;
  let inv = 0;
  if (canApproveInvoices(role)) {
    inv = rows.invoices.filter((r) =>
      viewerCanApprove({
        kind: "invoice",
        viewerRole: role,
        viewerId: userId,
        matter: r.matter,
        amount: r.amount,
        preparerId: r.created_by,
      }).allowed
    ).length;
  }
  let wo = 0;
  if (canApproveWriteOffs(role)) {
    wo = rows.writeOffs.filter((r) =>
      viewerCanApprove({
        kind: "write_off",
        viewerRole: role,
        viewerId: userId,
        matter: r.matter,
        amount: r.amount,
      }).allowed
    ).length;
  }
  if (canApproveInvoices(role) || canApproveWriteOffs(role)) {
    next["/invoices"] = inv + wo;
  }
  if (canApproveMatters(role)) {
    next["/matters"] = rows.matters.filter((m) =>
      viewerCanApprove({
        kind: "matter_engagement",
        viewerRole: role,
        viewerId: userId,
        matter: m,
      }).allowed
    ).length;
  }
  if (role === "managing_partner") next["/marketing"] = rows.marketing;
  next["/inbox"] = APPROVAL_BADGE_HREFS.reduce(
    (sum, href) => sum + (next[href] ?? 0),
    0
  );
  return next;
}

const attorneyId = "att-1";
const billingId = "bill-1";
const otherAtt = "att-2";
const routine: Matter = {
  billing_method: "Hourly",
  practice_area: "Corporate",
  responsible_attorney_id: attorneyId,
};
const otherRoutine: Matter = {
  ...routine,
  responsible_attorney_id: otherAtt,
};
const contingency: Matter = {
  billing_method: "Contingency",
  practice_area: "Personal Injury",
  responsible_attorney_id: attorneyId,
};

const fixture: Fixture = {
  expenses: [
    { amount: 100, created_by: billingId, matter: routine },
    { amount: 100, created_by: "other", matter: routine },
    { amount: 50000, created_by: "other", matter: contingency },
  ],
  costs: [
    { total_cost: 50, created_by: billingId, matter: routine },
    { total_cost: 50, created_by: "other", matter: routine },
  ],
  time: [
    {
      hours: 1,
      billing_rate: 300,
      billable_status: "Billable",
      matter: routine,
    },
    {
      hours: 2,
      billing_rate: 300,
      billable_status: "Billable",
      matter: otherRoutine,
    },
  ],
  allocations: 2,
  vendors: 3,
  invoices: [
    { amount: 1000, created_by: billingId, matter: routine },
    { amount: 1000, created_by: "other", matter: routine },
    { amount: 100000, created_by: "other", matter: contingency },
  ],
  writeOffs: [{ amount: 200, matter: routine }],
  matters: [routine, contingency, otherRoutine],
  marketing: 4,
};

const billing = countFor("billing_staff", billingId, fixture);
assert.equal(billing["/expenses/review"], 1, "billing expenses");
assert.equal(billing["/costs/review"], 1, "billing costs");
assert.equal(billing["/time/review"], undefined, "billing no time");
assert.equal(billing["/costs/allocations"], undefined);
assert.equal(billing["/vendors"], undefined);
assert.equal(billing["/matters"], undefined);
assert.equal(billing["/marketing"], undefined);
assert.equal(billing["/invoices"], 1, "billing invoices");
assert.equal(
  billing["/inbox"],
  (billing["/expenses/review"] ?? 0) +
    (billing["/costs/review"] ?? 0) +
    (billing["/invoices"] ?? 0)
);

const mp = countFor("managing_partner", "mp-1", fixture);
assert.equal(mp["/expenses/review"], 3, "mp expenses");
assert.equal(mp["/time/review"], 2, "mp time");
assert.equal(mp["/vendors"], 3, "mp vendors");
assert.equal(mp["/costs/allocations"], 2, "mp allocations");
assert.equal(mp["/marketing"], 4, "mp marketing");
assert.equal(mp["/invoices"], 4, "mp invoices+writeoffs");
assert.equal(mp["/matters"], 3, "mp matters");

const att = countFor("attorney", attorneyId, fixture);
assert.equal(att["/expenses/review"], undefined, "attorney no expenses");
assert.equal(att["/costs/review"], undefined, "attorney no costs");
assert.equal(att["/time/review"], 1, "attorney time (responsible only)");
assert.equal(att["/matters"], 1, "attorney routine responsible matter only");
assert.equal(
  att["/inbox"],
  (att["/time/review"] ?? 0) + (att["/matters"] ?? 0),
  "attorney inbox sum"
);

console.log("nav-approval-badges.selftest: all passed");
