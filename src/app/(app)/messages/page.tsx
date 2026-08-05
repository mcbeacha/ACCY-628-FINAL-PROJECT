import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { redirect } from "next/navigation";
import { MessagesClient } from "./MessagesClient";

export default async function MessagesPage() {
  const { profile } = await requireUser();
  if (profile.role === "client") redirect("/client-portal");

  return (
    <>
      <PageHeader
        title="Messages"
        description="Secure correspondence with clients, counsel, and the court."
      />
      <MessagesClient />
    </>
  );
}
