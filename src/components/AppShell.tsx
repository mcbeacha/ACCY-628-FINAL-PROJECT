"use client";

import { ACADEMIC_NOTICE, APP_NAME, APP_SUBTITLE, ROLE_LABELS } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import type { NavItem } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { ThemeSelector } from "@/components/ThemeSelector";
import { LogOut, Menu, Scale } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function AppShell({
  profile,
  nav,
  children,
}: {
  profile: Profile;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 border-b border-base-300 px-4 lg:px-6 sticky top-0 z-30">
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
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex-1 gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <span className="btn btn-square btn-primary btn-sm pointer-events-none">
              <Scale className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="font-display text-lg font-semibold block truncate">
                {APP_NAME}
              </span>
              <span className="text-xs opacity-60 hidden sm:block truncate">
                {APP_SUBTITLE}
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-none items-center gap-2 sm:gap-3 flex">
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
        </div>
      </div>

      <div className="drawer lg:drawer-open">
        <input id="app-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content p-4 sm:p-6 lg:p-8">
          <main className="max-w-7xl mx-auto page-shell">{children}</main>
          <footer className="max-w-7xl mx-auto mt-10 pb-6 text-center text-xs opacity-60">
            {ACADEMIC_NOTICE}
          </footer>
        </div>
        <div className="drawer-side is-drawer-close:overflow-visible z-20">
          <label htmlFor="app-drawer" className="drawer-overlay lg:hidden" />
          <aside className="bg-base-100 border-r border-base-300 min-h-full w-64 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-3 px-2">
              Navigation
            </p>
            <ul className="menu gap-1">
              {nav.map((item) => (
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
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 p-3 rounded-lg bg-base-200 text-xs opacity-70">
              Signed in as <span className="font-semibold">{profile.email}</span>
              <div className="mt-1 md:hidden">{ROLE_LABELS[profile.role]}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
