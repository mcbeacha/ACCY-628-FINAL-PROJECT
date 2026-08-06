"use client";

import { PageHeader } from "@/components/PageHeader";
import { requiredApproverRole } from "@/lib/approval-tiers";
import { looksLikeDuplicate } from "@/lib/cost-calc";
import type { CostCategory, CostSource } from "@/lib/cost-types";
import {
  DEFAULT_FIRM_THRESHOLDS,
  getFirmThresholds,
  type FirmApprovalThresholds,
} from "@/lib/firm-thresholds";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ClientOpt = { id: string; client_number: string; organization_name: string | null; first_name: string | null; last_name: string | null };
type MatterOpt = {
  id: string;
  client_id: string;
  matter_number: string;
  matter_name: string;
  matter_status: string;
  billing_method?: string | null;
  practice_area?: string | null;
};
type EmployeeOpt = { id: string; full_name: string };

const ENTRY_SOURCES: CostSource[] = ["Manual Adjustment", "Travel", "Employee Labor"];

export function CostEntryForm({ userId, role }: { userId: string; role: UserRole }) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [clientId, setClientId] = useState("");
  const [matterId, setMatterId] = useState("");
  const [costSource, setCostSource] = useState<CostSource>("Manual Adjustment");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [closingAdjustment, setClosingAdjustment] = useState(false);
  const [thresholds, setThresholds] = useState<FirmApprovalThresholds>(DEFAULT_FIRM_THRESHOLDS);

  const canCloseAdjust = role === "managing_partner" || role === "billing_staff";
  const total = useMemo(() => {
    const q = Number(qty);
    const u = Number(unitCost);
    if (!Number.isFinite(q) || !Number.isFinite(u)) return 0;
    return Math.round(q * u * 100) / 100;
  }, [qty, unitCost]);

  const selectedMatter = matters.find((m) => m.id === matterId);
  const matterClosed =
    selectedMatter && ["Closed", "Canceled"].includes(selectedMatter.matter_status);

  const filteredMatters = useMemo(
    () => (clientId ? matters.filter((m) => m.client_id === clientId) : matters),
    [matters, clientId]
  );

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: c }, { data: cats }, { data: emps }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, client_number, organization_name, first_name, last_name")
          .order("client_number"),
        supabase.from("cost_categories").select("*").eq("active_status", true).order("category_name"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("role", ["managing_partner", "attorney", "paralegal", "billing_staff"])
          .eq("active_status", true)
          .order("full_name"),
      ]);
      setClients((c || []) as ClientOpt[]);
      setCategories((cats || []) as CostCategory[]);
      setEmployees((emps || []) as EmployeeOpt[]);

      let matterQuery = supabase
        .from("matters")
        .select("id, client_id, matter_number, matter_name, matter_status, billing_method, practice_area")
        .order("matter_number");

      if (role === "attorney" || role === "paralegal") {
        const { data: assigns } = await supabase
          .from("matter_assignments")
          .select("matter_id")
          .eq("user_id", userId)
          .eq("active_status", true);
        const ids = new Set((assigns || []).map((a) => a.matter_id));
        const { data: responsible } = await supabase
          .from("matters")
          .select("id")
          .eq("responsible_attorney_id", userId);
        (responsible || []).forEach((r) => ids.add(r.id));
        if (ids.size > 0) {
          matterQuery = matterQuery.in("id", [...ids]);
        } else {
          setMatters([]);
          return;
        }
      }

      const { data: m } = await matterQuery;
      setMatters((m || []) as MatterOpt[]);
      setThresholds(await getFirmThresholds(supabase));
    })();
  }, [userId, role]);

  async function save(e: FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const mid = String(fd.get("matter_id") || "");
    const cid = String(fd.get("client_id") || "");
    const costDate = String(fd.get("cost_date") || "");
    const categoryId = String(fd.get("cost_category_id") || "");
    const source = String(fd.get("cost_source") || "") as CostSource;
    const employeeId = String(fd.get("employee_id") || "") || null;
    const desc = String(fd.get("description") || "").trim();
    const receipt = String(fd.get("receipt_reference") || "").trim() || null;
    const reimbursable = fd.get("client_reimbursable") === "on";
    const expectedCharge = fd.get("expected_client_charge")
      ? Number(fd.get("expected_client_charge"))
      : reimbursable
        ? total
        : 0;
    const closingReason = String(fd.get("closing_adjustment_reason") || "").trim() || null;
    const isClosing = fd.get("is_closing_adjustment") === "on";

    if (!cid || !mid || !costDate || !categoryId) {
      setError("Client, matter, date, and category are required.");
      return;
    }
    if (!desc) {
      setError("Description is required.");
      return;
    }
    if (total <= 0) {
      setError("Total cost must be greater than zero.");
      return;
    }
    if (source === "Employee Labor" && !employeeId) {
      setError("Employee is required for Employee Labor costs.");
      return;
    }

    const matter = matters.find((m) => m.id === mid);
    if (matter && ["Closed", "Canceled"].includes(matter.matter_status)) {
      if (!canCloseAdjust) {
        setError("This matter is closed or canceled. Cost entry is not allowed.");
        return;
      }
      if (!isClosing || !closingReason) {
        setError("Closing adjustment with a reason is required for closed/canceled matters.");
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("matter_cost_entries")
      .select("matter_id, vendor_id, employee_id, cost_date, total_cost, description, receipt_reference")
      .eq("matter_id", mid);

    const candidate = {
      matter_id: mid,
      employee_id: employeeId,
      cost_date: costDate,
      total_cost: total,
      description: desc,
      receipt_reference: receipt,
    };
    const dup = (existing || []).some((row) =>
      looksLikeDuplicate(candidate, {
        matter_id: row.matter_id,
        employee_id: row.employee_id,
        cost_date: row.cost_date,
        total_cost: Number(row.total_cost),
        description: row.description,
        receipt_reference: row.receipt_reference,
      })
    );
    if (dup) {
      setWarning(
        "A possible duplicate cost entry was found on this matter. Review before submitting."
      );
    }

    if (total >= thresholds.routineExpenseCostMp) {
      setWarning(
        (prev) =>
          (prev ? `${prev} ` : "") +
          `Amount is ${formatCurrency(thresholds.routineExpenseCostMp)}+ and will be flagged for extra review.`
      );
    }

    const decision = submit
      ? requiredApproverRole({
          kind: "cost",
          matter: selectedMatter,
          amount: total,
          thresholds,
        })
      : null;

    const payload = {
      matter_id: mid,
      client_id: cid,
      cost_date: costDate,
      cost_category_id: categoryId,
      cost_source: source,
      employee_id: employeeId,
      description: desc,
      quantity: Number(qty) || 1,
      unit_cost: Number(unitCost) || 0,
      total_cost: total,
      client_reimbursable: reimbursable,
      expected_client_charge: expectedCharge,
      approval_status: submit ? "Submitted" : "Draft",
      billing_status: reimbursable ? "Unbilled" : "Not Billable",
      payment_status: "Not Applicable",
      receipt_reference: receipt,
      is_closing_adjustment: isClosing,
      closing_adjustment_reason: isClosing ? closingReason : null,
      created_by: userId,
      submitted_by: submit ? userId : null,
      submitted_at: submit ? new Date().toISOString() : null,
      required_approver_role: submit ? decision!.requiredRole : null,
    };

    const { data, error: insErr } = await supabase
      .from("matter_cost_entries")
      .insert(payload)
      .select("id")
      .single();

    if (insErr) {
      setError(insErr.message);
      setLoading(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: submit ? "cost_submitted" : "cost_created",
      record_type: "matter_cost_entry",
      record_id: data.id,
      matter_id: mid,
      client_id: cid,
      action_description: submit
        ? `Cost entry submitted for approval (${formatCurrency(total)}).`
        : `Cost entry saved as draft (${formatCurrency(total)}).`,
      performed_by: userId,
    });

    setMessage(submit ? "Cost submitted for approval." : "Draft cost saved.");
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    setClientId("");
    setMatterId("");
    setQty("1");
    setUnitCost("");
    setCostSource("Manual Adjustment");
    setClosingAdjustment(false);
  }

  return (
    <>
      <PageHeader
        title="Cost Entry"
        description="Record matter costs — manual adjustments, travel, or employee labor."
        actions={
          <Link href="/costs/review" className="btn btn-ghost btn-sm">
            Cost approval
          </Link>
        }
      />

      <form
        className="card bg-base-100 border border-base-300 shadow-sm max-w-3xl"
        onSubmit={(e) => save(e, false)}
      >
        <div className="card-body space-y-4">
          <div className="form-grid">
            <label className="label-cell" htmlFor="client_id">
              Client *
            </label>
            <div className="field-cell">
              <select
                id="client_id"
                name="client_id"
                className="select select-bordered w-full"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setMatterId("");
                }}
              >
                <option value="" disabled>
                  Select client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_number} · {c.organization_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="matter_id">
              Matter *
            </label>
            <div className="field-cell">
              <select
                id="matter_id"
                name="matter_id"
                className="select select-bordered w-full"
                required
                value={matterId}
                onChange={(e) => setMatterId(e.target.value)}
              >
                <option value="" disabled>
                  Select matter
                </option>
                {filteredMatters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_number} · {m.matter_name}
                    {["Closed", "Canceled"].includes(m.matter_status) ? ` (${m.matter_status})` : ""}
                  </option>
                ))}
              </select>
              {matterClosed && (
                <p className="text-xs text-warning mt-1">
                  Matter is {selectedMatter?.matter_status}. Closing adjustment required.
                </p>
              )}
            </div>

            <label className="label-cell" htmlFor="cost_date">
              Cost date *
            </label>
            <div className="field-cell">
              <input id="cost_date" name="cost_date" type="date" className="input input-bordered w-full" required />
            </div>

            <label className="label-cell" htmlFor="cost_source">
              Source *
            </label>
            <div className="field-cell">
              <select
                id="cost_source"
                name="cost_source"
                className="select select-bordered w-full"
                value={costSource}
                onChange={(e) => setCostSource(e.target.value as CostSource)}
              >
                {ENTRY_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="cost_category_id">
              Category *
            </label>
            <div className="field-cell">
              <select id="cost_category_id" name="cost_category_id" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.category_name} ({cat.category_group})
                  </option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="employee_id">
              Employee {costSource === "Employee Labor" ? "*" : ""}
            </label>
            <div className="field-cell">
              <select id="employee_id" name="employee_id" className="select select-bordered w-full" defaultValue="">
                <option value="">None</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="description">
              Description *
            </label>
            <div className="field-cell">
              <textarea id="description" name="description" className="textarea textarea-bordered w-full" rows={3} required />
            </div>

            <label className="label-cell" htmlFor="quantity">
              Quantity *
            </label>
            <div className="field-cell">
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="0.0001"
                step="0.0001"
                className="input input-bordered w-full"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>

            <label className="label-cell" htmlFor="unit_cost">
              Unit cost *
            </label>
            <div className="field-cell">
              <input
                id="unit_cost"
                name="unit_cost"
                type="number"
                min="0.01"
                step="0.01"
                className="input input-bordered w-full"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>

            <span className="label-cell">Total</span>
            <div className="field-cell">
              <p className="font-semibold">
                {formatCurrency(total)}
                {total >= thresholds.routineExpenseCostMp && (
                  <span className="badge badge-warning badge-sm ml-2">High value</span>
                )}
              </p>
            </div>

            <span className="label-cell">Reimbursable</span>
            <div className="field-cell">
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" name="client_reimbursable" className="checkbox checkbox-sm" defaultChecked />
                <span className="label-text">Client reimbursable</span>
              </label>
            </div>

            <label className="label-cell" htmlFor="expected_client_charge">
              Expected client charge
            </label>
            <div className="field-cell">
              <input
                id="expected_client_charge"
                name="expected_client_charge"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                placeholder={total > 0 ? String(total) : "Same as total if reimbursable"}
              />
            </div>

            <label className="label-cell" htmlFor="receipt_reference">
              Receipt reference
            </label>
            <div className="field-cell">
              <input id="receipt_reference" name="receipt_reference" className="input input-bordered w-full" />
            </div>

            {canCloseAdjust && matterClosed && (
              <>
                <span className="label-cell">Closing adjustment</span>
                <div className="field-cell">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      name="is_closing_adjustment"
                      className="checkbox checkbox-sm"
                      checked={closingAdjustment}
                      onChange={(e) => setClosingAdjustment(e.target.checked)}
                    />
                    <span className="label-text">This is a closing adjustment</span>
                  </label>
                </div>
                {closingAdjustment && (
                  <>
                    <label className="label-cell" htmlFor="closing_adjustment_reason">
                      Reason *
                    </label>
                    <div className="field-cell">
                      <input
                        id="closing_adjustment_reason"
                        name="closing_adjustment_reason"
                        className="input input-bordered w-full"
                        required={closingAdjustment}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {warning && (
            <div className="alert alert-warning text-sm">
              <span>{warning}</span>
            </div>
          )}
          {error && (
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="alert alert-success text-sm">
              <span>{message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <button type="submit" className="btn btn-ghost" disabled={loading}>
              {loading ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={(ev) => {
                const form = (ev.target as HTMLElement).closest("form");
                if (form)
                  save(
                    { preventDefault() {}, currentTarget: form, target: form } as unknown as FormEvent<HTMLFormElement>,
                    true
                  );
              }}
            >
              Submit for Approval
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
