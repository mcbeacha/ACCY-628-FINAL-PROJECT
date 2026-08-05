import type { NavItem } from "@/lib/permissions";
import { navForDemoKey, navForRole } from "@/lib/permissions";
import type { DemoRoleKey } from "@/lib/demo-config";
import type { UserRole } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ChartColumn,
  FileText,
  Inbox,
  LayoutDashboard,
  Library,
  Receipt,
  Scale,
} from "lucide-react";

export type NavSectionId =
  | "partner_matters"
  | "contracts"
  | "billing"
  | "financial_analysis"
  | "firm"
  | "more";

export type NavLinkDef = {
  href: string;
  /** Default label; role-specific label from navForRole wins when present. */
  label: string;
};

export type NavSectionDef = {
  id: NavSectionId;
  label: string;
  icon: LucideIcon;
  links: NavLinkDef[];
};

/**
 * Canonical sidebar sections. Child visibility is intersected with navForRole(role).
 * Links not listed here but present in navForRole appear under "More".
 */
export const NAV_SECTIONS: NavSectionDef[] = [
  {
    id: "partner_matters",
    label: "Matters & Clients",
    icon: Briefcase,
    links: [
      { href: "/clients", label: "Clients" },
      { href: "/matters", label: "Matters" },
      { href: "/case-evaluations", label: "Case Evaluations" },
      { href: "/tasks", label: "Tasks" },
      { href: "/calendar", label: "Calendar" },
      { href: "/documents", label: "Documents" },
    ],
  },
  {
    id: "contracts",
    label: "Costs & Vendors",
    icon: FileText,
    links: [
      { href: "/vendors", label: "Vendors" },
      { href: "/costs", label: "Cost & Resources" },
      { href: "/costs/new", label: "Cost Entry" },
      { href: "/costs/vendor-charge", label: "Vendor Charge" },
      { href: "/costs/allocations", label: "Cost Allocations" },
      { href: "/costs/review", label: "Cost Approval" },
    ],
  },
  {
    id: "billing",
    label: "Billing & Collections",
    icon: Receipt,
    links: [
      { href: "/billing-readiness", label: "Billing Readiness" },
      { href: "/time/review", label: "Time Review" },
      { href: "/expenses/review", label: "Expense Review" },
      { href: "/unbilled", label: "Unbilled Activity" },
      { href: "/invoices", label: "Invoices" },
      { href: "/payments", label: "Payments" },
      // Existing working pages kept reachable (not removed)
      { href: "/invoices/new", label: "Prepare Invoice" },
      { href: "/ar", label: "Accounts Receivable" },
      { href: "/retainers", label: "Retainers" },
      { href: "/trust-ledger", label: "Trust Ledger" },
      { href: "/journal", label: "Journal Entries" },
      { href: "/portal/billing", label: "My Invoices & Payments" },
    ],
  },
  {
    id: "financial_analysis",
    label: "Insights & Controls",
    icon: ChartColumn,
    links: [
      { href: "/profitability/matters", label: "Matter Profitability" },
      { href: "/profitability/clients", label: "Client Profitability" },
      { href: "/profitability/practice-areas", label: "Practice Areas" },
      { href: "/productivity", label: "Attorney Productivity" },
      { href: "/reports", label: "Reports" },
      { href: "/data-quality", label: "Data Quality" },
      { href: "/controls", label: "Control Monitor" },
    ],
  },
  {
    id: "firm",
    label: "Firm & Resources",
    icon: Library,
    links: [
      { href: "/messages", label: "Messages" },
      { href: "/research", label: "Legal Research" },
      { href: "/directory", label: "Firm Directory" },
      { href: "/resources", label: "Resources" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export const DASHBOARD_LINK: NavLinkDef = {
  href: "/dashboard",
  label: "Dashboard",
};

export const DASHBOARD_ICON = LayoutDashboard;
export const INBOX_ICON = Inbox;

/**
 * First sidebar section title by active role.
 * Only the heading changes — child links stay role-filtered via navForRole.
 */
export function mattersSectionTitleForRole(role: UserRole): string {
  switch (role) {
    case "managing_partner":
      return "Matters & Clients";
    case "attorney":
      return "Attorney Matters";
    case "paralegal":
      return "Paralegal/Legal Staff Tasks";
    case "billing_staff":
      return "Billing Matters";
    case "client":
      return "My Client Portal";
    default:
      return "Matters & Clients";
  }
}

export function mattersSectionTitleForDemoKey(key: DemoRoleKey | UserRole): string {
  if (key === "potential_client") return "Explore Rebel Law Group";
  if (key === "current_client" || key === "client") return "My Client Portal";
  return mattersSectionTitleForRole(key as UserRole);
}

function sectionLabelForRole(role: UserRole, section: NavSectionDef): string {
  if (section.id === "partner_matters") return mattersSectionTitleForRole(role);
  if (role !== "managing_partner") {
    if (section.id === "contracts") return "Contracts";
    if (section.id === "billing") return "Billing";
    if (section.id === "financial_analysis") return "Financial Analysis";
    return section.label;
  }
  return section.label;
}

export type ResolvedNavSection = {
  id: NavSectionId;
  label: string;
  icon: LucideIcon;
  links: NavItem[];
};

function buildFromAllowed(
  allowed: NavItem[],
  sectionTitle: string,
  orphanLabel: string,
  role?: UserRole
): {
  dashboard: NavItem | null;
  inbox: NavItem | null;
  sections: ResolvedNavSection[];
} {
  const byHref = new Map(allowed.map((item) => [item.href, item]));

  const dashboard =
    byHref.get("/dashboard") ??
    byHref.get("/potential-client") ??
    byHref.get("/client-portal") ??
    null;
  const inbox = byHref.get("/inbox") ?? null;

  const placed = new Set<string>();
  if (dashboard) placed.add(dashboard.href);
  if (inbox) placed.add(inbox.href);
  const sections: ResolvedNavSection[] = [];

  for (const section of NAV_SECTIONS) {
    const links = section.links
      .filter((link) => byHref.has(link.href))
      .map((link) => byHref.get(link.href)!);
    links.forEach((l) => placed.add(l.href));
    if (links.length > 0) {
      const label = role
        ? sectionLabelForRole(role, section)
        : section.id === "partner_matters"
          ? sectionTitle
          : section.label;
      sections.push({
        id: section.id,
        label,
        icon: section.icon,
        links,
      });
    }
  }

  const orphans = allowed.filter((item) => !placed.has(item.href));
  if (orphans.length > 0) {
    sections.push({
      id: "more",
      label: orphanLabel,
      icon: Briefcase,
      links: orphans,
    });
  }

  return { dashboard, inbox, sections };
}

/** Build role-filtered sections from navForRole (preserves existing permission lists). */
export function buildNavSections(role: UserRole): {
  dashboard: NavItem | null;
  inbox: NavItem | null;
  sections: ResolvedNavSection[];
} {
  return buildFromAllowed(
    navForRole(role),
    mattersSectionTitleForRole(role),
    role === "client" ? "My Client Portal" : "My Work",
    role
  );
}

/** Demo Mode: Potential Client vs Current Client get distinct menus. */
export function buildNavSectionsForDemoKey(key: DemoRoleKey | UserRole): {
  dashboard: NavItem | null;
  inbox: NavItem | null;
  sections: ResolvedNavSection[];
} {
  if (key === "potential_client") {
    const allowed = navForDemoKey(key);
    const home = allowed.find((i) => i.href === "/potential-client") ?? null;
    const rest = allowed.filter((i) => i.href !== "/potential-client");
    return {
      dashboard: home ? { href: home.href, label: "Home" } : null,
      inbox: null,
      sections: [
        {
          id: "more",
          label: "Explore Rebel Law Group",
          icon: Scale,
          links: rest,
        },
      ],
    };
  }
  if (key === "current_client" || key === "client") {
    const allowed = navForDemoKey("current_client");
    const home = allowed.find((i) => i.href === "/client-portal") ?? null;
    const rest = allowed.filter(
      (i) => i.href !== "/client-portal" && i.href !== "/potential-client"
    );
    const explore = allowed.find((i) => i.href === "/potential-client");
    return {
      dashboard: home ? { href: home.href, label: "Client Dashboard" } : null,
      inbox: null,
      sections: [
        {
          id: "more",
          label: "My Client Portal",
          icon: Briefcase,
          links: [
            ...rest,
            ...(explore ? [explore] : []),
          ],
        },
      ],
    };
  }
  return buildNavSections(key as UserRole);
}

/** Prefer the longest matching href so /costs/new wins over /costs. */
export function isNavLinkActive(pathname: string, href: string, allHrefs: string[]): boolean {
  const base = href.split("#")[0];
  if (pathname === base) return true;
  const prefixMatches = allHrefs
    .map((h) => h.split("#")[0])
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length);
  return prefixMatches[0] === base;
}

export function sectionIdForPath(
  pathname: string,
  sections: ResolvedNavSection[]
): NavSectionId | null {
  const allHrefs = sections.flatMap((s) => s.links.map((l) => l.href));
  for (const section of sections) {
    for (const link of section.links) {
      if (isNavLinkActive(pathname, link.href, allHrefs)) {
        return section.id;
      }
    }
  }
  return null;
}
