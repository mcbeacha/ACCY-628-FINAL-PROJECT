import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { MessagesClient } from "./MessagesClient";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { profile } = await requireUser();
  const params = await searchParams;
  const initialThreadId = params.thread?.trim() || null;

  return (
    <>
      <PageHeader
        title="Messages"
        description={
          profile.role === "client"
            ? "Contact your assigned legal team and billing coordinator."
            : "Coordinate securely with firm staff and clients."
        }
      />
      <MessagesClient
        viewer={{
          id: profile.id,
          name: profile.full_name,
          title: profile.job_title ?? "Contact",
          email: profile.email,
          role: profile.role,
          kind: profile.role === "client" ? "client" : "staff",
        }}
        initialThreadId={initialThreadId}
      />
    </>
  );
}
