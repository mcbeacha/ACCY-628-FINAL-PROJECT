"use client";

import {
  DEMO_BANNER_DISMISS_KEY,
  DEMO_IDENTITIES,
  DEMO_PASSWORD,
  DEMO_ROLE_STORAGE_KEY,
  DEMO_TOAST_STORAGE_KEY,
  DEFAULT_DEMO_ROLE,
  formatDemoOptionLabel,
  getDemoIdentity,
  getDemoIdentityByEmail,
  parseStoredDemoRole,
  roleSwitchMessage,
  type DemoIdentity,
  type DemoRoleKey,
} from "@/lib/demo-config";
import {
  canApproveMatters,
  canViewControls,
  canViewInternalCost,
  canViewProfitability,
  isClientRole,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type DemoRoleContextValue = {
  demoMode: true;
  activeDemoRole: DemoRoleKey;
  activeDemoUser: Profile;
  activeDemoProfileId: string;
  activeIdentity: DemoIdentity;
  switching: boolean;
  toast: string | null;
  clearToast: () => void;
  setActiveDemoRole: (
    key: DemoRoleKey,
    options?: { silent?: boolean; home?: boolean }
  ) => Promise<void>;
  resetDemoView: () => Promise<void>;
  hasPermission: (action: DemoPermission) => boolean;
  canViewMatter: boolean;
  canApproveMatter: boolean;
  canViewFinancials: boolean;
  canViewClientRecord: boolean;
};

export type DemoPermission =
  | "approve_matter"
  | "view_financials"
  | "view_controls"
  | "view_internal_cost"
  | "view_client_record";

const DemoRoleContext = createContext<DemoRoleContextValue | null>(null);

export function useDemoRole(): DemoRoleContextValue | null {
  return useContext(DemoRoleContext);
}

async function signInAsIdentity(identity: DemoIdentity) {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const currentEmail = sessionData.session?.user?.email?.toLowerCase();

  if (currentEmail === identity.email.toLowerCase()) {
    return { ok: true as const };
  }

  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: identity.email,
    password: DEMO_PASSWORD,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export function DemoRoleProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const router = useRouter();
  const syncingRef = useRef(false);
  const [switching, setSwitching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // SSR-safe: do not read localStorage during useState init (causes hydration mismatch).
  // localStorage preference is applied in the sync effect below after mount.
  const [activeKey, setActiveKey] = useState<DemoRoleKey>(() => {
    const byEmail = getDemoIdentityByEmail(profile.email);
    return byEmail?.key ?? DEFAULT_DEMO_ROLE;
  });

  const activeIdentity = useMemo(() => getDemoIdentity(activeKey), [activeKey]);

  const clearToast = useCallback(() => setToast(null), []);

  const setActiveDemoRole = useCallback(
    async (key: DemoRoleKey, options?: { silent?: boolean; home?: boolean }) => {
      const identity = getDemoIdentity(key);
      setSwitching(true);
      if (!options?.silent) setToast(null);

      try {
        localStorage.setItem(DEMO_ROLE_STORAGE_KEY, identity.key);
        const result = await signInAsIdentity(identity);
        if (!result.ok) {
          setToast(`Could not switch role: ${result.error}`);
          setSwitching(false);
          return;
        }

        setActiveKey(identity.key);
        if (!options?.silent) {
          const msg = roleSwitchMessage(identity);
          try {
            sessionStorage.setItem(DEMO_TOAST_STORAGE_KEY, msg);
          } catch {
            /* ignore */
          }
          console.info(
            "[Demo Mode] Switched presentation role to",
            formatDemoOptionLabel(identity)
          );
        }

        // Full navigation clears prior-role UI. Leave the page only if the new role may open it.
        if (options?.home !== false) {
          const { navForDemoKey } = await import("@/lib/permissions");
          const allowed = navForDemoKey(identity.key);
          const current = window.location.pathname;
          const stillAllowed = allowed.some((item) => {
            const base = item.href.split("#")[0];
            return (
              current === base ||
              (base !== "/dashboard" &&
                base !== "/potential-client" &&
                base !== "/client-portal" &&
                current.startsWith(`${base}/`)) ||
              (base === "/client-portal" && current.startsWith("/client-portal")) ||
              (base === "/potential-client" && current.startsWith("/potential-client"))
            );
          });
          // Potential vs Current Client are separate windows — never stay on the other experience.
          const crossExperience =
            (identity.key === "current_client" && current.startsWith("/potential-client")) ||
            (identity.key === "potential_client" && current.startsWith("/client-portal"));
          const dest =
            crossExperience || !stillAllowed ? identity.homePath : current;
          window.location.assign(dest);
          return;
        }
        router.refresh();
        if (!options?.silent) {
          setToast(roleSwitchMessage(identity));
        }
      } catch (err) {
        setToast(
          err instanceof Error ? err.message : "Could not switch demo role."
        );
      } finally {
        setSwitching(false);
      }
    },
    [router]
  );

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(DEMO_TOAST_STORAGE_KEY);
      if (pending) {
        sessionStorage.removeItem(DEMO_TOAST_STORAGE_KEY);
        setToast(pending);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Keep session aligned with the saved demo role (localStorage is the preference).
  useEffect(() => {
    const stored = readStoredDemoRole();
    const preferred = getDemoIdentity(stored);
    if (preferred.email.toLowerCase() === profile.email.toLowerCase()) {
      setActiveKey(preferred.key);
      try {
        localStorage.setItem(DEMO_ROLE_STORAGE_KEY, preferred.key);
      } catch {
        /* ignore */
      }
      return;
    }
    if (syncingRef.current) return;
    syncingRef.current = true;
    void setActiveDemoRole(stored, { silent: true, home: false }).finally(() => {
      syncingRef.current = false;
    });
    // Intentionally run when the signed-in profile identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.email]);

  const resetDemoView = useCallback(async () => {
    try {
      localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
      localStorage.removeItem(DEMO_BANNER_DISMISS_KEY);
      sessionStorage.setItem(
        DEMO_TOAST_STORAGE_KEY,
        "Demo view reset. Now viewing as Managing Partner."
      );
    } catch {
      /* ignore */
    }
    await setActiveDemoRole(DEFAULT_DEMO_ROLE, { silent: true });
  }, [setActiveDemoRole]);

  const role = profile.role;

  const value = useMemo<DemoRoleContextValue>(
    () => ({
      demoMode: true,
      activeDemoRole: activeKey,
      activeDemoUser: profile,
      activeDemoProfileId: profile.id,
      activeIdentity,
      switching,
      toast,
      clearToast,
      setActiveDemoRole,
      resetDemoView,
      hasPermission: (action) => {
        switch (action) {
          case "approve_matter":
            return canApproveMatters(role);
          case "view_financials":
            return canViewProfitability(role);
          case "view_controls":
            return canViewControls(role);
          case "view_internal_cost":
            return canViewInternalCost(role);
          case "view_client_record":
            return !isClientRole(role);
          default:
            return false;
        }
      },
      canViewMatter: true,
      canApproveMatter: canApproveMatters(role),
      canViewFinancials: canViewProfitability(role),
      canViewClientRecord: !isClientRole(role),
    }),
    [
      activeKey,
      activeIdentity,
      profile,
      switching,
      toast,
      clearToast,
      setActiveDemoRole,
      resetDemoView,
      role,
    ]
  );

  return (
    <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>
  );
}

/** Read preferred demo role from localStorage (client only). */
export function readStoredDemoRole(): DemoRoleKey {
  if (typeof window === "undefined") return DEFAULT_DEMO_ROLE;
  try {
    return parseStoredDemoRole(localStorage.getItem(DEMO_ROLE_STORAGE_KEY));
  } catch {
    return DEFAULT_DEMO_ROLE;
  }
}
