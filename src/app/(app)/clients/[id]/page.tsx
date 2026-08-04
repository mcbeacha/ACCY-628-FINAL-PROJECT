import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { EmptyState } from "@/components/EmptyState";
import { clientDisplayName, formatDate } from "@/lib/format";
import type { Client, Matter } from "@/lib/types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, supabase } = await requireUser();

  if (profile.role === "paralegal") {
    redirect("/dashboard");
  }

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  if (profile.role === "client" && client.portal_user_id !== profile.id) {
    notFound();
  }

  const { data: matters } = await supabase
    .from("matters")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });
  const matterRows = (matters || []) as Matter[];
  const activeCount = matterRows.filter((m) => m.matter_status === "Active").length;
  const c = client as Client;
  const isClientUser = profile.role === "client";

  return (
    <>
      <PageHeader
        title={clientDisplayName(c)}
        description={
          isClientUser
            ? "Your client profile (simplified view)."
            : `Client ${c.client_number} · ${c.client_type}`
        }
        actions={
          !isClientUser ? (
            <Link href={`/matters/new?client_id=${c.id}`} className="btn btn-primary btn-sm">
              New matter
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card bg-base-100 border border-base-300 shadow-sm lg:col-span-2">
          <div className="card-body">
            <h2 className="card-title text-base">Profile</h2>
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="opacity-60">Client number</dt>
                <dd className="font-medium">{c.client_number}</dd>
              </div>
              <div>
                <dt className="opacity-60">Type</dt>
                <dd className="font-medium">{c.client_type}</dd>
              </div>
              {!isClientUser && (
                <div>
                  <dt className="opacity-60">Status</dt>
                  <dd>
                    <StatusBadge status={c.client_status} />
                  </dd>
                </div>
              )}
              <div>
                <dt className="opacity-60">Primary contact</dt>
                <dd className="font-medium">
                  {c.primary_contact_name ||
                    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="opacity-60">Email</dt>
                <dd className="font-medium">{c.email || "—"}</dd>
              </div>
              <div>
                <dt className="opacity-60">Phone</dt>
                <dd className="font-medium">{c.phone || "—"}</dd>
              </div>
              {!isClientUser && (
                <div>
                  <dt className="opacity-60">Billing email</dt>
                  <dd className="font-medium">{c.billing_email || "—"}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="opacity-60">Address</dt>
                <dd className="font-medium">
                  {[c.address_line_1, c.address_line_2, c.city, c.state, c.postal_code]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="opacity-60">Created</dt>
                <dd className="font-medium">{formatDate(c.created_at)}</dd>
              </div>
              <div>
                <dt className="opacity-60">Active matters</dt>
                <dd className="font-medium">{activeCount}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Related matters</h2>
            {matterRows.length === 0 ? (
              <EmptyState title="No matters for this client yet." />
            ) : (
              <ul className="space-y-3">
                {matterRows.map((m) => (
                  <li key={m.id} className="text-sm">
                    <Link href={`/matters/${m.id}`} className="link link-hover font-medium">
                      {m.matter_number} · {m.matter_name}
                    </Link>
                    <div className="mt-1">
                      <StatusBadge status={m.matter_status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
