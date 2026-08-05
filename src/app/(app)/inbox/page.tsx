import { requireUser } from "@/lib/auth";
import { inboxMetaForRole, loadInboxItems } from "@/lib/inbox";
import { InboxClient } from "./InboxClient";

export default async function InboxPage() {
  const { supabase, profile } = await requireUser();
  const items = await loadInboxItems(supabase, profile.role, profile.id);
  const meta = inboxMetaForRole(profile.role);

  return (
    <InboxClient
      initialItems={items}
      meta={meta}
      userId={profile.id}
      role={profile.role}
    />
  );
}
