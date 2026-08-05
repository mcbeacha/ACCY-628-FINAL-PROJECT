"use client";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import {
  type AllocationMethod,
  type CostAllocation,
  type CostCategory,
} from "@/lib/cost-types";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MatterOpt = { id: string; matter_number: string; matter_name: string; client_id: string };

type LineDraft = {
  matter_id: string;
  allocation_amount: string;
  allocation_percent: string;
  selected: boolean;
};

export function AllocationsClient({
  userId,
  canApprove,
}: {
  userId: string;
  canApprove: boolean;
}) {
  const [allocations, setAllocations] = useState<CostAllocation[]>([]);
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [method, setMethod] = useState<AllocationMethod>("Equal");
  const [sharedAmount, setSharedAmount] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: allocs }, { data: m }, { data: cats }] = await Promise.all([
      supabase
        .from("cost_allocations")
        .select("*, cost_allocation_lines(*)")
        .order("allocation_date", { ascending: false }),
      supabase
        .from("matters")
        .select("id, matter_number, matter_name, client_id")
        .eq("matter_status", "Active")
        .order("matter_number"),
      supabase
        .from("cost_categories")
        .select("*")
        .eq("category_group", "Allocated Costs")
        .eq("active_status", true),
    ]);
    setAllocations((allocs || []) as CostAllocation[]);
    setMatters((m || []) as MatterOpt[]);
    setCategories((cats || []) as CostCategory[]);
    if (lines.length === 0 && m?.length) {
      setLines(
        (m as MatterOpt[]).map((mat) => ({
          matter_id: mat.id,
          allocation_amount: "",
          allocation_percent: "",
          selected: false,
        }))
      );
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shared = Number(sharedAmount) || 0;
  const selectedLines = lines.filter((l) => l.selected);

  const computedLines = useMemo(() => {
    const n = selectedLines.length;
    if (!shared || n === 0) return selectedLines;
    if (method === "Equal") {
      const each = Math.round((shared / n) * 100) / 100;
      return selectedLines.map((l, i) => ({
        ...l,
        allocation_amount: String(i === n - 1 ? shared - each * (n - 1) : each),
      }));
    }
    return selectedLines;
  }, [selectedLines, method, shared]);

  function toggleMatter(matterId: string, on: boolean) {
    setLines((prev) =>
      prev.map((l) => (l.matter_id === matterId ? { ...l, selected: on } : l))
    );
  }

  function updateLine(matterId: string, field: "allocation_amount" | "allocation_percent", value: string) {
    setLines((prev) =>
      prev.map((l) => (l.matter_id === matterId ? { ...l, [field]: value } : l))
    );
  }

  function validateLines(): string | null {
    if (shared <= 0) return "Shared cost amount must be greater than zero.";
    if (selectedLines.length === 0) return "Select at least one matter.";

    if (method === "Percentage") {
      const sum = selectedLines.reduce((s, l) => s + (Number(l.allocation_percent) || 0), 0);
      if (Math.abs(sum - 100) > 0.01) return "Allocation percentages must sum to 100%.";
    }
    if (method === "Manual") {
      const sum = selectedLines.reduce((s, l) => s + (Number(l.allocation_amount) || 0), 0);
      if (Math.abs(sum - shared) > 0.01) return "Manual amounts must equal the shared cost amount.";
    }
    return null;
  }

  function resolveAmounts(): { matter_id: string; amount: number; percent: number | null }[] {
    const n = selectedLines.length;
    if (method === "Equal") {
      const each = Math.round((shared / n) * 100) / 100;
      return selectedLines.map((l, i) => ({
        matter_id: l.matter_id,
        amount: i === n - 1 ? shared - each * (n - 1) : each,
        percent: Math.round((100 / n) * 100) / 100,
      }));
    }
    if (method === "Percentage") {
      return selectedLines.map((l) => {
        const pct = Number(l.allocation_percent) || 0;
        return {
          matter_id: l.matter_id,
          amount: Math.round(shared * (pct / 100) * 100) / 100,
          percent: pct,
        };
      });
    }
    return selectedLines.map((l) => ({
      matter_id: l.matter_id,
      amount: Number(l.allocation_amount) || 0,
      percent: shared > 0 ? ((Number(l.allocation_amount) || 0) / shared) * 100 : null,
    }));
  }

  async function createAllocation(e: FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const validationErr = validateLines();
    if (validationErr) {
      setError(validationErr);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const description = String(fd.get("description") || "").trim();
    const categoryId = String(fd.get("cost_category_id") || "") || null;
    if (!description) {
      setError("Description is required.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const allocation_number = `ALC-${Date.now().toString(36).toUpperCase()}`;
    const resolved = resolveAmounts();
    const totalAllocated = resolved.reduce((s, r) => s + r.amount, 0);

    const { data: header, error: hdrErr } = await supabase
      .from("cost_allocations")
      .insert({
        allocation_number,
        description,
        cost_category_id: categoryId,
        shared_cost_amount: shared,
        allocation_method: method,
        allocation_date: new Date().toISOString().slice(0, 10),
        approval_status: submit ? "Submitted" : "Draft",
        prepared_by: userId,
        total_allocated: totalAllocated,
        unallocated_remainder: Math.max(0, shared - totalAllocated),
      })
      .select("id")
      .single();

    if (hdrErr || !header) {
      setError(hdrErr?.message || "Failed to create allocation.");
      setBusy(false);
      return;
    }

    const lineRows = resolved.map((r) => ({
      allocation_id: header.id,
      matter_id: r.matter_id,
      allocation_amount: r.amount,
      allocation_percent: r.percent,
    }));

    const { error: lineErr } = await supabase.from("cost_allocation_lines").insert(lineRows);
    if (lineErr) {
      setError(lineErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: submit ? "allocation_submitted" : "allocation_created",
      record_type: "cost_allocation",
      record_id: header.id,
      action_description: submit
        ? `Cost allocation ${allocation_number} submitted (${formatCurrency(shared)}).`
        : `Cost allocation ${allocation_number} saved as draft.`,
      performed_by: userId,
    });

    setMessage(submit ? "Allocation submitted for approval." : "Allocation draft saved.");
    setShowForm(false);
    setBusy(false);
    setSharedAmount("");
    await load();
  }

  async function approveAllocation(alloc: CostAllocation) {
    if (!canApprove) return;
    const notes = window.prompt("Approval notes (optional):") ?? "";
    if (!window.confirm(`Approve allocation ${alloc.allocation_number}? This will post cost entries to each matter.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    const lines = alloc.cost_allocation_lines || [];
    const categoryId = alloc.cost_category_id;

    for (const line of lines) {
      const matter = matters.find((m) => m.id === line.matter_id);
      if (!matter) continue;
      await supabase.from("matter_cost_entries").insert({
        matter_id: line.matter_id,
        client_id: matter.client_id,
        cost_date: alloc.allocation_date,
        cost_category_id: categoryId,
        cost_source: "Allocation",
        description: `${alloc.description} (${alloc.allocation_number})`,
        quantity: 1,
        unit_cost: line.allocation_amount,
        total_cost: line.allocation_amount,
        client_reimbursable: false,
        expected_client_charge: 0,
        approval_status: "Approved",
        billing_status: "Not Billable",
        payment_status: "Not Applicable",
        allocation_id: alloc.id,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        created_by: userId,
      });
    }

    const { error: upErr } = await supabase
      .from("cost_allocations")
      .update({
        approval_status: "Approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_notes: notes || null,
      })
      .eq("id", alloc.id);

    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: "allocation_approved",
      record_type: "cost_allocation",
      record_id: alloc.id,
      action_description: `Allocation ${alloc.allocation_number} approved and posted to ${lines.length} matter(s).`,
      performed_by: userId,
    });

    setMessage("Allocation approved and cost entries created.");
    setBusy(false);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Cost Allocations"
        description="Spread shared firm costs across matters using equal, percentage, or manual splits."
        actions={
          <>
            <Link href="/costs" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Hide form" : "New allocation"}
            </button>
          </>
        }
      />

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

      {showForm && (
        <form
          className="card bg-base-100 border border-base-300 shadow-sm"
          onSubmit={(e) => createAllocation(e, false)}
        >
          <div className="card-body space-y-4">
            <h2 className="card-title text-base">Create allocation</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="form-control md:col-span-2">
                <span className="label-text text-xs">Description *</span>
                <input name="description" className="input input-bordered input-sm" required />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Category (allocated costs)</span>
                <select name="cost_category_id" className="select select-bordered select-sm" defaultValue="">
                  <option value="">Default</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Shared amount *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input input-bordered input-sm"
                  value={sharedAmount}
                  onChange={(e) => setSharedAmount(e.target.value)}
                  required
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text text-xs">Method *</span>
                <select
                  className="select select-bordered select-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as AllocationMethod)}
                >
                  {(["Equal", "Percentage", "Manual"] as AllocationMethod[]).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th />
                    <th>Matter</th>
                    {method === "Percentage" && <th>Percent</th>}
                    {(method === "Manual" || method === "Equal") && <th>Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const matter = matters.find((m) => m.id === l.matter_id);
                    const computed = computedLines.find((c) => c.matter_id === l.matter_id);
                    return (
                      <tr key={l.matter_id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={l.selected}
                            onChange={(e) => toggleMatter(l.matter_id, e.target.checked)}
                          />
                        </td>
                        <td className="text-sm">
                          {matter?.matter_number} · {matter?.matter_name}
                        </td>
                        {method === "Percentage" && (
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="input input-bordered input-xs w-24"
                              value={l.allocation_percent}
                              onChange={(e) => updateLine(l.matter_id, "allocation_percent", e.target.value)}
                              disabled={!l.selected}
                            />
                          </td>
                        )}
                        {(method === "Manual" || method === "Equal") && (
                          <td>
                            {method === "Equal" ? (
                              <span className="text-sm">
                                {l.selected ? formatCurrency(Number(computed?.allocation_amount || 0)) : "—"}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input input-bordered input-xs w-28"
                                value={l.allocation_amount}
                                onChange={(e) => updateLine(l.matter_id, "allocation_amount", e.target.value)}
                                disabled={!l.selected}
                              />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={(ev) => {
                  const form = (ev.target as HTMLElement).closest("form");
                  if (form)
                    createAllocation(
                      { preventDefault() {}, currentTarget: form, target: form } as unknown as FormEvent<HTMLFormElement>,
                      true
                    );
                }}
              >
                Submit for approval
              </button>
            </div>
          </div>
        </form>
      )}

      {allocations.length === 0 ? (
        <EmptyState title="No cost allocations yet." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Method</th>
                  <th>Shared</th>
                  <th>Allocated</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-sm">{a.allocation_number}</td>
                    <td className="text-sm">{formatDate(a.allocation_date)}</td>
                    <td className="text-sm max-w-[14rem]">{a.description}</td>
                    <td className="text-sm">{a.allocation_method}</td>
                    <td>{formatCurrency(Number(a.shared_cost_amount))}</td>
                    <td>{formatCurrency(Number(a.total_allocated))}</td>
                    <td>
                      <StatusBadge status={a.approval_status} />
                    </td>
                    <td className="text-sm">{a.cost_allocation_lines?.length ?? 0}</td>
                    <td>
                      {a.approval_status === "Submitted" && canApprove && (
                        <button
                          type="button"
                          className="btn btn-success btn-xs"
                          disabled={busy}
                          onClick={() => approveAllocation(a)}
                        >
                          Approve
                        </button>
                      )}
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
