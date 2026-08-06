"use client";

import { ACADEMIC_NOTICE, APP_NAME, APP_SUBTITLE, ROLE_LABELS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import type { NavItem } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { ThemeSelector } from "@/components/ThemeSelector";
import { SidebarNav } from "@/components/SidebarNav";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import {
  DemoModeNoticeBar,
  DemoModeToast,
  DemoRoleSelector,
} from "@/components/demo/DemoRoleSelector";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import { isClientExperienceDemoKey, isPotentialClientDemoKey } from "@/lib/demo-config";
import { GlobalSearch } from "@/components/workspace/GlobalSearch";
import { MessagesIndicator } from "@/components/workspace/MessagesIndicator";
import { NotificationCenter } from "@/components/workspace/NotificationCenter";
import type { MessagingPerson } from "@/lib/messaging";
import { LogOut, Menu, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AppShell({
  profile,
  nav: _nav,
  children,
  demoMode = false,
}: {
  profile: Profile;
  nav: NavItem[];
  children: React.ReactNode;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const demo = useDemoRole();
  const viewBadge = demo?.activeIdentity.viewBadge;
  const isStaff = !isClientExperienceDemoKey(demo?.activeDemoRole ?? profile.role);
  // The prospective-client experience is a marketing view with no inbox.
  const hasWorkspaceInbox = !isPotentialClientDemoKey(demo?.activeDemoRole);

  // The header messaging and notification controls follow the signed-in profile;
  // in Demo Mode each component re-resolves this against the active identity.
  const headerViewer: MessagingPerson = {
    id: profile.id,
    name: profile.full_name,
    title: profile.job_title ?? "Contact",
    email: profile.email,
    role: profile.role,
    kind: profile.role === "client" ? "client" : "staff",
  };

  async function logout() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen app-canvas">
      {demoMode && <DemoModeNoticeBar />}

      <div className="drawer lg:drawer-open">
        <input id="app-drawer" type="checkbox" className="drawer-toggle" />

        <div className="drawer-content flex flex-col min-h-screen">
          <div className="navbar app-navbar border-b px-2 sm:px-4 lg:px-6 sticky top-0 z-30 gap-1">
            <div className="flex-none lg:hidden">
              <label
                htmlFor="app-drawer"
                className="btn btn-ghost btn-square"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </label>
            </div>

            <div className="flex-1 gap-2 sm:gap-3 min-w-0">
              <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
                <span className="btn btn-square btn-primary btn-sm pointer-events-none app-brand-mark shadow-none">
                  <Scale className="h-4 w-4" />
                </span>
                <span className="min-w-0 hidden xs:block sm:block">
                  <span className="font-display text-[0.95rem] sm:text-base block truncate leading-tight">
                    {APP_NAME}
                  </span>
                  <span className="text-[0.7rem] text-base-content/50 hidden md:block truncate tracking-wide uppercase">
                    {APP_SUBTITLE}
                  </span>
                </span>
              </Link>
              {isStaff && <GlobalSearch />}
            </div>

            <div className="flex-none items-center gap-1 sm:gap-2 flex min-w-0">
              {hasWorkspaceInbox && (
                <>
                  <MessagesIndicator viewer={headerViewer} />
                  <NotificationCenter viewer={headerViewer} />
                </>
              )}
              {demoMode ? (
                <DemoRoleSelector />
              ) : (
                <>
                  <div className="hidden md:block text-right">
                    <div className="text-sm font-semibold leading-tight">
                      {profile.full_name}
                    </div>
                    <div className="text-xs opacity-60">{ROLE_LABELS[profile.role]}</div>
                  </div>
                  <ThemeSelector compact />
                  <button
                    className="btn btn-ghost btn-sm gap-1"
                    onClick={logout}
                    disabled={busy}
                    type="button"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Log out</span>
                  </button>
                </>
              )}
              {demoMode && <ThemeSelector compact />}
            </div>
          </div>

          {demoMode && <DemoModeToast />}

          <div className="p-4 sm:p-6 lg:p-8 flex-1">
            <main className="max-w-7xl mx-auto page-shell">
              {demoMode && <DemoModeBanner />}
              {demoMode && viewBadge && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`badge badge-sm ${
                      profile.role === "client"
                        ? "badge-accent"
                        : profile.role === "managing_partner"
                          ? "badge-primary"
                          : "badge-ghost"
                    }`}
                  >
                    {viewBadge}
                  </span>
                  <span className="text-sm opacity-70">
                    {profile.full_name}
                    <span className="opacity-50"> · </span>
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>
              )}
              {children}
            </main>
            <footer className="max-w-7xl mx-auto mt-10 pb-6 text-center text-xs opacity-60">
              {demoMode
                ? "Demo Mode is active. This academic application uses fictional data and does not require authentication. The role selector is a presentation tool, not real authentication."
                : ACADEMIC_NOTICE}
            </footer>
          </div>
        </div>

        <div className="drawer-side z-40">
          <label
            htmlFor="app-drawer"
            className="drawer-overlay lg:hidden"
            aria-label="Close navigation menu"
          />
          <aside className="app-sidebar min-h-full w-72 max-w-[85vw] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-5 px-1 lg:hidden">
              <span className="btn btn-square btn-primary btn-xs pointer-events-none app-brand-mark shadow-none">
                <Scale className="h-3.5 w-3.5" />
              </span>
              <span className="font-display truncate text-sm">{APP_NAME}</span>
            </div>
            <p className="app-sidebar-label text-[0.65rem] font-semibold uppercase tracking-[0.16em] mb-3 px-2">
              Workspace
            </p>
            <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
              <SidebarNav role={profile.role} closeDrawerOnNavigate />
            </div>
            <div className="app-sidebar-foot mt-6 p-3 rounded-md text-xs">
              {demoMode ? (
                <>
                  Demo user: <span className="font-semibold text-[var(--sidebar-fg)]">{profile.full_name}</span>
                  <div className="mt-1">{ROLE_LABELS[profile.role]}</div>
                  <div className="mt-2 opacity-80">
                    Simulated permissions for presentation — not real authentication.
                  </div>
                </>
              ) : (
                <>
                  Signed in as <span className="font-semibold text-[var(--sidebar-fg)]">{profile.email}</span>
                  <div className="mt-1 md:hidden">{ROLE_LABELS[profile.role]}</div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
