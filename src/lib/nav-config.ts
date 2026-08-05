import type { NavItem } from "@/lib/permissions";
import { navForRole } from "@/lib/permissions";
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
    label: "Partner Matters",
    icon: Briefcase,
    links: [
      { href: "/clients", label: "Clients" },
      { href: "/matters", label: "Matters" },
      { href: "/tasks", label: "Tasks" },
      { href: "/calendar", label: "Calendar" },
      { href: "/documents", label: "Documents" },
      { href: "/profitability/practice-areas", label: "Practice Areas" },
      { href: "/productivity", label: "Attorney Productivity" },
      { href: "/data-quality", label: "Data Quality" },
      { href: "/controls", label: "Control Monitor" },
    ],
  },
  {
    id: "contracts",
    label: "Contracts",
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
    label: "Billing",
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
    label: "Financial Analysis",
    icon: ChartColumn,
    links: [
      { href: "/profitability/matters", label: "Matter Profitability" },
      { href: "/profitability/clients", label: "Client Profitability" },
      { href: "/reports", label: "Reports" },
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
      return "Partner Matters";
    case "attorney":
      return "Attorney Matters";
    case "paralegal":
      return "Staff Matters";
    case "billing_staff":
      return "Billing Matters";
    case "client":
      return "My Matters";
    default:
      return "Partner Matters";
  }
}

export type ResolvedNavSection = {
  id: NavSectionId;
  label: string;
  icon: LucideIcon;
  links: NavItem[];
};

/** Build role-filtered sections from navForRole (preserves existing permission lists). */
export function buildNavSections(role: UserRole): {
  dashboard: NavItem | null;
  inbox: NavItem | null;
  sections: ResolvedNavSection[];
} {
  const allowed = navForRole(role);
  const byHref = new Map(allowed.map((item) => [item.href, item]));

  const dashboard = byHref.get("/dashboard") ?? null;
  const inbox = byHref.get("/inbox") ?? null;

  const placed = new Set<string>(["/dashboard", "/inbox"]);
  const sections: ResolvedNavSection[] = [];

  for (const section of NAV_SECTIONS) {
    const links = section.links
      .filter((link) => byHref.has(link.href))
      .map((link) => byHref.get(link.href)!);
    links.forEach((l) => placed.add(l.href));
    if (links.length > 0) {
      sections.push({
        id: section.id,
        label:
          section.id === "partner_matters"
            ? mattersSectionTitleForRole(role)
            : section.label,
        icon: section.icon,
        links,
      });
    }
  }

  const orphans = allowed.filter((item) => !placed.has(item.href));
  if (orphans.length > 0) {
    sections.push({
      id: "more",
      label: role === "client" ? "Client Portal" : "My Work",
      icon: Briefcase,
      links: orphans,
    });
  }

  return { dashboard, inbox, sections };
}

/** Prefer the longest matching href so /costs/new wins over /costs. */
export function isNavLinkActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  const prefixMatches = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length);
  return prefixMatches[0] === href;
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
