import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
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

  return (
    <>
      <PageHeader
        title="Client Portal"
        description="A simplified portal for your engagements. This application uses fictional data only."
      />

      {client ? (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Your profile</h2>
            <p className="text-sm">
              <span className="font-semibold">{clientDisplayName(client as Client)}</span>
              <span className="opacity-60"> · {(client as Client).client_number}</span>
            </p>
            <p className="text-sm opacity-80">{(client as Client).email}</p>
            <Link href="/portal/billing" className="btn btn-sm btn-primary w-fit">
              View invoices & payments
            </Link>
            <Link href={`/clients/${(client as Client).id}`} className="btn btn-sm btn-outline w-fit">
              View client profile
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState title="No client profile is linked to this login yet." />
      )}

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Your matters</h2>
          {matterRows.length === 0 ? (
            <EmptyState title="No active matters are currently available for this client." />
          ) : (
            <ul className="space-y-3">
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
          <h2 className="card-title text-base">Visible milestones</h2>
          {tasks.length === 0 ? (
            <p className="text-sm opacity-60">No client-visible tasks are available.</p>
          ) : (
            <ul className="space-y-2">
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
    </>
  );
}
