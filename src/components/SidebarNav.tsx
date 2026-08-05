"use client";

import {
  DASHBOARD_ICON,
  INBOX_ICON,
  buildNavSectionsForDemoKey,
  isNavLinkActive,
  mattersSectionTitleForDemoKey,
  sectionIdForPath,
  type NavSectionId,
  type ResolvedNavSection,
} from "@/lib/nav-config";
import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import type { DemoRoleKey } from "@/lib/demo-config";
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
  onDemoSwitch,
}: {
  href: string;
  label: string;
  active: boolean;
  indented?: boolean;
  onNavigate?: () => void;
  /** Demo Mode: switch Potential ↔ Current Client instead of a plain link. */
  onDemoSwitch?: () => void;
}) {
  const className = [
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-full text-left",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    indented ? "ml-2 pl-4 border-l-2 border-base-300" : "",
    active
      ? "bg-primary/15 text-base-content font-semibold border-l-primary"
      : "hover:bg-base-200 opacity-90",
  ].join(" ");

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
      >
        {active && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
        )}
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={className}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
      )}
      <span className="truncate">{label}</span>
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
}: {
  section: ResolvedNavSection;
  open: boolean;
  onToggle: () => void;
  allHrefs: string[];
  pathname: string;
  onNavigate?: () => void;
  titleLive?: boolean;
  onDemoExperienceLink?: (href: string) => (() => void) | undefined;
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
                  onDemoSwitch={onDemoExperienceLink?.(link.href)}
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

  const { dashboard, inbox, sections } = useMemo(
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
    ],
    [dashboard, inbox, sectionsWithTitle]
  );

  const routeSection = sectionIdForPath(pathname, sectionsWithTitle);
  const [openSection, setOpenSection] = useState<NavSectionId | null>(routeSection);

  useEffect(() => {
    setOpenSection(routeSection);
  }, [routeSection]);

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

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {dashboard && (
        <div className="mb-1">
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

      {inbox && (
        <div className="mb-2">
          <Link
            href={inbox.href}
            onClick={onNavigate}
            className={[
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isNavLinkActive(pathname, inbox.href, allHrefs)
                ? "bg-primary/15 text-base-content"
                : "hover:bg-base-200",
            ].join(" ")}
            aria-current={
              isNavLinkActive(pathname, inbox.href, allHrefs) ? "page" : undefined
            }
          >
            <InboxIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span>{inbox.label}</span>
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
          onDemoExperienceLink={onDemoExperienceLink}
        />
      ))}
    </nav>
  );
}
