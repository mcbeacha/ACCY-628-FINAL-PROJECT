import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { AttorneyDocumentRequestForm } from "@/components/document-requests/AttorneyDocumentRequestForm";
import { AttorneyDocumentRequestList } from "@/components/document-requests/AttorneyDocumentRequestList";
import { ParalegalDocumentQueue } from "@/components/document-requests/ParalegalDocumentQueue";
import { ClientDocumentTasks } from "@/components/document-requests/ClientDocumentTasks";
import { redirect } from "next/navigation";
import type { Client } from "@/lib/types";

export default async function DocumentRequestsPage() {
  const { profile, supabase } = await requireUser();

  if (profile.role === "billing_staff") {
    redirect("/dashboard");
  }

  if (profile.role === "attorney" || profile.role === "managing_partner") {
    return (
      <>
        <PageHeader
          title="Document requests"
          description="Request documents from clients. Requests go to the assigned paralegal first, then to the client portal."
        />
        {profile.role === "attorney" && (
          <AttorneyDocumentRequestForm profile={profile} />
        )}
        {profile.role === "attorney" ? (
          <AttorneyDocumentRequestList profile={profile} />
        ) : (
          <ParalegalDocumentQueue profile={profile} mineOnly={false} />
        )}
      </>
    );
  }

  if (profile.role === "paralegal") {
    return (
      <>
        <PageHeader
          title="Document requests"
          description="Prepare drafts, set client due dates, collect documents, and organize them for the attorney."
        />
        <ParalegalDocumentQueue profile={profile} mineOnly />
      </>
    );
  }

  // Client
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("portal_user_id", profile.id)
    .maybeSingle();
  const clientIds = client ? [(client as Client).id] : [];

  return (
    <>
      <PageHeader
        title="Document requests"
        description="Upload documents or enter information requested by your legal team. Card colors reflect due status."
      />
      <ClientDocumentTasks profile={profile} clientIds={clientIds} />
    </>
  );
}
