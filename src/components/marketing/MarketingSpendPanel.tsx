"use client";

import { formatCurrency, formatDate } from "@/lib/format";
import { ADVERTISING_COST_CATEGORY_NAME } from "@/lib/marketing-types";
import type { MarketingCampaign, MarketingSpend } from "@/lib/marketing-types";
import { createClient } from "@/lib/supabase/client";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MatterOpt = { id: string; matter_number: string; matter_name: string; client_id: string; campaign_id: string | null; lead_source_id: string | null };

export function MarketingSpendPanel({
  userId,
  canApprove,
  campaigns,
  spend,
  matters,
}: {
  userId: string;
  canApprove: boolean;
  campaigns: MarketingCampaign[];
  spend: MarketingSpend[];
  matters: MatterOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const pending = useMemo(
    () => spend.filter((s) => s.approval_status === "Submitted" || s.approval_status === "Draft"),
    [spend]
  );

  async function createSpend(e: FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const campaign_id = String(fd.get("campaign_id") || "");
    if (!campaign_id || !(amount >= 0)) {
      setError("Campaign and a non-negative amount are required.");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { error: insErr } = await supabase.from("marketing_spend").insert({
      campaign_id,
      spend_date: String(fd.get("spend_date") || new Date().toISOString().slice(0, 10)),
      period_start: String(fd.get("period_start") || "") || null,
      period_end: String(fd.get("period_end") || "") || null,
      amount,
      description: String(fd.get("description") || "").trim() || null,
      approval_status: submit ? "Submitted" : "Draft",
      created_by: userId,
      is_demo_data: true,
    });
    if (insErr) {
      setError(insErr.message);
      setBusy(false);
      return;
    }
    setMessage(submit ? "Spend submitted for approval." : "Spend draft saved.");
    setShowForm(false);
    setBusy(false);
    router.refresh();
  }

  async function approveSpend(row: MarketingSpend) {
    if (!canApprove) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("marketing_spend")
      .update({
        approval_status: "Approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    setMessage(`Approved ${formatCurrency(row.amount)} spend.`);
    setBusy(false);
    router.refresh();
  }

  async function postToAllocation(row: MarketingSpend) {
    if (!canApprove) return;
    if (row.cost_allocation_id) {
      setError("This spend is already linked to a cost allocation.");
      return;
    }
    if (
      !window.confirm(
        `Post ${formatCurrency(row.amount)} to Cost Allocations (Advertising / Marketing) and create approved matter cost entries?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: cat } = await supabase
      .from("cost_categories")
      .select("id")
      .eq("category_name", ADVERTISING_COST_CATEGORY_NAME)
      .maybeSingle();

    const campaign = campaigns.find((c) => c.id === row.campaign_id);
    const attributed = matters.filter(
      (m) => m.campaign_id === row.campaign_id || (campaign && m.lead_source_id === campaign.lead_source_id)
    );
    const targets = attributed.length ? attributed : matters;
    if (!targets.length) {
      setError("No matters available to allocate advertising cost.");
      setBusy(false);
      return;
    }

    const each = Math.round((row.amount / targets.length) * 100) / 100;
    const lines = targets.map((m, i) => ({
      matter_id: m.id,
      amount: i === targets.length - 1 ? row.amount - each * (targets.length - 1) : each,
    }));

    const allocation_number = `ALC-MKT-${Date.now().toString(36).toUpperCase()}`;
    const { data: header, error: hdrErr } = await supabase
      .from("cost_allocations")
      .insert({
        allocation_number,
        description: `Marketing: ${row.description || campaign?.campaign_name || "Ad spend"}`,
        cost_category_id: cat?.id || null,
        shared_cost_amount: row.amount,
        allocation_method: "Equal",
        allocation_date: row.spend_date,
        approval_status: "Approved",
        prepared_by: userId,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        total_allocated: row.amount,
        unallocated_remainder: 0,
        is_demo_data: true,
      })
      .select("id")
      .single();

    if (hdrErr || !header) {
      setError(hdrErr?.message || "Failed to create cost allocation.");
      setBusy(false);
      return;
    }

    await supabase.from("cost_allocation_lines").insert(
      lines.map((l) => ({
        allocation_id: header.id,
        matter_id: l.matter_id,
        allocation_amount: l.amount,
        allocation_percent: Math.round((l.amount / row.amount) * 10000) / 100,
        is_demo_data: true,
      }))
    );

    for (const line of lines) {
      const matter = targets.find((m) => m.id === line.matter_id)!;
      await supabase.from("matter_cost_entries").insert({
        matter_id: line.matter_id,
        client_id: matter.client_id,
        cost_date: row.spend_date,
        cost_category_id: cat?.id || null,
        cost_source: "Allocation",
        description: `Marketing allocation ${allocation_number}`,
        quantity: 1,
        unit_cost: line.amount,
        total_cost: line.amount,
        client_reimbursable: false,
        expected_client_charge: 0,
        approval_status: "Approved",
        billing_status: "Not Billable",
        payment_status: "Not Applicable",
        allocation_id: header.id,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        created_by: userId,
        is_demo_data: true,
      });
    }

    const { error: linkErr } = await supabase
      .from("marketing_spend")
      .update({
        cost_allocation_id: header.id,
        approval_status: "Approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (linkErr) {
      setError(linkErr.message);
      setBusy(false);
      return;
    }

    setMessage(`Posted to allocation ${allocation_number}. Matter profitability now includes this ad cost.`);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">Marketing spend</h2>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Record spend"}
          </button>
        </div>
        <p className="text-sm opacity-70">
          Approved spend feeds CPL / CPA / ROI. Posting to cost allocation writes Advertising / Marketing
          allocated costs onto matters so firm profitability stays reconciled.
        </p>
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

        {showForm && (
          <form className="grid gap-3 sm:grid-cols-2 border border-base-300 rounded-box p-4">
            <label className="form-control sm:col-span-2">
              <span className="label-text">Campaign *</span>
              <select name="campaign_id" className="select select-bordered" required defaultValue="">
                <option value="" disabled>
                  Select campaign…
                </option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaign_code} — {c.campaign_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Spend date *</span>
              <input
                name="spend_date"
                type="date"
                className="input input-bordered"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Amount *</span>
              <input name="amount" type="number" step="0.01" min="0" className="input input-bordered" required />
            </label>
            <label className="form-control">
              <span className="label-text">Period start</span>
              <input name="period_start" type="date" className="input input-bordered" />
            </label>
            <label className="form-control">
              <span className="label-text">Period end</span>
              <input name="period_end" type="date" className="input input-bordered" />
            </label>
            <label className="form-control sm:col-span-2">
              <span className="label-text">Description</span>
              <input name="description" className="input input-bordered" placeholder="e.g. May Google Ads — PI" />
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={busy}
                onClick={(ev) => {
                  const form = ev.currentTarget.form;
                  if (form) createSpend({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, false);
                }}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={(ev) => {
                  const form = ev.currentTarget.form;
                  if (form) createSpend({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, true);
                }}
              >
                Submit for approval
              </button>
            </div>
          </form>
        )}

        <div className="table-wrap">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Campaign</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Allocation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {spend.length === 0 ? (
                <tr>
                  <td colSpan={6} className="opacity-60">
                    No marketing spend recorded.
                  </td>
                </tr>
              ) : (
                spend.map((s) => {
                  const camp = campaigns.find((c) => c.id === s.campaign_id);
                  return (
                    <tr key={s.id}>
                      <td>{formatDate(s.spend_date)}</td>
                      <td className="text-sm">{camp?.campaign_name || s.campaign_id}</td>
                      <td>{formatCurrency(s.amount)}</td>
                      <td>
                        <span className="badge badge-ghost badge-sm">{s.approval_status}</span>
                      </td>
                      <td className="text-xs">
                        {s.cost_allocation_id ? "Posted" : "—"}
                      </td>
                      <td className="text-right space-x-1">
                        {canApprove && s.approval_status !== "Approved" && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={busy}
                            onClick={() => approveSpend(s)}
                          >
                            Approve
                          </button>
                        )}
                        {canApprove && s.approval_status === "Approved" && !s.cost_allocation_id && (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={busy}
                            onClick={() => postToAllocation(s)}
                          >
                            Post to costs
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pending.length > 0 && (
          <p className="text-xs opacity-60">{pending.length} spend row(s) awaiting approval.</p>
        )}
      </div>
    </div>
  );
}
