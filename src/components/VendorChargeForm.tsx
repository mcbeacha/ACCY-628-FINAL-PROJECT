"use client";

import { PageHeader } from "@/components/PageHeader";
import { HIGH_VALUE_COST_THRESHOLD, type CostCategory, type Vendor } from "@/lib/cost-types";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ClientOpt = { id: string; client_number: string; organization_name: string | null; first_name: string | null; last_name: string | null };
type MatterOpt = { id: string; client_id: string; matter_number: string; matter_name: string };

export function VendorChargeForm({ userId, role }: { userId: string; role: UserRole }) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [matters, setMatters] = useState<MatterOpt[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [clientId, setClientId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitRate, setUnitRate] = useState("");
  const [duplicateOverride, setDuplicateOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPartner = role === "managing_partner";
  const total = useMemo(() => {
    const q = Number(qty);
    const u = Number(unitRate);
    if (!Number.isFinite(q) || !Number.isFinite(u)) return 0;
    return Math.round(q * u * 100) / 100;
  }, [qty, unitRate]);

  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const filteredMatters = useMemo(
    () => (clientId ? matters.filter((m) => m.client_id === clientId) : matters),
    [matters, clientId]
  );

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: c }, { data: v }, { data: cats }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, client_number, organization_name, first_name, last_name")
          .order("client_number"),
        supabase.from("vendors").select("*").eq("active_status", true).order("vendor_name"),
        supabase
          .from("cost_categories")
          .select("*")
          .eq("active_status", true)
          .eq("category_group", "Outside Services")
          .order("category_name"),
      ]);
      setClients((c || []) as ClientOpt[]);
      setVendors((v || []) as Vendor[]);
      setCategories((cats || []) as CostCategory[]);

      let matterQuery = supabase
        .from("matters")
        .select("id, client_id, matter_number, matter_name")
        .not("matter_status", "in", '("Canceled")')
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
        if (ids.size > 0) matterQuery = matterQuery.in("id", [...ids]);
        else {
          setMatters([]);
          return;
        }
      }

      const { data: m } = await matterQuery;
      setMatters((m || []) as MatterOpt[]);
    })();
  }, [userId, role]);

  useEffect(() => {
    if (selectedVendor?.default_rate && !unitRate) {
      setUnitRate(String(selectedVendor.default_rate));
    }
  }, [selectedVendor, unitRate]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setMessage(null);

    const fd = new FormData(e.currentTarget);
    const vid = String(fd.get("vendor_id") || "");
    const cid = String(fd.get("client_id") || "");
    const mid = String(fd.get("matter_id") || "");
    const serviceDate = String(fd.get("cost_date") || "");
    const categoryId = String(fd.get("cost_category_id") || "");
    const desc = String(fd.get("description") || "").trim();
    const invoiceRef = String(fd.get("receipt_reference") || "").trim();
    const reimbursable = fd.get("client_reimbursable") === "on";
    const expectedCharge = fd.get("expected_client_charge")
      ? Number(fd.get("expected_client_charge"))
      : reimbursable
        ? total
        : 0;
    const override = fd.get("duplicate_override") === "on";

    if (!vid || !cid || !mid || !serviceDate || !categoryId) {
      setError("Vendor, client, matter, service date, and category are required.");
      return;
    }
    if (!desc) {
      setError("Description is required.");
      return;
    }
    if (!invoiceRef) {
      setError("Invoice reference is required.");
      return;
    }
    if (total <= 0) {
      setError("Total must be greater than zero.");
      return;
    }

    const vendor = vendors.find((v) => v.id === vid);
    if (!vendor?.approved_vendor_status && !isPartner) {
      setError("Only approved vendors may be used. Contact billing or the managing partner.");
      return;
    }
    if (!vendor?.approved_vendor_status && isPartner) {
      setWarning("This vendor is not yet approved. Proceeding as managing partner.");
    }

    setLoading(true);
    const supabase = createClient();

    if (invoiceRef && !override) {
      const { data: dupRows } = await supabase
        .from("matter_cost_entries")
        .select("id")
        .eq("vendor_id", vid)
        .eq("receipt_reference", invoiceRef)
        .eq("duplicate_override", false)
        .in("cost_source", ["Vendor Invoice", "Contractor Charge"]);
      if (dupRows?.length) {
        setError(
          "Duplicate vendor invoice reference. Managing partner may override with the checkbox."
        );
        setLoading(false);
        return;
      }
    }

    if (total >= HIGH_VALUE_COST_THRESHOLD) {
      setWarning(
        (prev) =>
          (prev ? `${prev} ` : "") +
          `High-value charge (${formatCurrency(total)}) will require extra review.`
      );
    }

    const payload = {
      matter_id: mid,
      client_id: cid,
      cost_date: serviceDate,
      cost_category_id: categoryId,
      cost_source: "Vendor Invoice" as const,
      vendor_id: vid,
      description: desc,
      quantity: Number(qty) || 1,
      unit_cost: Number(unitRate) || 0,
      total_cost: total,
      client_reimbursable: reimbursable,
      expected_client_charge: expectedCharge,
      approval_status: "Submitted",
      billing_status: reimbursable ? "Unbilled" : "Not Billable",
      payment_status: "Unpaid",
      receipt_reference: invoiceRef,
      duplicate_override: override,
      duplicate_override_by: override ? userId : null,
      created_by: userId,
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
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
      action_type: "vendor_charge_submitted",
      record_type: "matter_cost_entry",
      record_id: data.id,
      matter_id: mid,
      client_id: cid,
      action_description: `Vendor charge submitted for approval (${formatCurrency(total)}).`,
      performed_by: userId,
    });

    setMessage("Vendor charge submitted for approval.");
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    setClientId("");
    setVendorId("");
    setQty("1");
    setUnitRate("");
    setDuplicateOverride(false);
  }

  const vendorOptions = isPartner
    ? vendors
    : vendors.filter((v) => v.approved_vendor_status);

  return (
    <>
      <PageHeader
        title="Vendor Charge"
        description="Record outside vendor or contractor charges for a matter. Submitted for approval — not auto-approved."
        actions={
          <>
            <Link href="/vendors" className="btn btn-ghost btn-sm">
              Vendors
            </Link>
            <Link href="/costs/review" className="btn btn-ghost btn-sm">
              Cost approval
            </Link>
          </>
        }
      />

      <form
        className="card bg-base-100 border border-base-300 shadow-sm max-w-3xl"
        onSubmit={submit}
      >
        <div className="card-body space-y-4">
          <div className="form-grid">
            <label className="label-cell" htmlFor="vendor_id">
              Vendor *
            </label>
            <div className="field-cell">
              <select
                id="vendor_id"
                name="vendor_id"
                className="select select-bordered w-full"
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                <option value="" disabled>
                  Select vendor
                </option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_name}
                    {!v.approved_vendor_status ? " (pending approval)" : ""}
                  </option>
                ))}
              </select>
              {selectedVendor && !selectedVendor.approved_vendor_status && (
                <p className="text-xs text-warning mt-1">Vendor is not approved.</p>
              )}
            </div>

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
                onChange={(e) => setClientId(e.target.value)}
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
              <select id="matter_id" name="matter_id" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>
                  Select matter
                </option>
                {filteredMatters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_number} · {m.matter_name}
                  </option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="cost_date">
              Service date *
            </label>
            <div className="field-cell">
              <input id="cost_date" name="cost_date" type="date" className="input input-bordered w-full" required />
            </div>

            <label className="label-cell" htmlFor="cost_category_id">
              Category (outside services) *
            </label>
            <div className="field-cell">
              <select id="cost_category_id" name="cost_category_id" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>
                  Select category
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.category_name}
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

            <label className="label-cell" htmlFor="unit_rate">
              Unit rate *
            </label>
            <div className="field-cell">
              <input
                id="unit_rate"
                name="unit_rate"
                type="number"
                min="0.01"
                step="0.01"
                className="input input-bordered w-full"
                value={unitRate}
                onChange={(e) => setUnitRate(e.target.value)}
                required
              />
            </div>

            <span className="label-cell">Total</span>
            <div className="field-cell">
              <p className="font-semibold">{formatCurrency(total)}</p>
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
                placeholder={total > 0 ? String(total) : ""}
              />
            </div>

            <label className="label-cell" htmlFor="receipt_reference">
              Invoice reference *
            </label>
            <div className="field-cell">
              <input id="receipt_reference" name="receipt_reference" className="input input-bordered w-full" required />
            </div>

            {isPartner && (
              <>
                <span className="label-cell">Duplicate override</span>
                <div className="field-cell">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      name="duplicate_override"
                      className="checkbox checkbox-sm"
                      checked={duplicateOverride}
                      onChange={(e) => setDuplicateOverride(e.target.checked)}
                    />
                    <span className="label-text">Override duplicate vendor + invoice reference block</span>
                  </label>
                </div>
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

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
