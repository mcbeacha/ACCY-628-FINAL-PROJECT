import type { UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";

/** localStorage key for the selected demo role (no secrets). */
export const DEMO_ROLE_STORAGE_KEY = "rebel-law-demo-role";

/** sessionStorage key for a one-shot toast after role navigation. */
export const DEMO_TOAST_STORAGE_KEY = "rebel-law-demo-toast";

/** localStorage key for dismissing the intro banner. */
export const DEMO_BANNER_DISMISS_KEY = "rebel-law-demo-banner-dismissed";

/**
 * Fictional demo accounts already seeded in Supabase Auth + profiles.
 * Password is the shared academic demo password (also documented in README).
 * This is presentation switching — not a substitute for real authentication.
 */
export const DEMO_PASSWORD = "RebelDemo2026!";

/** Demo selector keys — Potential/Current Client share the client auth role but different UIs. */
export type DemoRoleKey =
  | UserRole
  | "potential_client"
  | "current_client";

export type DemoIdentity = {
  key: DemoRoleKey;
  /** Supabase profile role used for RLS / permissions. */
  role: UserRole;
  email: string;
  /** Display name shown in the selector. */
  displayName: string;
  title: string;
  profileId: string;
  homePath: string;
  viewBadge: string;
};

/** Seeded Current Client portal user (Northvale Robotics / Nora Vale). */
export const CURRENT_CLIENT_PROFILE_ID = "a1000000-0000-4000-8000-000000000006";
export const CURRENT_CLIENT_EMAIL = "nvale@northvale.demo";

/**
 * Fixed approved list of fictional demo identities.
 * Connected to existing seed profiles — do not query arbitrary users.
 */
export const DEMO_IDENTITIES: DemoIdentity[] = [
  {
    key: "managing_partner",
    role: "managing_partner",
    email: "partner@rebellaw.demo",
    displayName: "Margaret Sinclair",
    title: "Managing Partner",
    profileId: "a1000000-0000-4000-8000-000000000001",
    homePath: "/dashboard",
    viewBadge: "Firm-Wide View",
  },
  {
    key: "attorney",
    role: "attorney",
    email: "jharper@rebellaw.demo",
    displayName: "Jordan Harper",
    title: "Senior Associate",
    profileId: "a1000000-0000-4000-8000-000000000002",
    homePath: "/dashboard",
    viewBadge: "Attorney View",
  },
  {
    key: "paralegal",
    role: "paralegal",
    email: "prose@rebellaw.demo",
    displayName: "Priya Rose",
    title: "Paralegal",
    profileId: "a1000000-0000-4000-8000-000000000004",
    homePath: "/dashboard",
    viewBadge: "Staff View",
  },
  {
    key: "billing_staff",
    role: "billing_staff",
    email: "billing@rebellaw.demo",
    displayName: "Sam Okonkwo",
    title: "Billing Coordinator",
    profileId: "a1000000-0000-4000-8000-000000000005",
    homePath: "/dashboard",
    viewBadge: "Billing View",
  },
  {
    key: "potential_client",
    role: "client",
    email: CURRENT_CLIENT_EMAIL,
    displayName: "Oxford Prospect",
    title: "Potential Client",
    profileId: CURRENT_CLIENT_PROFILE_ID,
    homePath: "/potential-client",
    viewBadge: "Potential Client",
  },
  {
    key: "current_client",
    role: "client",
    email: CURRENT_CLIENT_EMAIL,
    displayName: "Nora Vale",
    title: "Current Client (Northvale Robotics)",
    profileId: CURRENT_CLIENT_PROFILE_ID,
    homePath: "/client-portal",
    viewBadge: "Current Client",
  },
];

export const DEFAULT_DEMO_ROLE: DemoRoleKey = "managing_partner";

export const DEMO_MODE_NOTICE =
  "Demo Mode is active. This academic application uses fictional data and does not require authentication.";

export const DEMO_CLIENT_NOTICE =
  "Demo Mode is active. All client and financial information is fictional.";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function isPotentialClientDemoKey(key: DemoRoleKey | string | null | undefined) {
  return key === "potential_client";
}

export function isCurrentClientDemoKey(key: DemoRoleKey | string | null | undefined) {
  return key === "current_client" || key === "client";
}

export function isClientExperienceDemoKey(key: DemoRoleKey | string | null | undefined) {
  return isPotentialClientDemoKey(key) || isCurrentClientDemoKey(key);
}

export function getDemoIdentity(key: string | null | undefined): DemoIdentity {
  // Legacy stored key "client" → Current Client portal
  if (key === "client") {
    return DEMO_IDENTITIES.find((d) => d.key === "current_client")!;
  }
  const found = DEMO_IDENTITIES.find((d) => d.key === key);
  return found ?? DEMO_IDENTITIES.find((d) => d.key === DEFAULT_DEMO_ROLE)!;
}

/** Prefer Current Client when multiple identities share an email and no stored key. */
export function getDemoIdentityByEmail(email: string | null | undefined): DemoIdentity | null {
  if (!email) return null;
  const matches = DEMO_IDENTITIES.filter(
    (d) => d.email.toLowerCase() === email.toLowerCase()
  );
  if (!matches.length) return null;
  return matches.find((d) => d.key === "current_client") ?? matches[0];
}

export function formatDemoOptionLabel(identity: DemoIdentity): string {
  if (identity.key === "potential_client") {
    return `Potential Client — ${identity.displayName}`;
  }
  if (identity.key === "current_client") {
    return `Current Client — ${identity.displayName}`;
  }
  return `${ROLE_LABELS[identity.role]} — ${identity.displayName}`;
}

export function roleSwitchMessage(identity: DemoIdentity): string {
  if (identity.key === "potential_client") {
    return "Now viewing the Potential Client marketing and intake experience.";
  }
  if (identity.key === "current_client") {
    return "Now viewing the Current Client portal.";
  }
  return `Now viewing the app as ${ROLE_LABELS[identity.role]}.`;
}

/** Parse a stored role key; invalid values fall back to Managing Partner. */
export function parseStoredDemoRole(raw: string | null): DemoRoleKey {
  if (!raw) return DEFAULT_DEMO_ROLE;
  if (raw === "client") return "current_client";
  if (DEMO_IDENTITIES.some((d) => d.key === raw)) {
    return raw as DemoRoleKey;
  }
  return DEFAULT_DEMO_ROLE;
}
