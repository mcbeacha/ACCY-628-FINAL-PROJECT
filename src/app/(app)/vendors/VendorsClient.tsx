"use client";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { VENDOR_TYPES, type Vendor } from "@/lib/cost-types";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Props = {
  userId: string;
  role: UserRole;
  canApprove: boolean;
};

export function VendorsClient({ userId, canApprove }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .order("vendor_name");
    setVendors((data || []) as Vendor[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function createVendor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const vendor_name = String(fd.get("vendor_name") || "").trim();
    const vendor_type = String(fd.get("vendor_type") || "");
    if (!vendor_name || !vendor_type) {
      setError("Vendor name and type are required.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const vendor_number = `VND-${Date.now().toString(36).toUpperCase()}`;
    const payload = {
      vendor_number,
      vendor_name,
      vendor_type,
      primary_contact: String(fd.get("primary_contact") || "").trim() || null,
      email: String(fd.get("email") || "").trim() || null,
      phone: String(fd.get("phone") || "").trim() || null,
      address: String(fd.get("address") || "").trim() || null,
      default_rate: fd.get("default_rate") ? Number(fd.get("default_rate")) : null,
      payment_terms: String(fd.get("payment_terms") || "").trim() || null,
      tax_information_status: String(fd.get("tax_information_status") || "Not Required"),
      approved_vendor_status: false,
      active_status: true,
      created_by: userId,
    };

    const { data, error: insErr } = await supabase
      .from("vendors")
      .insert(payload)
      .select("id")
      .single();

    if (insErr) {
      setError(insErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: "vendor_created",
      record_type: "vendor",
      record_id: data.id,
      action_description: `Vendor ${vendor_name} (${vendor_number}) created.`,
      performed_by: userId,
    });

    setMessage("Vendor created. Awaiting managing partner approval.");
    setShowForm(false);
    setBusy(false);
    (e.target as HTMLFormElement).reset();
    await load();
  }

  async function approveVendor(vendor: Vendor) {
    if (!canApprove) return;
    if (!window.confirm(`Approve vendor "${vendor.vendor_name}"?`)) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("vendors")
      .update({
        approved_vendor_status: true,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", vendor.id);

    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    await supabase.from("financial_activity").insert({
      action_type: "vendor_approved",
      record_type: "vendor",
      record_id: vendor.id,
      action_description: `Vendor ${vendor.vendor_name} approved for use.`,
      performed_by: userId,
    });

    setMessage(`${vendor.vendor_name} approved.`);
    setBusy(false);
    await load();
  }

  const filtered = vendors.filter((v) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      v.vendor_name.toLowerCase().includes(q) ||
      v.vendor_number.toLowerCase().includes(q) ||
      v.vendor_type.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Manage outside counsel, experts, and other vendor relationships. New vendors require managing partner approval."
        actions={
          <>
            <Link href="/costs/vendor-charge" className="btn btn-ghost btn-sm">
              Vendor charge
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowForm((s) => !s)}
            >
              {showForm ? "Hide form" : "New vendor"}
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
          onSubmit={createVendor}
          className="card bg-base-100 border border-base-300 shadow-sm max-w-3xl"
        >
          <div className="card-body space-y-4">
            <h2 className="card-title text-base">Create vendor</h2>
            <div className="form-grid">
              <label className="label-cell" htmlFor="vendor_name">
                Vendor name *
              </label>
              <div className="field-cell">
                <input id="vendor_name" name="vendor_name" className="input input-bordered w-full" required />
              </div>
              <label className="label-cell" htmlFor="vendor_type">
                Type *
              </label>
              <div className="field-cell">
                <select id="vendor_type" name="vendor_type" className="select select-bordered w-full" required defaultValue="Consultant">
                  {VENDOR_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <label className="label-cell" htmlFor="primary_contact">
                Primary contact
              </label>
              <div className="field-cell">
                <input id="primary_contact" name="primary_contact" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="email">
                Email
              </label>
              <div className="field-cell">
                <input id="email" name="email" type="email" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="phone">
                Phone
              </label>
              <div className="field-cell">
                <input id="phone" name="phone" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="default_rate">
                Default rate
              </label>
              <div className="field-cell">
                <input id="default_rate" name="default_rate" type="number" min="0" step="0.01" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="payment_terms">
                Payment terms
              </label>
              <div className="field-cell">
                <input id="payment_terms" name="payment_terms" className="input input-bordered w-full" placeholder="Net 30" />
              </div>
              <label className="label-cell" htmlFor="tax_information_status">
                Tax info status
              </label>
              <div className="field-cell">
                <select id="tax_information_status" name="tax_information_status" className="select select-bordered w-full" defaultValue="Not Required">
                  {["Not Required", "Missing", "Received", "Verified"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <label className="label-cell" htmlFor="address">
                Address
              </label>
              <div className="field-cell">
                <textarea id="address" name="address" className="textarea textarea-bordered w-full" rows={2} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm w-fit" disabled={busy}>
              {busy ? "Saving..." : "Create vendor"}
            </button>
          </div>
        </form>
      )}

      <input
        type="search"
        className="input input-bordered input-sm w-full max-w-xs"
        placeholder="Search vendors..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No vendors found." />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Tax info</th>
                  <th>Status</th>
                  <th>Approved</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className={!v.approved_vendor_status ? "bg-warning/5" : ""}>
                    <td className="text-sm font-mono">{v.vendor_number}</td>
                    <td className="font-medium">{v.vendor_name}</td>
                    <td className="text-sm">{v.vendor_type}</td>
                    <td className="text-sm">{formatCurrency(v.default_rate)}</td>
                    <td className="text-sm">{v.tax_information_status}</td>
                    <td>
                      {v.active_status ? (
                        <span className="badge badge-success badge-sm">Active</span>
                      ) : (
                        <span className="badge badge-ghost badge-sm">Inactive</span>
                      )}
                    </td>
                    <td>
                      {v.approved_vendor_status ? (
                        <span className="badge badge-success badge-sm">Approved</span>
                      ) : (
                        <span className="badge badge-warning badge-sm">Pending</span>
                      )}
                      {v.approved_at && (
                        <div className="text-xs opacity-60 mt-1">{formatDate(v.approved_at)}</div>
                      )}
                    </td>
                    <td>
                      {!v.approved_vendor_status && canApprove && (
                        <button
                          type="button"
                          className="btn btn-success btn-xs"
                          disabled={busy}
                          onClick={() => approveVendor(v)}
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
