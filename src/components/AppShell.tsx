"use client";

import { ACADEMIC_NOTICE, APP_NAME, APP_SUBTITLE, ROLE_LABELS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import type { NavIcon, NavItem } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { ThemeSelector } from "@/components/ThemeSelector";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import {
  DemoModeNoticeBar,
  DemoModeToast,
  DemoRoleSelector,
} from "@/components/demo/DemoRoleSelector";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import { GlobalSearch } from "@/components/workspace/GlobalSearch";
import { NotificationCenter } from "@/components/workspace/NotificationCenter";
import {
  Activity,
  Banknote,
  BarChart3,
  BookOpen,
  BookText,
  Briefcase,
  Calendar,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Hourglass,
  Landmark,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Receipt,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  matters: Briefcase,
  clients: Users,
  calendar: Calendar,
  tasks: ListChecks,
  documents: FileText,
  time: Clock,
  expenses: Receipt,
  messages: MessageSquare,
  research: BookOpen,
  reports: BarChart3,
  directory: Users,
  resources: Library,
  settings: Settings,
  profitability: TrendingUp,
  productivity: Activity,
  quality: ShieldCheck,
  controls: ShieldAlert,
  billing: FileCheck,
  invoices: FileSpreadsheet,
  payments: CreditCard,
  receivables: Banknote,
  retainers: Wallet,
  trust: Landmark,
  journal: BookText,
  unbilled: Hourglass,
  review: ClipboardCheck,
};

function NavIconGlyph({ icon }: { icon?: NavIcon }) {
  if (!icon) return null;
  const Glyph = NAV_ICONS[icon];
  return <Glyph className="h-4 w-4 shrink-0 opacity-80" />;
}

/** Preserves the order of `nav` while splitting it into sidebar groups. */
function groupNav(nav: NavItem[]): [string, NavItem[]][] {
  const groups: [string, NavItem[]][] = [];
  for (const item of nav) {
    const key = item.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(item);
    else groups.push([key, [item]]);
  }
  return groups;
}

export function AppShell({
  profile,
  nav,
  children,
  demoMode = false,
}: {
  profile: Profile;
  nav: NavItem[];
  children: React.ReactNode;
  demoMode?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const demo = useDemoRole();
  const viewBadge = demo?.activeIdentity.viewBadge;
  const isStaff = profile.role !== "client";
  const navGroups = groupNav(nav);

  async function logout() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-base-200">
      {demoMode && <DemoModeNoticeBar />}

      <div className="navbar bg-base-100 border-b border-base-300 px-2 sm:px-4 lg:px-6 sticky top-0 z-30 gap-1">
        <div className="flex-none lg:hidden">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-square">
              <Menu className="h-5 w-5" />
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-50 mt-3 w-56 p-2 shadow border border-base-300"
            >
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={pathname.startsWith(item.href) ? "active" : ""}
                  >
                    <NavIconGlyph icon={item.icon} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex-1 gap-2 sm:gap-3 min-w-0 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <span className="btn btn-square btn-primary btn-sm pointer-events-none">
              <Scale className="h-4 w-4" />
            </span>
            <span className="min-w-0 hidden xs:block sm:block">
              <span className="font-display text-base sm:text-lg font-semibold block truncate">
                {APP_NAME}
              </span>
              <span className="text-xs opacity-60 hidden lg:block truncate">
                {APP_SUBTITLE}
              </span>
            </span>
          </Link>
          {isStaff && (
            <div className="ml-2 xl:ml-6">
              <GlobalSearch />
            </div>
          )}
        </div>

        <div className="flex-none items-center gap-1 sm:gap-2 flex min-w-0">
          {isStaff && <NotificationCenter />}
          {demoMode ? (
            <DemoRoleSelector />
          ) : (
            <>
              <div className="hidden md:block text-right">
                <div className="text-sm font-semibold leading-tight">{profile.full_name}</div>
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

      <div className="drawer lg:drawer-open">
        <input id="app-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content p-4 sm:p-6 lg:p-8">
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
        <div className="drawer-side is-drawer-close:overflow-visible z-20">
          <label htmlFor="app-drawer" className="drawer-overlay lg:hidden" />
          <aside className="bg-base-100 border-r border-base-300 min-h-full w-64 p-4">
            {navGroups.map(([group, items], index) => (
              <div key={group || `group-${index}`} className={index === 0 ? "" : "mt-4"}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-2 px-2">
                  {group || "Navigation"}
                </p>
                <ul className="menu gap-1 p-0">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          pathname === item.href ||
                          (item.href !== "/dashboard" && pathname.startsWith(item.href))
                            ? "active font-semibold"
                            : ""
                        }
                      >
                        <NavIconGlyph icon={item.icon} />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-8 p-3 rounded-lg bg-base-200 text-xs opacity-70">
              {demoMode ? (
                <>
                  Demo user: <span className="font-semibold">{profile.full_name}</span>
                  <div className="mt-1">{ROLE_LABELS[profile.role]}</div>
                  <div className="mt-2 opacity-60">
                    Simulated permissions for presentation — not real authentication.
                  </div>
                </>
              ) : (
                <>
                  Signed in as <span className="font-semibold">{profile.email}</span>
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
