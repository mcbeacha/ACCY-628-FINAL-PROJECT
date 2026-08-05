import { PageHeader } from "@/components/PageHeader";
import { ClientPayForm } from "@/components/client-portal/ClientPayForm";
import { DEMO_CLIENT_NOTICE } from "@/lib/demo-config";
import { requireCurrentClientPortal } from "@/lib/client-portal-data";
import Link from "next/link";
import { Suspense } from "react";

export default async function ClientPortalPayPage() {
  const { invoices } = await requireCurrentClientPortal();

  return (
    <>
      <PageHeader
        title="Make a Payment"
        description="Pay an outstanding finalized invoice with a simulated payment."
        actions={
          <Link href="/client-portal/payments" className="btn btn-sm btn-ghost">
            Payment history
          </Link>
        }
      />
      <div className="alert alert-warning text-sm">
        <span>{DEMO_CLIENT_NOTICE}</span>
      </div>
      <Suspense fallback={<div className="skeleton h-64 w-full" />}>
        <ClientPayForm invoices={invoices} />
      </Suspense>
    </>
  );
}
