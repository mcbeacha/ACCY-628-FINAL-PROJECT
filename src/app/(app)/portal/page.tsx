import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { ClientDocumentTasks } from "@/components/document-requests/ClientDocumentTasks";
import { clientDisplayName, formatDate } from "@/lib/format";
import type { Client, Matter, MatterTask } from "@/lib/types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClientPortalPage() {
  const { profile, supabase } = await requireUser();
  if (profile.role !== "client") {
    redirect("/dashboard");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("portal_user_id", profile.id)
    .maybeSingle();

  const { data: matters } = await supabase
    .from("matters")
    .select("*, responsible:profiles!matters_responsible_attorney_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  const matterRows = (matters || []) as Matter[];

  const ids = matterRows.map((m) => m.id);
  let tasks: MatterTask[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("matter_tasks")
      .select("*")
      .eq("client_visible", true)
      .in("matter_id", ids);
    tasks = (data || []) as MatterTask[];
  }

  const clientIds = client ? [(client as Client).id] : [];
  const openMilestones = tasks.filter(
    (t) => t.task_status !== "Completed" && t.task_status !== "Cancelled"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Portal"
        description="Your home for matters, documents, and billing. This application uses fictional data only."
        actions={
          client ? (
            <Link href="/portal/billing" className="btn btn-primary">
              Invoices & payments
            </Link>
          ) : undefined
        }
      />

      {client ? (
        <div className="rounded-lg border-2 border-primary bg-primary/10 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-semibold">Invoices & payments</p>
              <p className="text-sm opacity-80">
                Review balances, open invoices, and payment history in one place.
              </p>
            </div>
            <Link href="/portal/billing" className="btn btn-primary shrink-0">
              Open billing
            </Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium">What to do next</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 opacity-80">
          <li>Finish any open document requests from your legal team.</li>
          <li>
            Check{" "}
            {client ? (
              <Link href="/portal/billing" className="link link-primary font-medium">
                invoices & payments
              </Link>
            ) : (
              "invoices & payments"
            )}{" "}
            when you need billing details.
          </li>
          <li>Review your matters and milestone status below.</li>
        </ol>
      </div>

      <ClientDocumentTasks profile={profile} clientIds={clientIds} />

      {client ? (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Account & billing</h2>
            <p className="text-sm opacity-70 -mt-1">
              Confirm your contact details here. Use the billing button anytime you need invoices.
            </p>
            <p className="text-sm mt-2">
              <span className="font-semibold">{clientDisplayName(client as Client)}</span>
              <span className="opacity-60"> · {(client as Client).client_number}</span>
            </p>
            <p className="text-sm opacity-80">{(client as Client).email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Link href="/portal/billing" className="btn btn-primary">
                View invoices & payments
              </Link>
              <Link
                href={`/clients/${(client as Client).id}`}
                className="btn btn-sm btn-outline"
              >
                View client profile
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="No client profile is linked to this login yet." />
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Your matters</h2>
          <p className="text-sm opacity-70 -mt-1">
            Open a matter to see details shared with you. Status shows where each engagement stands.
          </p>
          {matterRows.length === 0 ? (
            <EmptyState title="No active matters are currently available for this client." />
          ) : (
            <ul className="space-y-3 mt-2">
              {matterRows.map((m) => (
                <li key={m.id} className="border border-base-200 rounded-lg p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <Link href={`/matters/${m.id}`} className="link link-hover font-semibold">
                      {m.matter_name}
                    </Link>
                    <StatusBadge status={m.matter_status} />
                  </div>
                  <p className="text-xs opacity-60 mt-1">{m.matter_number}</p>
                  <p className="text-sm mt-2">
                    Lead attorney:{" "}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <span className="font-medium">{(m as any).responsible?.full_name || "—"}</span>
                  </p>
                  <p className="text-sm opacity-70">
                    Start {formatDate(m.engagement_start_date)} · Expected end{" "}
                    {formatDate(m.expected_end_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">
            Milestone updates
            {openMilestones.length > 0 ? (
              <span className="badge badge-ghost font-normal ml-2">
                {openMilestones.length} open
              </span>
            ) : null}
          </h2>
          <p className="text-sm opacity-70 -mt-1">
            These are progress checkpoints your firm chose to share. No action is required unless
            your team contacts you.
          </p>
          {tasks.length === 0 ? (
            <p className="text-sm opacity-60 mt-2">No client-visible milestones are available.</p>
          ) : (
            <ul className="space-y-2 mt-2">
              {tasks.map((t) => (
                <li key={t.id} className="text-sm flex justify-between gap-3">
                  <span>{t.task_title}</span>
                  <StatusBadge status={t.task_status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
