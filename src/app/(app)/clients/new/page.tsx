"use client";

import { CLIENT_STATUSES, CLIENT_TYPES } from "@/lib/constants";
import { emailLooksValid } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NewClientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<(typeof CLIENT_TYPES)[number]>("Business");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      client_type: String(fd.get("client_type")),
      first_name: String(fd.get("first_name") || "").trim() || null,
      last_name: String(fd.get("last_name") || "").trim() || null,
      organization_name: String(fd.get("organization_name") || "").trim() || null,
      primary_contact_name: String(fd.get("primary_contact_name") || "").trim() || null,
      email: String(fd.get("email") || "").trim() || null,
      phone: String(fd.get("phone") || "").trim() || null,
      billing_email: String(fd.get("billing_email") || "").trim() || null,
      address_line_1: String(fd.get("address_line_1") || "").trim() || null,
      address_line_2: String(fd.get("address_line_2") || "").trim() || null,
      city: String(fd.get("city") || "").trim() || null,
      state: String(fd.get("state") || "").trim() || null,
      postal_code: String(fd.get("postal_code") || "").trim() || null,
      client_status: String(fd.get("client_status")),
    };

    if (payload.client_type === "Individual") {
      if (!payload.first_name || !payload.last_name) {
        setError("Individual clients require first and last name.");
        setLoading(false);
        return;
      }
    } else if (!payload.organization_name) {
      setError("Organization clients require an organization name.");
      setLoading(false);
      return;
    }

    if (payload.email && !emailLooksValid(payload.email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }
    if (payload.billing_email && !emailLooksValid(payload.billing_email)) {
      setError("Please enter a valid billing email address.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    // Soft duplicate check
    let dupQuery = supabase.from("clients").select("id, email, first_name, last_name, organization_name");
    if (payload.email) {
      const { data: byEmail } = await dupQuery.eq("email", payload.email);
      if (byEmail && byEmail.length > 0) {
        setWarning(
          "A client with a matching email already exists. You can still continue if this is intentional."
        );
      }
    }

    const { data, error: insertError } = await supabase
      .from("clients")
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    await supabase.from("matter_activity").insert({
      client_id: data.id,
      action_type: "client_created",
      action_description: "Client record created.",
      performed_by: user.id,
    });

    router.push(`/clients/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Create client"
        description="Add a fictional client record. Required fields depend on client type."
      />
      <form onSubmit={onSubmit} className="card bg-base-100 border border-base-300 shadow-sm max-w-3xl">
        <div className="card-body space-y-4">
          <div className="form-grid">
            <label className="label-cell" htmlFor="client_type">
              Client type
            </label>
            <div className="field-cell">
              <select
                id="client_type"
                name="client_type"
                className="select select-bordered w-full"
                value={clientType}
                onChange={(e) => setClientType(e.target.value as (typeof CLIENT_TYPES)[number])}
              >
                {CLIENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            {clientType === "Individual" ? (
              <>
                <label className="label-cell" htmlFor="first_name">
                  First name *
                </label>
                <div className="field-cell">
                  <input id="first_name" name="first_name" className="input input-bordered w-full" required />
                </div>
                <label className="label-cell" htmlFor="last_name">
                  Last name *
                </label>
                <div className="field-cell">
                  <input id="last_name" name="last_name" className="input input-bordered w-full" required />
                </div>
              </>
            ) : (
              <>
                <label className="label-cell" htmlFor="organization_name">
                  Organization *
                </label>
                <div className="field-cell">
                  <input
                    id="organization_name"
                    name="organization_name"
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                <label className="label-cell" htmlFor="primary_contact_name">
                  Primary contact
                </label>
                <div className="field-cell">
                  <input
                    id="primary_contact_name"
                    name="primary_contact_name"
                    className="input input-bordered w-full"
                  />
                </div>
              </>
            )}

            <label className="label-cell" htmlFor="email">
              Email
            </label>
            <div className="field-cell">
              <input id="email" name="email" type="email" className="input input-bordered w-full" />
            </div>

            <label className="label-cell" htmlFor="billing_email">
              Billing email
            </label>
            <div className="field-cell">
              <input
                id="billing_email"
                name="billing_email"
                type="email"
                className="input input-bordered w-full"
              />
            </div>

            <label className="label-cell" htmlFor="phone">
              Phone
            </label>
            <div className="field-cell">
              <input id="phone" name="phone" className="input input-bordered w-full" />
            </div>

            <label className="label-cell" htmlFor="client_status">
              Status
            </label>
            <div className="field-cell">
              <select id="client_status" name="client_status" className="select select-bordered w-full" defaultValue="Prospective">
                {CLIENT_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <label className="label-cell" htmlFor="address_line_1">
              Address line 1
            </label>
            <div className="field-cell">
              <input id="address_line_1" name="address_line_1" className="input input-bordered w-full" />
            </div>
            <label className="label-cell" htmlFor="address_line_2">
              Address line 2
            </label>
            <div className="field-cell">
              <input id="address_line_2" name="address_line_2" className="input input-bordered w-full" />
            </div>
            <label className="label-cell" htmlFor="city">
              City
            </label>
            <div className="field-cell">
              <input id="city" name="city" className="input input-bordered w-full" />
            </div>
            <label className="label-cell" htmlFor="state">
              State
            </label>
            <div className="field-cell">
              <input id="state" name="state" className="input input-bordered w-full" />
            </div>
            <label className="label-cell" htmlFor="postal_code">
              Postal code
            </label>
            <div className="field-cell">
              <input id="postal_code" name="postal_code" className="input input-bordered w-full" />
            </div>
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

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Create client"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
