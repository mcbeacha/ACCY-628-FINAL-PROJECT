import { requireUser } from "@/lib/auth";
import { canCreateClients } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/Badges";
import { InteractiveTableRow } from "@/components/InteractiveTableRow";
import { clientDisplayName, formatDate } from "@/lib/format";
import type { Client } from "@/lib/types";
import { CLIENT_STATUSES } from "@/lib/constants";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { profile, supabase } = await requireUser();
  const params = await searchParams;

  if (profile.role === "client" || profile.role === "paralegal") {
    redirect("/dashboard");
  }

  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (params.status) query = query.eq("client_status", params.status);
  const { data } = await query;
  let clients = (data || []) as Client[];

  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    clients = clients.filter((c) => {
      const hay = [
        c.client_number,
        c.first_name,
        c.last_name,
        c.organization_name,
        c.email,
        c.primary_contact_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const isAttorney = profile.role === "attorney";

  return (
    <>
      <PageHeader
        title="Clients"
        description="Fictional client records used for engagement and matter setup."
        actions={
          <>
            {isAttorney ? (
              <a
                href="/api/attorney/clients-export"
                className="btn btn-outline btn-sm"
                title="Export all clients you can access to Excel"
              >
                Export to Excel
              </a>
            ) : null}
            {canCreateClients(profile.role) ? (
              <Link href="/clients/new" className="btn btn-primary btn-sm">
                New client
              </Link>
            ) : null}
          </>
        }
      />

      <form className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body py-4 gap-3 sm:flex sm:items-end sm:flex-row">
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Search</span>
            <input
              name="q"
              defaultValue={params.q || ""}
              className="input input-bordered"
              placeholder="Name, email, or client number"
            />
          </label>
          <label className="form-control w-full sm:max-w-xs">
            <span className="label-text font-semibold text-sm">Status</span>
            <select name="status" defaultValue={params.status || ""} className="select select-bordered">
              <option value="">All statuses</option>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">
            Apply
          </button>
        </div>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          title="No clients have been added yet. Create the first client to begin setting up an engagement."
          description={params.q || params.status ? "No clients match your current filters." : undefined}
          action={
            canCreateClients(profile.role) ? (
              <Link href="/clients/new" className="btn btn-primary">
                Create client
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client #</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <InteractiveTableRow key={c.id} href={`/clients/${c.id}`}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="link link-hover font-medium">
                        {c.client_number}
                      </Link>
                    </td>
                    <td>{clientDisplayName(c)}</td>
                    <td>{c.client_type}</td>
                    <td>
                      <StatusBadge status={c.client_status} />
                    </td>
                    <td className="text-sm">{c.email || "—"}</td>
                    <td className="text-sm">{formatDate(c.created_at)}</td>
                  </InteractiveTableRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
