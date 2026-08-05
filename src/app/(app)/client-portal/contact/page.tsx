import { PageHeader } from "@/components/PageHeader";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { FIRM_CONTACT } from "@/lib/client-home-content";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import { clientDisplayName } from "@/lib/format";

export default async function ClientPortalContactPage() {
  const { client, matters, paralegal } = await requireCurrentClientPortal();
  const primary = matters.find((m) => m.matter_status === "Active") || matters[0];

  return (
    <>
      <PageHeader
        title="Contact My Legal Team"
        description={`Reach the attorneys and staff working with ${clientDisplayName(client)}.`}
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-box border border-base-300 bg-base-100 p-5">
          <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">Lead attorney</p>
          <h2 className="font-display text-xl font-semibold mt-1">
            {primary?.responsible?.full_name || "Assigned attorney"}
          </h2>
          <p className="text-sm opacity-70">{primary?.responsible?.job_title || "Attorney"}</p>
          <p className="text-sm mt-3">{primary?.responsible?.email || FIRM_CONTACT.email}</p>
          <p className="text-sm">{FIRM_CONTACT.phone}</p>
          {primary && (
            <p className="text-xs opacity-60 mt-3">Connected matter: {primary.matter_name}</p>
          )}
        </article>
        <article className="rounded-box border border-base-300 bg-base-100 p-5">
          <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">
            Primary paralegal / client contact
          </p>
          <h2 className="font-display text-xl font-semibold mt-1">
            {paralegal?.full_name || "Priya Rose"}
          </h2>
          <p className="text-sm opacity-70">{paralegal?.job_title || "Paralegal"}</p>
          <p className="text-sm mt-3">{paralegal?.email || "prose@rebellaw.demo"}</p>
          <p className="text-sm">{FIRM_CONTACT.phone}</p>
          <p className="text-sm mt-3 opacity-75">
            Office hours (fictional): Monday–Friday, 9:00 a.m. – 5:00 p.m. Central
          </p>
        </article>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Contact information</h2>
          <p className="text-sm opacity-80">
            Rebel Law Group · {FIRM_CONTACT.address} · {FIRM_CONTACT.phone} · {FIRM_CONTACT.email}
          </p>
          <p className="text-sm opacity-60">
            This academic demonstration does not include a live messaging inbox. Use the contact
            details above for fictional client-service scenarios.
          </p>
        </div>
      </div>
    </>
  );
}
