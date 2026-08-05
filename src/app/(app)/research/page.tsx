import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { ResearchClient } from "./ResearchClient";

export default async function ResearchPage() {
  const { profile } = await requireUser();
  if (profile.role === "client") redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Legal Research"
        description="Browse fictional case summaries and save findings to matters for this session."
      />
      <ResearchClient />
    </>
  );
}
