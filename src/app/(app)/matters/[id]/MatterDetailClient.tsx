"use client";

import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { Asc606MatterCard } from "@/components/Asc606MatterCard";
import { EngagementContractFeeTerms } from "@/components/EngagementContractFeeTerms";
import { MatterCostTab } from "@/components/MatterCostTab";
import { PageHeader } from "@/components/PageHeader";
import {
  TaskCompletionModal,
  type TaskCompletionResult,
} from "@/components/TaskCompletionModal";
import { evaluateAsc606 } from "@/lib/asc606";
import { ASSIGNMENT_ROLES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { clientDisplayName, formatCurrency, formatDate, isOverdue } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  Client,
  Matter,
  MatterActivity,
  MatterAssignment,
  MatterTask,
  Profile,
  UserRole,
} from "@/lib/types";
import {
  MOCK_MATTER_TABS,
  MatterCaseDetails,
  MatterWorkspaceTabs,
} from "./MatterWorkspaceTabs";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  matterId: string;
  role: UserRole;
  userId: string;
};

export function MatterDetailClient({ matterId, role, userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = role === "client";
  const canApprove = role === "managing_partner";
  const canEditTasks =
    role === "managing_partner" || role === "attorney" || role === "paralegal";
  const canAssign = role === "managing_partner" || role === "attorney";
  const canLogTimeExpense =
    role === "managing_partner" || role === "attorney" || role === "paralegal";

  const initialTab = searchParams.get("tab") || "overview";
  const [tab, setTab] = useState(initialTab);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [assignments, setAssignments] = useState<MatterAssignment[]>([]);
  const [tasks, setTasks] = useState<MatterTask[]>([]);
  const [activity, setActivity] = useState<MatterActivity[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<MatterTask | null>(null);

  async function load() {
    const supabase = createClient();
    setLoading(true);
    const { data: m, error: mErr } = await supabase
      .from("matters")
      .select(
        "*, clients(*), responsible:profiles!matters_responsible_attorney_id_fkey(*), originating:profiles!matters_originating_attorney_id_fkey(*)"
      )
      .eq("id", matterId)
      .maybeSingle();

    if (mErr || !m) {
      setError(mErr?.message || "Matter not found or not accessible.");
      setLoading(false);
      return;
    }

    setMatter(m as Matter);
    setClient((m.clients as Client) || null);

    const [{ data: assigns }, { data: taskData }, { data: actData }, { data: staffData }] =
      await Promise.all([
        supabase
          .from("matter_assignments")
          .select("*, profiles(*)")
          .eq("matter_id", matterId)
          .order("assigned_at", { ascending: false }),
        supabase
          .from("matter_tasks")
          .select("*, assignee:profiles!matter_tasks_assigned_to_fkey(*)")
          .eq("matter_id", matterId)
          .order("due_date", { ascending: true }),
        supabase
          .from("matter_activity")
          .select("*, performer:profiles!matter_activity_performed_by_fkey(*)")
          .eq("matter_id", matterId)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .in("role", ["managing_partner", "attorney", "paralegal", "billing_staff"])
          .eq("active_status", true)
          .order("full_name"),
      ]);

    setAssignments((assigns || []) as MatterAssignment[]);
    setTasks((taskData || []) as MatterTask[]);
    setActivity((actData || []) as MatterActivity[]);
    setStaff((staffData || []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  const teamOptions = useMemo(() => {
    const assignedIds = new Set(
      assignments.filter((a) => a.active_status).map((a) => a.user_id)
    );
    if (matter?.responsible_attorney_id) assignedIds.add(matter.responsible_attorney_id);
    return staff.filter((s) => assignedIds.has(s.id));
  }, [assignments, staff, matter]);

  async function logActivity(action_type: string, action_description: string) {
    const supabase = createClient();
    await supabase.from("matter_activity").insert({
      matter_id: matterId,
      client_id: matter?.client_id || null,
      action_type,
      action_description,
      performed_by: userId,
    });
  }

  async function approveMatter(decision: "approve" | "reject" | "return") {
    if (!canApprove || !matter) return;
    const note = window.prompt(
      decision === "approve"
        ? "Approval notes (optional):"
        : decision === "reject"
          ? "Rejection notes:"
          : "Return-for-correction notes:"
    );
    if (decision !== "approve" && (note === null || !note.trim())) {
      setError("Notes are required when rejecting or returning a matter.");
      return;
    }
    if (!window.confirm(`Confirm you want to ${decision} this matter?`)) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const patch =
      decision === "approve"
        ? {
            approval_status: "Approved",
            matter_status: "Active",
            approval_notes: note || matter.approval_notes,
          }
        : decision === "reject"
          ? {
              approval_status: "Rejected",
              matter_status: "Canceled",
              approval_notes: note,
            }
          : {
              approval_status: "Returned for Correction",
              matter_status: "Draft",
              approval_notes: note,
            };

    const { error: upErr } = await supabase.from("matters").update(patch).eq("id", matterId);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    await logActivity(
      decision === "approve" ? "matter_approved" : decision === "reject" ? "matter_rejected" : "matter_returned",
      `Matter ${matter.matter_number} ${decision === "approve" ? "approved and activated" : decision === "reject" ? "rejected" : "returned for correction"}.`
    );
    setMessage(
      decision === "approve"
        ? "Matter approved and set to Active."
        : decision === "reject"
          ? "Matter rejected."
          : "Matter returned for correction."
    );
    setBusy(false);
    await load();
    router.refresh();
  }

  async function submitForApproval() {
    if (!matter) return;
    if (!window.confirm("Submit this matter for Managing Partner approval?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("matters")
      .update({
        approval_status: "Pending Approval",
        matter_status: "Pending Approval",
      })
      .eq("id", matterId);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    await logActivity(
      "matter_submitted",
      `Matter ${matter.matter_number} submitted for approval.`
    );
    setMessage("Matter submitted for approval.");
    setBusy(false);
    await load();
  }

  async function onCreateTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEditTasks) return;
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("task_title") || "").trim();
    const assigned_to = String(fd.get("assigned_to") || "") || null;
    const due_date = String(fd.get("due_date") || "") || null;
    if (!title) {
      setError("Task title is required.");
      return;
    }
    if (!assigned_to || !due_date) {
      setError("Important tasks require an assignee and due date.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: insErr } = await supabase.from("matter_tasks").insert({
      matter_id: matterId,
      task_title: title,
      task_description: String(fd.get("task_description") || "").trim() || null,
      assigned_to,
      task_status: "Not Started",
      priority: String(fd.get("priority") || "Normal"),
      due_date,
      client_visible: fd.get("client_visible") === "on",
      internal_notes: isClient ? null : String(fd.get("internal_notes") || "").trim() || null,
      created_by: userId,
    });
    if (insErr) {
      setError(insErr.message);
      setBusy(false);
      return;
    }
    await logActivity("task_created", `Task created: ${title}`);
    setMessage("Task created.");
    setBusy(false);
    (e.target as HTMLFormElement).reset();
    await load();
  }

  async function updateTask(task: MatterTask, patch: Partial<MatterTask>) {
    if (patch.task_status === "Completed") {
      setPendingComplete(task);
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (patch.task_status && patch.task_status !== "Completed") {
      patch.completed_at = null;
      patch.exception_notes = null;
      patch.out_of_scope = false;
    }
    const { error: upErr } = await supabase
      .from("matter_tasks")
      .update(patch)
      .eq("id", task.id);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    await load();
  }

  async function confirmCompleteTask(result: TaskCompletionResult) {
    if (!pendingComplete) return;
    const task = pendingComplete;
    setPendingComplete(null);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const patch = {
      task_status: "Completed",
      completion_notes: result.completion_notes,
      exception_notes: result.exception_notes,
      out_of_scope: result.out_of_scope,
      completed_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase
      .from("matter_tasks")
      .update(patch)
      .eq("id", task.id);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    await logActivity(
      "task_completed",
      result.out_of_scope
        ? `Out-of-scope task completed: ${task.task_title}. Work: ${result.completion_notes}. ${result.exception_notes || ""}`
        : result.exception_notes
          ? `Task completed with exception: ${task.task_title}. Work: ${result.completion_notes}. Exception: ${result.exception_notes}`
          : `Task completed: ${task.task_title}. Work documented: ${result.completion_notes}`
    );
    setMessage(`Completed “${task.task_title}” with work documentation.`);
    setBusy(false);
    await load();
  }

  async function assignMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canAssign) return;
    const fd = new FormData(e.currentTarget);
    const user_id = String(fd.get("user_id") || "");
    const assignment_role = String(fd.get("assignment_role") || "");
    if (!user_id || !assignment_role) return;

    const existing = assignments.find(
      (a) => a.user_id === user_id && a.assignment_role === assignment_role && a.active_status
    );
    if (existing) {
      setError("This person already has that active assignment on this matter.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: insErr } = await supabase.from("matter_assignments").insert({
      matter_id: matterId,
      user_id,
      assignment_role,
      assigned_by: userId,
      active_status: true,
    });
    if (insErr) {
      setError(
        insErr.message.includes("matter_one_active_lead_attorney")
          ? "A matter can have only one active Lead Attorney."
          : insErr.message
      );
      setBusy(false);
      return;
    }
    const person = staff.find((s) => s.id === user_id);
    await logActivity(
      "team_assigned",
      `${person?.full_name || "Team member"} assigned as ${assignment_role}.`
    );
    setMessage("Team member assigned.");
    setBusy(false);
    (e.target as HTMLFormElement).reset();
    await load();
  }

  async function saveEngagementTerms(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!matter || isClient) return;
    if (!(role === "managing_partner" || role === "attorney")) return;
    const fd = new FormData(e.currentTarget);
    const patch: Record<string, unknown> = {
      billing_method: String(fd.get("billing_method") || "") || null,
      hourly_rate: fd.get("hourly_rate") ? Number(fd.get("hourly_rate")) : null,
      court_hourly_rate: fd.get("court_hourly_rate") ? Number(fd.get("court_hourly_rate")) : null,
      fixed_fee_amount: fd.get("fixed_fee_amount") ? Number(fd.get("fixed_fee_amount")) : null,
      contingency_percentage: fd.get("contingency_percentage")
        ? Number(fd.get("contingency_percentage"))
        : null,
      estimated_matter_value: fd.get("estimated_matter_value")
        ? Number(fd.get("estimated_matter_value"))
        : null,
      initial_retainer_amount: fd.get("initial_retainer_amount")
        ? Number(fd.get("initial_retainer_amount"))
        : null,
      retainer_replenishment_threshold: fd.get("retainer_replenishment_threshold")
        ? Number(fd.get("retainer_replenishment_threshold"))
        : null,
      maximum_fee_amount: fd.get("maximum_fee_amount")
        ? Number(fd.get("maximum_fee_amount"))
        : null,
      matter_budget: fd.get("matter_budget") ? Number(fd.get("matter_budget")) : null,
      payment_terms_days: fd.get("payment_terms_days") ? Number(fd.get("payment_terms_days")) : null,
      scope_summary: String(fd.get("scope_summary") || "").trim() || null,
    };

    const significantKeys = [
      "billing_method",
      "hourly_rate",
      "court_hourly_rate",
      "fixed_fee_amount",
      "contingency_percentage",
      "estimated_matter_value",
      "initial_retainer_amount",
      "retainer_replenishment_threshold",
      "maximum_fee_amount",
      "matter_budget",
      "payment_terms_days",
      "scope_summary",
    ] as const;
    let changed = false;
    for (const k of significantKeys) {
      const prev = matter[k as keyof Matter];
      const next = patch[k];
      if (String(prev ?? "") !== String(next ?? "")) changed = true;
    }

    const wasApproved = matter.approval_status === "Approved";
    if (wasApproved && changed) {
      if (
        !window.confirm(
          "Significant engagement-term changes on an approved matter will set approval status to Needs Review and require re-approval. Continue?"
        )
      ) {
        return;
      }
      patch.approval_status = "Needs Review";
      // Keep operational status; approval_status drives re-approval workflow.
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase.from("matters").update(patch).eq("id", matterId);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    await logActivity(
      "engagement_terms_updated",
      `Engagement terms updated on ${matter.matter_number}${wasApproved && changed ? " — returned to Needs Review" : ""}.`
    );
    setMessage(
      wasApproved && changed
        ? "Terms saved. Matter requires re-approval before full billing reliance."
        : "Engagement terms saved."
    );
    setBusy(false);
    await load();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!matter) {
    return <EmptyState title={error || "Matter not found."} />;
  }

  const visibleTasks = isClient ? tasks.filter((t) => t.client_visible) : tasks;
  const tabs = isClient
    ? [
        { id: "overview", label: "Overview" },
        { id: "tasks", label: "Milestones" },
        { id: "charges", label: "Charges" },
      ]
    : [
        { id: "overview", label: "Overview" },
        { id: "documents", label: "Documents" },
        { id: "timeline", label: "Timeline" },
        { id: "tasks", label: "Tasks" },
        { id: "calendar", label: "Calendar" },
        { id: "billing", label: "Billing" },
        { id: "costs", label: "Cost & Resources" },
        { id: "notes", label: "Notes" },
        { id: "research", label: "Research" },
        { id: "emails", label: "Emails" },
        { id: "contacts", label: "Contacts" },
        { id: "filings", label: "Court Filings" },
        { id: "engagement", label: "Engagement Terms" },
        { id: "team", label: "Team" },
        { id: "activity", label: "Activity" },
      ];
  const mockTabIds = MOCK_MATTER_TABS.map((t) => t.id) as string[];

  return (
    <>
      <TaskCompletionModal
        open={!!pendingComplete}
        taskTitle={pendingComplete?.task_title || ""}
        onCancel={() => setPendingComplete(null)}
        onConfirm={confirmCompleteTask}
      />
      <PageHeader
        title={matter.matter_name}
        description={`${matter.matter_number}${client ? ` · ${clientDisplayName(client)}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canLogTimeExpense && (
              <>
                <Link
                  href={`/time/new?matter=${matterId}`}
                  className="btn btn-primary btn-sm"
                >
                  Log time
                </Link>
                <Link
                  href={`/expenses/new?matter=${matterId}`}
                  className="btn btn-outline btn-sm"
                >
                  Log expense
                </Link>
              </>
            )}
            {!isClient && client && role !== "paralegal" && (
              <Link href={`/clients/${client.id}`} className="btn btn-ghost btn-sm">
                View client
              </Link>
            )}
            {canApprove &&
              (matter.approval_status === "Pending Approval" ||
                matter.approval_status === "Needs Review" ||
                matter.approval_status === "Draft" ||
                matter.matter_status === "Pending Approval" ||
                matter.matter_status === "Draft") && (
                <>
                  <button
                    className="btn btn-success btn-sm"
                    disabled={busy}
                    onClick={() => approveMatter("approve")}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-warning btn-sm"
                    disabled={busy}
                    onClick={() => approveMatter("return")}
                    type="button"
                  >
                    Return
                  </button>
                  <button
                    className="btn btn-error btn-sm"
                    disabled={busy}
                    onClick={() => approveMatter("reject")}
                    type="button"
                  >
                    Reject
                  </button>
                </>
              )}
            {!isClient &&
              !canApprove &&
              role === "attorney" &&
              (matter.approval_status === "Draft" ||
                matter.approval_status === "Returned for Correction") && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={submitForApproval}
                  type="button"
                >
                  Submit for approval
                </button>
              )}
          </div>
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

      <div className="flex flex-wrap gap-2 items-center">
        <StatusBadge status={matter.matter_status} />
        {!isClient && <StatusBadge status={matter.approval_status} />}
        <span className="badge badge-outline">{matter.practice_area}</span>
        {!isClient && matter.billing_method && (
          <span className="badge badge-outline">{matter.billing_method}</span>
        )}
      </div>

      <div role="tablist" className="tabs tabs-boxed bg-base-100 border border-base-300 w-fit max-w-full flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Overview</h2>
              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="opacity-60">Client</dt>
                  <dd className="font-medium">{clientDisplayName(client)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Lead / responsible attorney</dt>
                  <dd className="font-medium">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(matter as any).responsible?.full_name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="opacity-60">Start date</dt>
                  <dd className="font-medium">{formatDate(matter.engagement_start_date)}</dd>
                </div>
                <div>
                  <dt className="opacity-60">Expected end</dt>
                  <dd className="font-medium">{formatDate(matter.expected_end_date)}</dd>
                </div>
                {!isClient && (
                  <>
                    <div>
                      <dt className="opacity-60">Next court date</dt>
                      <dd className="font-medium">{formatDate(matter.next_court_date)}</dd>
                    </div>
                    <div>
                      <dt className="opacity-60">Next filing deadline</dt>
                      <dd className="font-medium">{formatDate(matter.next_filing_deadline)}</dd>
                    </div>
                  </>
                )}
                {!isClient && (
                  <>
                    <div>
                      <dt className="opacity-60">Billing method</dt>
                      <dd className="font-medium">{matter.billing_method || "—"}</dd>
                    </div>
                    <div>
                      <dt className="opacity-60">Payment terms</dt>
                      <dd className="font-medium">
                        {matter.payment_terms_days !== null
                          ? `${matter.payment_terms_days} days`
                          : "—"}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {matter.matter_description && (
                <p className="text-sm mt-3 opacity-80">{matter.matter_description}</p>
              )}
              {isClient && matter.scope_summary && (
                <div className="mt-3">
                  <p className="text-xs font-semibold opacity-60">Scope summary</p>
                  <p className="text-sm">{matter.scope_summary}</p>
                </div>
              )}
            </div>
          </div>

          {role === "paralegal" && client && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Client contact</h2>
                <p className="text-xs opacity-60 -mt-1 mb-2">
                  Read-only contact details for case work. Full client file is not available to this role.
                </p>
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="sm:col-span-2">
                    <dt className="opacity-60">Name</dt>
                    <dd className="font-medium">{clientDisplayName(client)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Primary contact</dt>
                    <dd className="font-medium">{client.primary_contact_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Status</dt>
                    <dd className="font-medium">{client.client_status || "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Email</dt>
                    <dd className="font-medium break-all">{client.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Phone</dt>
                    <dd className="font-medium">{client.phone || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="opacity-60">Address</dt>
                    <dd className="font-medium">
                      {[
                        client.address_line_1,
                        client.address_line_2,
                        [client.city, client.state, client.postal_code].filter(Boolean).join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {!isClient && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Fee snapshot</h2>
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="opacity-60">Hourly charge</dt>
                    <dd className="font-medium">{formatCurrency(matter.hourly_rate)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Court hourly charge</dt>
                    <dd className="font-medium">{formatCurrency(matter.court_hourly_rate)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Maximum charge</dt>
                    <dd className="font-medium">{formatCurrency(matter.maximum_fee_amount)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Fixed fee</dt>
                    <dd className="font-medium">{formatCurrency(matter.fixed_fee_amount)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Contingency %</dt>
                    <dd className="font-medium">
                      {matter.contingency_percentage !== null
                        ? `${matter.contingency_percentage}%`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Retainer</dt>
                    <dd className="font-medium">
                      {formatCurrency(matter.initial_retainer_amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Budget</dt>
                    <dd className="font-medium">{formatCurrency(matter.matter_budget)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-60">Est. value (not revenue)</dt>
                    <dd className="font-medium">
                      {formatCurrency(matter.estimated_matter_value)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
          {!isClient && <MatterCaseDetails />}
        </div>
      )}

      {!isClient && mockTabIds.includes(tab) && <MatterWorkspaceTabs tab={tab} />}

      {tab === "engagement" && !isClient && matter && (
        <div className="space-y-4">
          <Asc606MatterCard assessment={evaluateAsc606(matter, client)} />
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body space-y-4 text-sm">
              <div>
                <h2 className="card-title text-base">Engagement contract — fee terms</h2>
                <p className="text-xs opacity-60 mt-1">
                  Hourly charge, maximum charge, retainer mechanics (contract liability under ASC
                  606), and court-hour premium as written into the client engagement.
                </p>
              </div>
              <EngagementContractFeeTerms matter={matter} />
            </div>
          </div>
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body space-y-4 text-sm">
              <div>
                <h3 className="font-semibold">Scope</h3>
                <p className="opacity-80">{matter.scope_summary || "—"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Exclusions</h3>
                <p className="opacity-80">{matter.exclusions_summary || "—"}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Termination terms</h3>
                  <p className="opacity-80">{matter.termination_terms || "—"}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Renewal terms</h3>
                  <p className="opacity-80">{matter.renewal_terms || "—"}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Approval notes</h3>
                  <p className="opacity-80">{matter.approval_notes || "—"}</p>
                </div>
                <div>
                  <h3 className="font-semibold">Approved</h3>
                  <p className="opacity-80">
                    {formatDate(matter.approved_at)}
                    {matter.approved_by ? " (by managing partner)" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {(role === "managing_partner" || role === "attorney") && (
            <form onSubmit={saveEngagementTerms} className="card bg-base-100 border border-warning/40 shadow-sm">
              <div className="card-body grid gap-3 md:grid-cols-2">
                <h2 className="card-title text-base md:col-span-2">
                  Edit significant terms
                </h2>
                <p className="text-xs opacity-70 md:col-span-2">
                  Changing billing method, rates, maximum charge, fixed fee, contingency, retainer
                  requirement, budget, payment terms, or scope on an approved matter returns it to
                  Needs Review.
                </p>
                <label className="form-control">
                  <span className="label-text text-xs">Billing method</span>
                  <input
                    name="billing_method"
                    className="input input-bordered input-sm"
                    defaultValue={matter.billing_method || ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Hourly charge</span>
                  <input
                    name="hourly_rate"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.hourly_rate ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Court hourly charge (higher)</span>
                  <input
                    name="court_hourly_rate"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.court_hourly_rate ?? ""}
                    placeholder="Defaults to 1.5× hourly if blank"
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Maximum charge</span>
                  <input
                    name="maximum_fee_amount"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.maximum_fee_amount ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Fixed fee</span>
                  <input
                    name="fixed_fee_amount"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.fixed_fee_amount ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Contingency %</span>
                  <input
                    name="contingency_percentage"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.contingency_percentage ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Estimated matter value (not revenue)</span>
                  <input
                    name="estimated_matter_value"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.estimated_matter_value ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Initial retainer (contract liability)</span>
                  <input
                    name="initial_retainer_amount"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.initial_retainer_amount ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Retainer replenishment threshold</span>
                  <input
                    name="retainer_replenishment_threshold"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.retainer_replenishment_threshold ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Matter budget (cost)</span>
                  <input
                    name="matter_budget"
                    type="number"
                    step="0.01"
                    className="input input-bordered input-sm"
                    defaultValue={matter.matter_budget ?? ""}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Payment terms (days)</span>
                  <input
                    name="payment_terms_days"
                    type="number"
                    className="input input-bordered input-sm"
                    defaultValue={matter.payment_terms_days ?? ""}
                  />
                </label>
                <label className="form-control md:col-span-2">
                  <span className="label-text text-xs">Scope summary</span>
                  <textarea
                    name="scope_summary"
                    className="textarea textarea-bordered"
                    rows={2}
                    defaultValue={matter.scope_summary || ""}
                  />
                </label>
                <button type="submit" className="btn btn-sm btn-primary w-fit" disabled={busy}>
                  Save terms
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === "team" && !isClient && (
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Assigned team</h2>
              {assignments.filter((a) => a.active_status).length === 0 ? (
                <EmptyState title="No team members assigned yet." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Assigned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments
                        .filter((a) => a.active_status)
                        .map((a) => (
                          <tr key={a.id}>
                            <td>{a.profiles?.full_name || a.user_id}</td>
                            <td>{a.assignment_role}</td>
                            <td className="text-sm">{formatDate(a.assigned_at)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          {canAssign && (
            <form onSubmit={assignMember} className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Assign team member</h2>
                <div className="form-grid">
                  <label className="label-cell" htmlFor="user_id">
                    Person
                  </label>
                  <div className="field-cell">
                    <select id="user_id" name="user_id" className="select select-bordered w-full" required defaultValue="">
                      <option value="" disabled>
                        Select
                      </option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.job_title})
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="label-cell" htmlFor="assignment_role">
                    Assignment role
                  </label>
                  <div className="field-cell">
                    <select id="assignment_role" name="assignment_role" className="select select-bordered w-full" required defaultValue="Supporting Attorney">
                      {ASSIGNMENT_ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm w-fit" disabled={busy} type="submit">
                  Assign
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">
                {isClient ? "Client-visible milestones" : "Tasks"}
              </h2>
              {visibleTasks.length === 0 ? (
                <EmptyState
                  title={
                    isClient
                      ? "No client-visible milestones are available right now."
                      : "No tasks for this matter yet."
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Due</th>
                        {!isClient && <th>Assignee</th>}
                        {!isClient && canEditTasks && <th>Update</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((t) => {
                        const overdue = isOverdue(t.due_date, t.task_status);
                        return (
                          <tr key={t.id} className={overdue ? "bg-error/5" : ""}>
                            <td>
                              <div className="font-medium">{t.task_title}</div>
                              {t.task_description && (
                                <div className="text-xs opacity-70">{t.task_description}</div>
                              )}
                              {!isClient && t.internal_notes && (
                                <div className="text-xs opacity-50 mt-1">
                                  Internal: {t.internal_notes}
                                </div>
                              )}
                              {t.completion_notes && (
                                <div className="text-xs opacity-70 mt-1">
                                  Work: {t.completion_notes}
                                </div>
                              )}
                              {t.exception_notes && (
                                <div className="text-xs text-warning mt-1">
                                  Exception: {t.exception_notes}
                                </div>
                              )}
                              {t.out_of_scope && (
                                <div className="mt-1">
                                  <span className="badge badge-warning badge-sm">Out of scope</span>
                                </div>
                              )}
                            </td>
                            <td>
                              <StatusBadge status={t.task_status} />
                              {overdue && (
                                <span className="badge badge-error ml-1">Overdue</span>
                              )}
                            </td>
                            <td>
                              <PriorityBadge priority={t.priority} />
                            </td>
                            <td className="text-sm">{formatDate(t.due_date)}</td>
                            {!isClient && (
                              <td className="text-sm">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(t as any).assignee?.full_name || "—"}
                              </td>
                            )}
                            {!isClient && canEditTasks && (
                              <td>
                                <select
                                  className="select select-bordered select-xs"
                                  value={t.task_status}
                                  disabled={busy}
                                  onChange={(e) =>
                                    updateTask(t, { task_status: e.target.value })
                                  }
                                >
                                  {TASK_STATUSES.map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {canEditTasks && !isClient && (
            <form onSubmit={onCreateTask} className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-base">Create task</h2>
                <div className="form-grid">
                  <label className="label-cell" htmlFor="task_title">
                    Title *
                  </label>
                  <div className="field-cell">
                    <input id="task_title" name="task_title" className="input input-bordered w-full" required />
                  </div>
                  <label className="label-cell" htmlFor="task_description">
                    Description
                  </label>
                  <div className="field-cell">
                    <textarea id="task_description" name="task_description" className="textarea textarea-bordered w-full" rows={2} />
                  </div>
                  <label className="label-cell" htmlFor="assigned_to">
                    Assign to *
                  </label>
                  <div className="field-cell">
                    <select id="assigned_to" name="assigned_to" className="select select-bordered w-full" required defaultValue="">
                      <option value="" disabled>
                        Select person on matter
                      </option>
                      {(teamOptions.length ? teamOptions : staff).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="label-cell" htmlFor="due_date">
                    Due date *
                  </label>
                  <div className="field-cell">
                    <input id="due_date" name="due_date" type="date" className="input input-bordered w-full" required />
                  </div>
                  <label className="label-cell" htmlFor="priority">
                    Priority
                  </label>
                  <div className="field-cell">
                    <select id="priority" name="priority" className="select select-bordered w-full" defaultValue="Normal">
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <label className="label-cell" htmlFor="internal_notes">
                    Internal notes
                  </label>
                  <div className="field-cell">
                    <textarea id="internal_notes" name="internal_notes" className="textarea textarea-bordered w-full" rows={2} />
                  </div>
                  <span className="label-cell">Visibility</span>
                  <div className="field-cell">
                    <label className="label cursor-pointer justify-start gap-2">
                      <input type="checkbox" name="client_visible" className="checkbox checkbox-sm" />
                      <span className="label-text">Visible to client</span>
                    </label>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm w-fit" disabled={busy} type="submit">
                  Create task
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {(tab === "costs" || tab === "charges") && matter && (
        <MatterCostTab
          matterId={matterId}
          role={role}
          userId={userId}
          clientId={matter.client_id}
          matter={matter}
        />
      )}

      {tab === "activity" && !isClient && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Activity history (read-only)</h2>
            {activity.length === 0 ? (
              <p className="text-sm opacity-60">No activity recorded yet.</p>
            ) : (
              <ul className="timeline timeline-vertical timeline-compact">
                {activity.map((a) => (
                  <li key={a.id}>
                    <div className="timeline-start text-xs opacity-60">
                      {formatDate(a.created_at)}
                    </div>
                    <div className="timeline-middle">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    </div>
                    <div className="timeline-end timeline-box mb-3">
                      <div className="font-medium text-sm">{a.action_description}</div>
                      <div className="text-xs opacity-60">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(a as any).performer?.full_name || "System"} · {a.action_type}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
