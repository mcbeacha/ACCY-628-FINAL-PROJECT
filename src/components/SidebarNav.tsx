"use client";

import {
  DASHBOARD_ICON,
  INBOX_ICON,
  SETTINGS_ICON,
  buildNavSectionsForDemoKey,
  isNavLinkActive,
  mattersSectionTitleForDemoKey,
  sectionIdForPath,
  type NavSectionId,
  type ResolvedNavSection,
} from "@/lib/nav-config";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import type { DemoRoleKey } from "@/lib/demo-config";
import {
  expenseRequiredApproverRole,
  type ApprovalMatterContext,
} from "@/lib/approval-tiers";
import { getFirmThresholds } from "@/lib/firm-thresholds";
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

function permissionRoleForDemoKey(key: DemoRoleKey | UserRole): UserRole {
  if (key === "potential_client" || key === "current_client") return "client";
  return key as UserRole;
}

function NavLinkRow({
  href,
  label,
  active,
  indented,
  onNavigate,
  onDemoSwitch,
  badgeCount,
}: {
  href: string;
  label: string;
  active: boolean;
  indented?: boolean;
  onNavigate?: () => void;
  /** Demo Mode: switch Potential ↔ Current Client instead of a plain link. */
  onDemoSwitch?: () => void;
  badgeCount?: number;
}) {
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  const ariaLabel = showBadge ? `${label}, ${badgeCount} pending` : undefined;
  const className = [
    "nav-link",
    indented ? "nav-link-indent" : "",
    active ? "nav-link-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onDemoSwitch) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          onNavigate?.();
          onDemoSwitch();
        }}
        aria-current={active ? "page" : undefined}
        aria-label={ariaLabel}
      >
        {active && (
          <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-hidden />
        )}
        <span className="truncate flex-1">{label}</span>
        {showBadge && (
          <span className="badge badge-sm shrink-0 border-0 bg-accent/90 text-accent-content" aria-hidden>
            {badgeCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={className}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
    >
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-hidden />
      )}
      <span className="truncate flex-1">{label}</span>
      {showBadge && (
        <span className="badge badge-sm shrink-0 border-0 bg-accent/90 text-accent-content" aria-hidden>
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
  onDemoExperienceLink,
  badgeCounts,
}: {
  section: ResolvedNavSection;
  open: boolean;
  onToggle: () => void;
  allHrefs: string[];
  pathname: string;
  onNavigate?: () => void;
  titleLive?: boolean;
  onDemoExperienceLink?: (href: string) => (() => void) | undefined;
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
          "nav-section-btn",
          hasActiveChild ? "nav-section-btn-active" : "",
        ].join(" ")}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${section.label} section`}
        onClick={onToggle}
      >
        <Icon
          className={[
            "nav-link-icon h-4 w-4 shrink-0",
            hasActiveChild ? "opacity-100 text-primary" : "opacity-70",
          ].join(" ")}
          aria-hidden
        />
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
                  onDemoSwitch={onDemoExperienceLink?.(link.href)}
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
  const effectiveKey = (demo?.activeDemoRole ?? role) as DemoRoleKey | UserRole;
  const effectiveRole = permissionRoleForDemoKey(effectiveKey);

  const { dashboard, inbox, settings, sections } = useMemo(
    () => buildNavSectionsForDemoKey(effectiveKey),
    [effectiveKey]
  );

  const sectionsWithTitle = useMemo(
    () =>
      sections.map((section) =>
        section.id === "partner_matters"
          ? { ...section, label: mattersSectionTitleForDemoKey(effectiveKey) }
          : section
      ),
    [sections, effectiveKey]
  );

  const allHrefs = useMemo(
    () => [
      ...(dashboard ? [dashboard.href] : []),
      ...(inbox ? [inbox.href] : []),
      ...sectionsWithTitle.flatMap((s) => s.links.map((l) => l.href)),
      ...(settings ? [settings.href] : []),
    ],
    [dashboard, inbox, sectionsWithTitle, settings]
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
        const thresholds = await getFirmThresholds(supabase);
        const { data, error } = await supabase
          .from("expense_entries")
          .select(
            "id, amount, created_by, required_approver_role, matters(billing_method, practice_area, responsible_attorney_id)"
          )
          .eq("approval_status", "Submitted");
        if (!error) {
          const rows = (data || []) as {
            id: string;
            amount: number;
            created_by?: string | null;
            required_approver_role?: string | null;
            matters?: ApprovalMatterContext | null;
          }[];
          const count = rows.filter((row) => {
            const required = expenseRequiredApproverRole({
              matter: row.matters,
              amount: Number(row.amount),
              thresholds,
              stampedRequiredRole: row.required_approver_role,
            });
            if (effectiveRole === "managing_partner") {
              return required === "managing_partner";
            }
            if (effectiveRole === "billing_staff") {
              // Count items billing can act on (not self-submitted)
              return required === "billing_staff";
            }
            return false;
          }).length;
          if (count > 0) next["/expenses/review"] = count;
        }
      }

      if (canSeeCostApproval) {
        const { count, error } = await supabase
          .from("matter_cost_entries")
          .select("id", { count: "exact", head: true })
          .eq("approval_status", "Submitted");
        if (!error && (count ?? 0) > 0) next["/costs/review"] = count ?? 0;
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

  function onDemoExperienceLink(href: string) {
    if (!demo) return undefined;
    const base = href.split("#")[0];
    if (base === "/client-portal" && effectiveKey === "potential_client") {
      return () => void demo.setActiveDemoRole("current_client");
    }
    if (base === "/potential-client" && (effectiveKey === "current_client" || effectiveKey === "client")) {
      return () => void demo.setActiveDemoRole("potential_client");
    }
    return undefined;
  }

  function toggleSection(id: NavSectionId) {
    setOpenSection((current) => (current === id ? null : id));
  }

  const DashIcon = DASHBOARD_ICON;
  const InboxIcon = INBOX_ICON;
  const SettingsIcon = SETTINGS_ICON;

  return (
    <nav className="flex flex-col gap-1 h-full" aria-label="Main">
      {dashboard && (
        <div className="mb-1">
          <Link
            href={dashboard.href}
            onClick={onNavigate}
            className={[
              "nav-link",
              isNavLinkActive(pathname, dashboard.href, allHrefs) ? "nav-link-active" : "",
            ].join(" ")}
            aria-current={
              isNavLinkActive(pathname, dashboard.href, allHrefs) ? "page" : undefined
            }
          >
            <DashIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="font-semibold">{dashboard.label}</span>
          </Link>
        </div>
      )}

      {inbox && (
        <div className="mb-2">
          <Link
            href={inbox.href}
            onClick={onNavigate}
            className={[
              "nav-link",
              isNavLinkActive(pathname, inbox.href, allHrefs) ? "nav-link-active" : "",
            ].join(" ")}
            aria-current={
              isNavLinkActive(pathname, inbox.href, allHrefs) ? "page" : undefined
            }
          >
            <InboxIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="font-semibold">{inbox.label}</span>
          </Link>
        </div>
      )}

      <div className="flex-1 min-h-0">
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
            onDemoExperienceLink={onDemoExperienceLink}
            badgeCounts={badgeCounts}
          />
        ))}
      </div>

      {settings && (
        <div className="mt-auto pt-3 border-t border-base-300/60">
          <Link
            href={settings.href}
            onClick={onNavigate}
            className={[
              "nav-link",
              isNavLinkActive(pathname, settings.href, allHrefs) ? "nav-link-active" : "",
            ].join(" ")}
            aria-current={
              isNavLinkActive(pathname, settings.href, allHrefs) ? "page" : undefined
            }
          >
            <SettingsIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="font-semibold">{settings.label}</span>
          </Link>
        </div>
      )}
    </nav>
  );
}
