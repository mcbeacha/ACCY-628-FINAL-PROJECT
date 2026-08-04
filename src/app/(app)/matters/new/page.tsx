"use client";

import {
  ASSIGNMENT_ROLES,
  BILLING_FREQUENCIES,
  BILLING_METHODS,
  PRACTICE_AREAS,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Client, Profile } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

function NewMatterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [billingMethod, setBillingMethod] = useState<string>("Hourly");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: clientData }, { data: staffData }] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .in("role", ["managing_partner", "attorney", "paralegal", "billing_staff"])
          .eq("active_status", true)
          .order("full_name"),
      ]);
      setClients((clientData || []) as Client[]);
      setStaff((staffData || []) as Profile[]);
    })();
  }, []);

  const attorneys = useMemo(
    () => staff.filter((s) => s.role === "attorney" || s.role === "managing_partner"),
    [staff]
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    const num = (key: string) => {
      const v = String(fd.get(key) || "").trim();
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const matterName = String(fd.get("matter_name") || "").trim();
    const clientId = String(fd.get("client_id") || "");
    if (!matterName || !clientId) {
      setError("Client and matter name are required.");
      setLoading(false);
      return;
    }

    // Billing method field requirements
    if (billingMethod === "Hourly" && num("hourly_rate") === null) {
      setError("Hourly matters require an hourly rate.");
      setLoading(false);
      return;
    }
    if (billingMethod === "Fixed Fee" && num("fixed_fee_amount") === null) {
      setError("Fixed Fee matters require a fixed fee amount.");
      setLoading(false);
      return;
    }
    if (billingMethod === "Retainer-Funded Hourly") {
      if (num("hourly_rate") === null || num("initial_retainer_amount") === null) {
        setError("Retainer-Funded Hourly matters require rate and initial retainer.");
        setLoading(false);
        return;
      }
    }
    if (billingMethod === "Contingency" && num("contingency_percentage") === null) {
      setError("Contingency matters require a contingency percentage.");
      setLoading(false);
      return;
    }
    if (num("contingency_percentage") !== null) {
      const p = num("contingency_percentage")!;
      if (p < 0 || p > 100) {
        setError("Contingency percentage must be between 0 and 100.");
        setLoading(false);
        return;
      }
    }
    for (const key of [
      "hourly_rate",
      "fixed_fee_amount",
      "initial_retainer_amount",
      "matter_budget",
      "estimated_matter_value",
    ]) {
      const v = num(key);
      if (v !== null && v < 0) {
        setError("Fee and budget amounts cannot be negative.");
        setLoading(false);
        return;
      }
    }

    const start = String(fd.get("engagement_start_date") || "") || null;
    const end = String(fd.get("expected_end_date") || "") || null;
    if (start && end && end < start) {
      setError("Expected end date cannot be before the start date.");
      setLoading(false);
      return;
    }

    const submitForApproval = fd.get("submit_for_approval") === "on";
    const payload = {
      client_id: clientId,
      matter_name: matterName,
      matter_description: String(fd.get("matter_description") || "").trim() || null,
      practice_area: String(fd.get("practice_area")),
      matter_status: submitForApproval ? "Pending Approval" : "Draft",
      engagement_start_date: start,
      expected_end_date: end,
      responsible_attorney_id: String(fd.get("responsible_attorney_id") || "") || null,
      originating_attorney_id: String(fd.get("originating_attorney_id") || "") || null,
      billing_method: billingMethod || null,
      hourly_rate: num("hourly_rate"),
      fixed_fee_amount: num("fixed_fee_amount"),
      contingency_percentage: num("contingency_percentage"),
      initial_retainer_amount: num("initial_retainer_amount"),
      retainer_replenishment_threshold: num("retainer_replenishment_threshold"),
      estimated_matter_value: num("estimated_matter_value"),
      matter_budget: num("matter_budget"),
      billing_frequency: String(fd.get("billing_frequency") || "") || null,
      payment_terms_days: num("payment_terms_days"),
      scope_summary: String(fd.get("scope_summary") || "").trim() || null,
      exclusions_summary: String(fd.get("exclusions_summary") || "").trim() || null,
      termination_terms: String(fd.get("termination_terms") || "").trim() || null,
      renewal_terms: String(fd.get("renewal_terms") || "").trim() || null,
      change_approval_required: fd.get("change_approval_required") === "on",
      client_approval_required: fd.get("client_approval_required") === "on",
      approval_status: submitForApproval ? "Pending Approval" : "Draft",
      approval_notes: String(fd.get("approval_notes") || "").trim() || null,
      created_by: user.id,
    };

    const { data: matter, error: insertError } = await supabase
      .from("matters")
      .insert(payload)
      .select("id, matter_number, client_id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Assignments
    const assignments: {
      matter_id: string;
      user_id: string;
      assignment_role: string;
      assigned_by: string;
      active_status: boolean;
    }[] = [];

    if (payload.responsible_attorney_id) {
      assignments.push({
        matter_id: matter.id,
        user_id: payload.responsible_attorney_id,
        assignment_role: "Lead Attorney",
        assigned_by: user.id,
        active_status: true,
      });
    }

    for (const uid of teamIds) {
      if (uid === payload.responsible_attorney_id) continue;
      const person = staff.find((s) => s.id === uid);
      const role =
        person?.role === "paralegal"
          ? "Paralegal"
          : person?.role === "billing_staff"
            ? "Billing Contact"
            : person?.role === "attorney" || person?.role === "managing_partner"
              ? "Supporting Attorney"
              : "Legal Assistant";
      assignments.push({
        matter_id: matter.id,
        user_id: uid,
        assignment_role: role,
        assigned_by: user.id,
        active_status: true,
      });
    }

    if (assignments.length) {
      const { error: assignErr } = await supabase.from("matter_assignments").insert(assignments);
      if (assignErr) {
        setError(`Matter created, but assignment error: ${assignErr.message}`);
      }
    }

    await supabase.from("matter_activity").insert([
      {
        matter_id: matter.id,
        client_id: matter.client_id,
        action_type: "matter_created",
        action_description: `Matter ${matter.matter_number} created as ${payload.matter_status}.`,
        performed_by: user.id,
      },
      ...(submitForApproval
        ? [
            {
              matter_id: matter.id,
              client_id: matter.client_id,
              action_type: "matter_submitted",
              action_description: `Matter ${matter.matter_number} submitted for approval.`,
              performed_by: user.id,
            },
          ]
        : []),
    ]);

    router.push(`/matters/${matter.id}`);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Create matter"
        description="Capture client, staffing, scope, pricing, and approval information for a new engagement."
      />
      <form onSubmit={onSubmit} className="space-y-4 max-w-4xl">
        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Client and matter information</h2>
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
                  defaultValue={searchParams.get("client_id") || ""}
                >
                  <option value="" disabled>
                    Select client
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client_number} ·{" "}
                      {c.organization_name ||
                        [c.first_name, c.last_name].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              </div>
              <label className="label-cell" htmlFor="matter_name">
                Matter name *
              </label>
              <div className="field-cell">
                <input id="matter_name" name="matter_name" className="input input-bordered w-full" required />
              </div>
              <label className="label-cell" htmlFor="matter_description">
                Description
              </label>
              <div className="field-cell">
                <textarea id="matter_description" name="matter_description" className="textarea textarea-bordered w-full" rows={3} />
              </div>
              <label className="label-cell" htmlFor="practice_area">
                Practice area *
              </label>
              <div className="field-cell">
                <select id="practice_area" name="practice_area" className="select select-bordered w-full" required defaultValue="Business Law">
                  {PRACTICE_AREAS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <label className="label-cell" htmlFor="engagement_start_date">
                Start date
              </label>
              <div className="field-cell">
                <input id="engagement_start_date" name="engagement_start_date" type="date" className="input input-bordered w-full" />
              </div>
              <label className="label-cell" htmlFor="expected_end_date">
                Expected end
              </label>
              <div className="field-cell">
                <input id="expected_end_date" name="expected_end_date" type="date" className="input input-bordered w-full" />
              </div>
            </div>
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Staffing</h2>
            <div className="form-grid">
              <label className="label-cell" htmlFor="responsible_attorney_id">
                Responsible attorney
              </label>
              <div className="field-cell">
                <select id="responsible_attorney_id" name="responsible_attorney_id" className="select select-bordered w-full" defaultValue="">
                  <option value="">Not assigned</option>
                  {attorneys.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="label-cell" htmlFor="originating_attorney_id">
                Originating attorney
              </label>
              <div className="field-cell">
                <select id="originating_attorney_id" name="originating_attorney_id" className="select select-bordered w-full" defaultValue="">
                  <option value="">Not assigned</option>
                  {attorneys.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="label-cell">Team members</span>
              <div className="field-cell">
                <div className="grid sm:grid-cols-2 gap-2">
                  {staff.map((s) => (
                    <label key={s.id} className="label cursor-pointer justify-start gap-2 border border-base-300 rounded-lg px-3 py-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={teamIds.includes(s.id)}
                        onChange={(e) => {
                          setTeamIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          );
                        }}
                      />
                      <span className="label-text">
                        {s.full_name}
                        <span className="opacity-60"> · {s.job_title}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs opacity-60 mt-2">
                  Only one active Lead Attorney is allowed. Supporting roles may use:{" "}
                  {ASSIGNMENT_ROLES.join(", ")}.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Engagement and scope</h2>
            <div className="form-grid">
              <label className="label-cell" htmlFor="scope_summary">
                Scope summary
              </label>
              <div className="field-cell">
                <textarea id="scope_summary" name="scope_summary" className="textarea textarea-bordered w-full" rows={3} />
              </div>
              <label className="label-cell" htmlFor="exclusions_summary">
                Exclusions
              </label>
              <div className="field-cell">
                <textarea id="exclusions_summary" name="exclusions_summary" className="textarea textarea-bordered w-full" rows={2} />
              </div>
              <label className="label-cell" htmlFor="termination_terms">
                Termination terms
              </label>
              <div className="field-cell">
                <textarea id="termination_terms" name="termination_terms" className="textarea textarea-bordered w-full" rows={2} />
              </div>
              <label className="label-cell" htmlFor="renewal_terms">
                Renewal terms
              </label>
              <div className="field-cell">
                <textarea id="renewal_terms" name="renewal_terms" className="textarea textarea-bordered w-full" rows={2} />
              </div>
              <span className="label-cell">Approvals</span>
              <div className="field-cell flex flex-col gap-2">
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" name="change_approval_required" className="checkbox checkbox-sm" defaultChecked />
                  <span className="label-text">Change approval required for major term changes</span>
                </label>
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" name="client_approval_required" className="checkbox checkbox-sm" />
                  <span className="label-text">Client approval required for changes</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Pricing</h2>
            <div className="form-grid">
              <label className="label-cell" htmlFor="billing_method">
                Billing method *
              </label>
              <div className="field-cell">
                <select
                  id="billing_method"
                  name="billing_method"
                  className="select select-bordered w-full"
                  value={billingMethod}
                  onChange={(e) => setBillingMethod(e.target.value)}
                >
                  {BILLING_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              {["Hourly", "Retainer-Funded Hourly", "Hybrid"].includes(billingMethod) && (
                <>
                  <label className="label-cell" htmlFor="hourly_rate">
                    Hourly rate {billingMethod !== "Hybrid" ? "*" : ""}
                  </label>
                  <div className="field-cell">
                    <input id="hourly_rate" name="hourly_rate" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                  </div>
                </>
              )}

              {["Fixed Fee", "Hybrid"].includes(billingMethod) && (
                <>
                  <label className="label-cell" htmlFor="fixed_fee_amount">
                    Fixed fee amount {billingMethod === "Fixed Fee" ? "*" : ""}
                  </label>
                  <div className="field-cell">
                    <input id="fixed_fee_amount" name="fixed_fee_amount" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                  </div>
                </>
              )}

              {billingMethod === "Contingency" && (
                <>
                  <label className="label-cell" htmlFor="contingency_percentage">
                    Contingency % *
                  </label>
                  <div className="field-cell">
                    <input id="contingency_percentage" name="contingency_percentage" type="number" min="0" max="100" step="0.01" className="input input-bordered w-full" />
                  </div>
                  <label className="label-cell" htmlFor="estimated_matter_value">
                    Estimated matter value
                  </label>
                  <div className="field-cell">
                    <input id="estimated_matter_value" name="estimated_matter_value" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                    <p className="text-xs opacity-60 mt-1">Not treated as earned revenue.</p>
                  </div>
                </>
              )}

              {billingMethod === "Retainer-Funded Hourly" && (
                <>
                  <label className="label-cell" htmlFor="initial_retainer_amount">
                    Initial retainer *
                  </label>
                  <div className="field-cell">
                    <input id="initial_retainer_amount" name="initial_retainer_amount" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                  </div>
                  <label className="label-cell" htmlFor="retainer_replenishment_threshold">
                    Replenishment threshold
                  </label>
                  <div className="field-cell">
                    <input id="retainer_replenishment_threshold" name="retainer_replenishment_threshold" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                  </div>
                </>
              )}

              {billingMethod !== "Pro Bono" && (
                <>
                  <label className="label-cell" htmlFor="matter_budget">
                    Matter budget
                  </label>
                  <div className="field-cell">
                    <input id="matter_budget" name="matter_budget" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                  </div>
                  <label className="label-cell" htmlFor="billing_frequency">
                    Billing frequency
                  </label>
                  <div className="field-cell">
                    <select id="billing_frequency" name="billing_frequency" className="select select-bordered w-full" defaultValue="Monthly">
                      {BILLING_FREQUENCIES.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <label className="label-cell" htmlFor="payment_terms_days">
                    Payment terms (days)
                  </label>
                  <div className="field-cell">
                    <input id="payment_terms_days" name="payment_terms_days" type="number" min="0" className="input input-bordered w-full" defaultValue={30} />
                  </div>
                </>
              )}

              {billingMethod === "Pro Bono" && (
                <div className="field-span alert alert-info text-sm">
                  Pro Bono matters track work without client fees. Rate fields are not required.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Approval</h2>
            <div className="form-grid">
              <label className="label-cell" htmlFor="approval_notes">
                Approval notes
              </label>
              <div className="field-cell">
                <textarea id="approval_notes" name="approval_notes" className="textarea textarea-bordered w-full" rows={2} />
              </div>
              <span className="label-cell">Submit</span>
              <div className="field-cell">
                <label className="label cursor-pointer justify-start gap-2">
                  <input type="checkbox" name="submit_for_approval" className="checkbox checkbox-sm" />
                  <span className="label-text">
                    Submit for Managing Partner approval (otherwise save as Draft)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Create matter"}
          </button>
        </div>
      </form>
    </>
  );
}

export default function NewMatterPage() {
  return (
    <Suspense fallback={<div className="loading loading-spinner loading-lg" />}>
      <NewMatterForm />
    </Suspense>
  );
}
