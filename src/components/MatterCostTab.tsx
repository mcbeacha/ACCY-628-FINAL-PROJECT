"use client";

import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import {
  budgetBadgeClass,
  budgetFlag,
  budgetRemaining,
  budgetUsedPercentage,
  summarizeMatterCosts,
} from "@/lib/cost-calc";
import {
  RESOURCE_ASSIGNMENT_ROLES,
  type MatterResource,
  type UnifiedCostRow,
  type Vendor,
} from "@/lib/cost-types";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Matter, Profile, UserRole } from "@/lib/types";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MatterWithBudget = Matter & {
  planned_labor_cost?: number | null;
  planned_vendor_cost?: number | null;
  planned_direct_expense_cost?: number | null;
  planned_allocated_cost?: number | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_total: number;
  payments_applied: number;
  retainer_applied: number;
  invoice_status: string;
  finalized_at: string | null;
};

type Props = {
  matterId: string;
  role: UserRole;
  userId: string;
  clientId: string;
  matter: MatterWithBudget;
};

export function MatterCostTab({ matterId, role, userId, clientId, matter }: Props) {
  const isClient = role === "client";
  const canAssign = role === "managing_partner" || role === "attorney";
  const showInternal = !isClient;

  const [resources, setResources] = useState<MatterResource[]>([]);
  const [costs, setCosts] = useState<UnifiedCostRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignType, setAssignType] = useState<"employee" | "vendor">("employee");

  async function load() {
    const supabase = createClient();
    setLoading(true);

    const [{ data: res }, { data: unified }, { data: inv }] = await Promise.all([
      supabase
        .from("matter_resources")
        .select("*, profiles(*), vendors(*)")
        .eq("matter_id", matterId)
        .eq("active_status", true)
        .order("assigned_date", { ascending: false }),
      supabase.from("matter_costs_unified").select("*").eq("matter_id", matterId),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, invoice_total, payments_applied, retainer_applied, invoice_status, finalized_at"
        )
        .eq("matter_id", matterId)
        .order("invoice_date", { ascending: false }),
    ]);

    setResources((res || []) as MatterResource[]);
    setCosts((unified || []) as UnifiedCostRow[]);
    setInvoices((inv || []) as InvoiceRow[]);

    if (canAssign) {
      const [{ data: s }, { data: v }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .in("role", ["managing_partner", "attorney", "paralegal", "billing_staff"])
          .eq("active_status", true)
          .order("full_name"),
        supabase
          .from("vendors")
          .select("*")
          .eq("active_status", true)
          .eq("approved_vendor_status", true)
          .order("vendor_name"),
      ]);
      setStaff((s || []) as Profile[]);
      setVendors((v || []) as Vendor[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  const visibleCosts = useMemo(() => {
    if (isClient) {
      return costs.filter(
        (c) =>
          c.client_reimbursable &&
          c.approval_status === "Approved" &&
          (c.billing_status === "Billed" || c.billing_status === "Selected for Billing")
      );
    }
    return costs;
  }, [costs, isClient]);

  const filteredCosts = useMemo(() => {
    return visibleCosts.filter((c) => {
      if (filterSource && c.cost_source !== filterSource) return false;
      if (filterStatus && c.approval_status !== filterStatus) return false;
      return true;
    });
  }, [visibleCosts, filterSource, filterStatus]);

  const summary = useMemo(
    () => summarizeMatterCosts(showInternal ? costs.filter((c) => c.approval_status === "Approved") : visibleCosts),
    [costs, visibleCosts, showInternal]
  );

  const budget = matter.matter_budget;
  const flag = budgetFlag(summary.totalMatterCost, budget);
  const usedPct = budgetUsedPercentage(summary.totalMatterCost, budget);
  const remaining = budgetRemaining(summary.totalMatterCost, budget);

  const finalizedInvoices = invoices.filter(
    (i) =>
      i.finalized_at &&
      !["Canceled", "Draft"].includes(i.invoice_status)
  );
  const invoicedTotal = finalizedInvoices.reduce(
    (s, i) => s + Number(i.invoice_total),
    0
  );
  const collectedTotal = finalizedInvoices.reduce(
    (s, i) => s + Number(i.payments_applied || 0) + Number(i.retainer_applied || 0),
    0
  );

  const resourcePlannedCost = resources.reduce((s, r) => s + (Number(r.planned_cost) || 0), 0);
  const resourcePlannedHours = resources.reduce((s, r) => s + (Number(r.planned_hours) || 0), 0);

  async function assignResource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canAssign) return;
    const fd = new FormData(e.currentTarget);
    const assignment_role = String(fd.get("assignment_role") || "");
    const employee_id = assignType === "employee" ? String(fd.get("employee_id") || "") || null : null;
    const vendor_id = assignType === "vendor" ? String(fd.get("vendor_id") || "") || null : null;

    if (!assignment_role || (!employee_id && !vendor_id)) {
      setError("Assignment role and resource are required.");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    const resource_type =
      assignType === "vendor"
        ? "Vendor"
        : staff.find((s) => s.id === employee_id)?.role === "paralegal"
          ? "Paralegal"
          : "Attorney";

    const { error: insErr } = await supabase.from("matter_resources").insert({
      matter_id: matterId,
      resource_type,
      employee_id,
      vendor_id,
      assignment_role,
      assigned_date: new Date().toISOString().slice(0, 10),
      planned_hours: fd.get("planned_hours") ? Number(fd.get("planned_hours")) : null,
      planned_cost: fd.get("planned_cost") ? Number(fd.get("planned_cost")) : null,
      approved_budget: fd.get("approved_budget") ? Number(fd.get("approved_budget")) : null,
      active_status: true,
      assigned_by: userId,
    });

    if (insErr) {
      setError(
        insErr.message.includes("matter_resources_active")
          ? "This resource is already assigned to this matter."
          : insErr.message
      );
      setBusy(false);
      return;
    }

    setMessage("Resource assigned.");
    setBusy(false);
    (e.target as HTMLFormElement).reset();
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="alert alert-success text-sm">
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}

      {showInternal && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body py-4">
                <p className="text-xs opacity-60">Total matter cost</p>
                <p className="font-semibold text-lg">{formatCurrency(summary.totalMatterCost)}</p>
              </div>
            </div>
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body py-4">
                <p className="text-xs opacity-60">Expected client charges</p>
                <p className="font-semibold text-lg">{formatCurrency(summary.expectedClientCharge)}</p>
              </div>
            </div>
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body py-4">
                <p className="text-xs opacity-60">Budget</p>
                <p className="font-semibold text-lg flex items-center gap-2">
                  {formatCurrency(budget)}
                  <span className={`badge badge-sm ${budgetBadgeClass(flag)}`}>{flag}</span>
                </p>
                {usedPct != null && (
                  <p className="text-xs opacity-60 mt-1">
                    {usedPct.toFixed(0)}% used · {formatCurrency(remaining)} remaining
                  </p>
                )}
              </div>
            </div>
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body py-4">
                <p className="text-xs opacity-60">Invoiced (billing)</p>
                <p className="font-semibold text-lg">{formatCurrency(invoicedTotal)}</p>
                <p className="text-xs opacity-60 mt-1">{invoices.length} invoice(s)</p>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Resource summary</h2>
              <div className="grid sm:grid-cols-3 gap-3 text-sm mb-4">
                <div>
                  <p className="opacity-60">Active resources</p>
                  <p className="font-medium">{resources.length}</p>
                </div>
                <div>
                  <p className="opacity-60">Planned hours</p>
                  <p className="font-medium">{resourcePlannedHours.toFixed(1)}</p>
                </div>
                <div>
                  <p className="opacity-60">Planned cost</p>
                  <p className="font-medium">{formatCurrency(resourcePlannedCost)}</p>
                </div>
              </div>
              {resources.length === 0 ? (
                <EmptyState title="No resources assigned." />
              ) : (
                <div className="table-wrap">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Role</th>
                        <th>Assigned</th>
                        <th>Planned hrs</th>
                        <th>Planned cost</th>
                        <th>Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((r) => (
                        <tr key={r.id}>
                          <td className="text-sm">
                            {r.profiles?.full_name || r.vendors?.vendor_name || "—"}
                          </td>
                          <td className="text-sm">{r.assignment_role}</td>
                          <td className="text-sm">{formatDate(r.assigned_date)}</td>
                          <td className="text-sm">{r.planned_hours ?? "—"}</td>
                          <td className="text-sm">{formatCurrency(r.planned_cost)}</td>
                          <td className="text-sm">{formatCurrency(r.approved_budget)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Cost breakdown</h2>
              <dl className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                <div>
                  <dt className="opacity-60">Labor</dt>
                  <dd className="font-medium">{formatCurrency(summary.laborCost)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Vendor</dt>
                  <dd className="font-medium">{formatCurrency(summary.vendorCost)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Direct</dt>
                  <dd className="font-medium">{formatCurrency(summary.directExpenses)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Allocated</dt>
                  <dd className="font-medium">{formatCurrency(summary.allocatedCost)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Reimbursable</dt>
                  <dd className="font-medium">{formatCurrency(summary.reimbursableExpenses)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Non-reimb.</dt>
                  <dd className="font-medium">{formatCurrency(summary.nonreimbursableExpenses)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Billing comparison</h2>
              <dl className="grid sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="opacity-60">Billable value (labor)</dt>
                  <dd className="font-medium">{formatCurrency(summary.billableValue)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Expected charges</dt>
                  <dd className="font-medium">{formatCurrency(summary.expectedClientCharge)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Invoiced (finalized)</dt>
                  <dd className="font-medium">{formatCurrency(invoicedTotal)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Collected</dt>
                  <dd className="font-medium">{formatCurrency(collectedTotal)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Total cost</dt>
                  <dd className="font-medium">{formatCurrency(summary.totalMatterCost)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">
                    {invoicedTotal > 0
                      ? "Estimated matter profit"
                      : "Estimated profit based on current billings"}
                  </dt>
                  <dd className="font-medium">
                    {formatCurrency(
                      (invoicedTotal > 0 ? invoicedTotal : summary.expectedClientCharge) -
                        summary.totalMatterCost
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Unbilled gap</dt>
                  <dd className="font-medium">
                    {formatCurrency(Math.max(0, summary.expectedClientCharge - invoicedTotal))}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </>
      )}

      {isClient && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Your charges</h2>
            <p className="text-sm opacity-70">
              Reimbursable costs that have been approved and billed or selected for billing.
            </p>
          </div>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h2 className="card-title text-base">{isClient ? "Charge detail" : "Cost detail"}</h2>
            {showInternal && (
              <div className="flex flex-wrap gap-2">
                <select
                  className="select select-bordered select-xs"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                >
                  <option value="">All sources</option>
                  {[...new Set(costs.map((c) => c.cost_source))].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="select select-bordered select-xs"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {["Approved", "Submitted", "Draft", "Rejected"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {filteredCosts.length === 0 ? (
            <EmptyState
              title={isClient ? "No client-visible charges yet." : "No cost entries for this matter."}
            />
          ) : (
            <div className="table-wrap mt-3">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    {!isClient && <th>Category</th>}
                    <th>Description</th>
                    <th>Amount</th>
                    {!isClient && <th>Charge</th>}
                    {!isClient && <th>Status</th>}
                    {isClient && <th>Billing</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredCosts.map((c) => (
                    <tr key={`${c.source_table}-${c.id}`}>
                      <td className="text-sm">{formatDate(c.cost_date)}</td>
                      <td className="text-sm">{isClient ? "Charge" : c.cost_source}</td>
                      {!isClient && <td className="text-sm">{c.category_name}</td>}
                      <td className="text-sm max-w-[14rem]">{c.description}</td>
                      <td className="text-sm">{formatCurrency(Number(c.total_cost))}</td>
                      {!isClient && (
                        <td className="text-sm">{formatCurrency(Number(c.expected_client_charge))}</td>
                      )}
                      {!isClient && (
                        <td>
                          <StatusBadge status={c.approval_status} />
                        </td>
                      )}
                      {isClient && (
                        <td>
                          <StatusBadge status={c.billing_status} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {canAssign && showInternal && (
        <form onSubmit={assignResource} className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Assign resource</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn btn-xs ${assignType === "employee" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setAssignType("employee")}
              >
                Employee
              </button>
              <button
                type="button"
                className={`btn btn-xs ${assignType === "vendor" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setAssignType("vendor")}
              >
                Approved vendor
              </button>
            </div>
            <div className="form-grid">
              {assignType === "employee" ? (
                <>
                  <label className="label-cell" htmlFor="employee_id">
                    Employee *
                  </label>
                  <div className="field-cell">
                    <select id="employee_id" name="employee_id" className="select select-bordered w-full" required defaultValue="">
                      <option value="" disabled>
                        Select
                      </option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <label className="label-cell" htmlFor="vendor_id">
                    Vendor *
                  </label>
                  <div className="field-cell">
                    <select id="vendor_id" name="vendor_id" className="select select-bordered w-full" required defaultValue="">
                      <option value="" disabled>
                        Select
                      </option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendor_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <label className="label-cell" htmlFor="assignment_role">
                Assignment role *
              </label>
              <div className="field-cell">
                <select id="assignment_role" name="assignment_role" className="select select-bordered w-full" required defaultValue="Supporting Attorney">
                  {RESOURCE_ASSIGNMENT_ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <label className="label-cell" htmlFor="planned_hours">
                Planned hours
              </label>
              <div className="field-cell">
                <input id="planned_hours" name="planned_hours" type="number" min="0" step="0.1" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="planned_cost">
                Planned cost
              </label>
              <div className="field-cell">
                <input id="planned_cost" name="planned_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="approved_budget">
                Approved budget
              </label>
              <div className="field-cell">
                <input id="approved_budget" name="approved_budget" type="number" min="0" step="0.01" className="input input-bordered w-full" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm w-fit" disabled={busy}>
              Assign resource
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
