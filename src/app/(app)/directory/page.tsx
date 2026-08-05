import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { DirectoryClient } from "./DirectoryClient";

export default async function DirectoryPage() {
  const { profile } = await requireUser();

  if (profile.role === "client") {
    redirect("/dashboard");
  }

  return (
    <>
      <PageHeader
        title="Firm Directory"
        description="Find colleagues across offices, departments, and practice areas."
      />
      <DirectoryClient />
    </>
  );
}
