"use client";

import {
  DASHBOARD_ICON,
  buildNavSections,
  isNavLinkActive,
  mattersSectionTitleForRole,
  sectionIdForPath,
  type NavSectionId,
  type ResolvedNavSection,
} from "@/lib/nav-config";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import { canApproveExpenses, canApproveMatterCosts } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

type Props = {
  role: UserRole;
  /** When true, selecting a link closes the mobile drawer. */
  closeDrawerOnNavigate?: boolean;
};

function closeMobileDrawer() {
  const toggle = document.getElementById("app-drawer") as HTMLInputElement | null;
  if (toggle?.checked) toggle.checked = false;
}

function NavLinkRow({
  href,
  label,
  active,
  indented,
  onNavigate,
  badgeCount,
}: {
  href: string;
  label: string;
  active: boolean;
  indented?: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  const ariaLabel = showBadge ? `${label}, ${badgeCount} pending` : undefined;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        indented ? "ml-2 pl-4 border-l-2 border-base-300" : "",
        active
          ? "bg-primary/15 text-base-content font-semibold border-l-primary"
          : "hover:bg-base-200 opacity-90",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
    >
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
      )}
      <span className="truncate flex-1">{label}</span>
      {showBadge && (
        <span className="badge badge-warning badge-sm shrink-0" aria-hidden>
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

function SidebarSection({
  section,
  open,
  onToggle,
  allHrefs,
  pathname,
  onNavigate,
  titleLive,
  badgeCounts,
}: {
  section: ResolvedNavSection;
  open: boolean;
  onToggle: () => void;
  allHrefs: string[];
  pathname: string;
  onNavigate?: () => void;
  titleLive?: boolean;
  badgeCounts?: Record<string, number>;
}) {
  const panelId = useId();
  const Icon = section.icon;
  const hasActiveChild = section.links.some((l) =>
    isNavLinkActive(pathname, l.href, allHrefs)
  );

  return (
    <div className="mb-1">
      <button
        type="button"
        className={[
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
          "hover:bg-base-200 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          hasActiveChild ? "text-primary" : "",
        ].join(" ")}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${section.label} section`}
        onClick={onToggle}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span
          className="flex-1 text-left truncate transition-opacity duration-200"
          aria-live={titleLive ? "polite" : undefined}
        >
          {section.label}
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 opacity-60 transition-transform duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={section.label}
        className={[
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <ul className="menu menu-sm gap-0.5 py-1 pl-1">
            {section.links.map((link) => (
              <li key={link.href} className="w-full">
                <NavLinkRow
                  href={link.href}
                  label={link.label}
                  indented
                  active={isNavLinkActive(pathname, link.href, allHrefs)}
                  onNavigate={onNavigate}
                  badgeCount={badgeCounts?.[link.href]}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SidebarNav({ role, closeDrawerOnNavigate = false }: Props) {
  const pathname = usePathname();
  const demo = useDemoRole();
  // Prefer demo context so the matters heading updates as soon as View App As changes.
  const effectiveRole: UserRole = demo?.activeDemoRole ?? role;

  const { dashboard, sections } = useMemo(
    () => buildNavSections(effectiveRole),
    [effectiveRole]
  );

  const sectionsWithTitle = useMemo(
    () =>
      sections.map((section) =>
        section.id === "partner_matters"
          ? { ...section, label: mattersSectionTitleForRole(effectiveRole) }
          : section
      ),
    [sections, effectiveRole]
  );

  const allHrefs = useMemo(
    () => [
      ...(dashboard ? [dashboard.href] : []),
      ...sectionsWithTitle.flatMap((s) => s.links.map((l) => l.href)),
    ],
    [dashboard, sectionsWithTitle]
  );

  const routeSection = sectionIdForPath(pathname, sectionsWithTitle);
  const [openSection, setOpenSection] = useState<NavSectionId | null>(routeSection);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  const canSeeExpenseReview = canApproveExpenses(effectiveRole);
  const canSeeCostApproval = canApproveMatterCosts(effectiveRole);

  useEffect(() => {
    setOpenSection(routeSection);
  }, [routeSection]);

  useEffect(() => {
    let cancelled = false;

    async function loadPendingBadges() {
      const next: Record<string, number> = {};
      const supabase = createClient();

      if (canSeeExpenseReview) {
        const { count, error } = await supabase
          .from("expense_entries")
          .select("id", { count: "exact", head: true })
          .eq("approval_status", "Submitted");
        if (!error) next["/expenses/review"] = count ?? 0;
      }

      if (canSeeCostApproval) {
        const { count, error } = await supabase
          .from("matter_cost_entries")
          .select("id", { count: "exact", head: true })
          .eq("approval_status", "Submitted");
        if (!error) next["/costs/review"] = count ?? 0;
      }

      if (!cancelled) setBadgeCounts(next);
    }

    void loadPendingBadges();
    return () => {
      cancelled = true;
    };
  }, [canSeeExpenseReview, canSeeCostApproval, pathname, effectiveRole]);

  function onNavigate() {
    if (closeDrawerOnNavigate) closeMobileDrawer();
  }

  function toggleSection(id: NavSectionId) {
    setOpenSection((current) => (current === id ? null : id));
  }

  const DashIcon = DASHBOARD_ICON;

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {dashboard && (
        <div className="mb-2">
          <Link
            href={dashboard.href}
            onClick={onNavigate}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isNavLinkActive(pathname, dashboard.href, allHrefs)
                ? "bg-primary/15 text-base-content"
                : "hover:bg-base-200",
            ].join(" ")}
            aria-current={
              isNavLinkActive(pathname, dashboard.href, allHrefs) ? "page" : undefined
            }
          >
            <DashIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>{dashboard.label}</span>
          </Link>
        </div>
      )}

      {sectionsWithTitle.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          open={openSection === section.id}
          onToggle={() => toggleSection(section.id)}
          allHrefs={allHrefs}
          pathname={pathname}
          onNavigate={onNavigate}
          titleLive={section.id === "partner_matters"}
          badgeCounts={badgeCounts}
        />
      ))}
    </nav>
  );
}
