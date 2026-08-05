import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { DocumentsClient } from "./DocumentsClient";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  const { profile } = await requireUser();
  if (profile.role === "client") redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Documents"
        description="Search, filter, and manage matter documents, shared files, and firm templates."
      />
      <DocumentsClient />
    </>
  );
}
