import { requireUser } from "@/lib/auth";
import { navForRole } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return (
    <AppShell profile={profile} nav={navForRole(profile.role)}>
      {children}
    </AppShell>
  );
}
