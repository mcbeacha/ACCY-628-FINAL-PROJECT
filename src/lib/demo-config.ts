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

export type DemoRoleKey = UserRole;

export type DemoIdentity = {
  key: DemoRoleKey;
  role: UserRole;
  email: string;
  /** Display name shown in the selector (matches seeded profile). */
  displayName: string;
  title: string;
  profileId: string;
  homePath: string;
  viewBadge: string;
};

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
    key: "client",
    role: "client",
    email: "nvale@northvale.demo",
    displayName: "Nora Vale",
    title: "Client (Northvale Robotics)",
    profileId: "a1000000-0000-4000-8000-000000000006",
    homePath: "/dashboard",
    viewBadge: "Client View",
  },
];

export const DEFAULT_DEMO_ROLE: DemoRoleKey = "managing_partner";

export const DEMO_MODE_NOTICE =
  "Demo Mode is active. This academic application uses fictional data and does not require authentication.";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function getDemoIdentity(key: string | null | undefined): DemoIdentity {
  const found = DEMO_IDENTITIES.find((d) => d.key === key);
  return found ?? DEMO_IDENTITIES.find((d) => d.key === DEFAULT_DEMO_ROLE)!;
}

export function getDemoIdentityByEmail(email: string | null | undefined): DemoIdentity | null {
  if (!email) return null;
  return DEMO_IDENTITIES.find((d) => d.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function formatDemoOptionLabel(identity: DemoIdentity): string {
  return `${ROLE_LABELS[identity.role]} — ${identity.displayName}`;
}

export function roleSwitchMessage(identity: DemoIdentity): string {
  return `Now viewing the app as ${ROLE_LABELS[identity.role]}.`;
}

/** Parse a stored role key; invalid values fall back to Managing Partner. */
export function parseStoredDemoRole(raw: string | null): DemoRoleKey {
  if (raw && DEMO_IDENTITIES.some((d) => d.key === raw)) {
    return raw as DemoRoleKey;
  }
  return DEFAULT_DEMO_ROLE;
}
