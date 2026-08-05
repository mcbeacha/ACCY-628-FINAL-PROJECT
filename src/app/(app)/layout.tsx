import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-config";
import { navForRole } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import { DemoRoleProvider } from "@/components/demo/DemoRoleProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const nav = navForRole(profile.role);
  const demo = isDemoMode();

  const shell = (
    <AppShell profile={profile} nav={nav} demoMode={demo}>
      {children}
    </AppShell>
  );

  if (demo) {
    return <DemoRoleProvider profile={profile}>{shell}</DemoRoleProvider>;
  }

  return shell;
}
