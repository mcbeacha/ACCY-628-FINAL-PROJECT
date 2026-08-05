import { requireUser } from "@/lib/auth";
import { inboxMetaForRole, loadInboxItems } from "@/lib/inbox";
import { InboxClient } from "./InboxClient";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();
  const items = await loadInboxItems(supabase, profile.role, profile.id);
  const meta = inboxMetaForRole(profile.role);

  return (
    <InboxClient
      initialItems={items}
      meta={meta}
      userId={profile.id}
      role={profile.role}
      initialKind={sp.kind}
    />
  );
}
