"use client";

import {
  DEMO_PASSWORD,
  DEMO_ROLE_STORAGE_KEY,
  getDemoIdentity,
  parseStoredDemoRole,
} from "@/lib/demo-config";
import { createClient } from "@/lib/supabase/client";
import { Scale } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function DemoEnterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      const next = params.get("next") || "/dashboard";
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

      let roleKey = "managing_partner";
      try {
        roleKey = parseStoredDemoRole(localStorage.getItem(DEMO_ROLE_STORAGE_KEY));
      } catch {
        /* ignore */
      }

      const identity = getDemoIdentity(roleKey);
      const supabase = createClient();

      const { data: existing } = await supabase.auth.getSession();
      const currentEmail = existing.session?.user?.email?.toLowerCase();

      if (currentEmail !== identity.email.toLowerCase()) {
        await supabase.auth.signOut();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: identity.email,
          password: DEMO_PASSWORD,
        });
        if (signInError) {
          if (!cancelled) {
            setError(signInError.message);
          }
          return;
        }
      }

      try {
        localStorage.setItem(DEMO_ROLE_STORAGE_KEY, identity.key);
      } catch {
        /* ignore */
      }

      const destination =
        safeNext === "/login" || safeNext === "/demo-enter"
          ? identity.homePath
          : safeNext;

      router.replace(destination);
      router.refresh();
    }

    void enter();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="min-h-screen grid place-items-center bg-base-200 px-4">
      <div className="text-center max-w-md space-y-4">
        <div className="inline-flex items-center gap-2 justify-center">
          <span className="btn btn-primary btn-square btn-sm pointer-events-none">
            <Scale className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold">Rebel Law Group</span>
        </div>
        {error ? (
          <div className="alert alert-error text-sm text-left">
            <span>
              Demo Mode could not sign in the fictional demo user. Confirm seed
              accounts exist and the demo password matches. ({error})
            </span>
          </div>
        ) : (
          <>
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm opacity-70">
              Entering Demo Mode… loading the selected fictional workspace.
            </p>
            <p className="text-xs opacity-50">
              Demo Mode is active. This academic application uses fictional data and
              does not require authentication.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DemoEnterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <DemoEnterInner />
    </Suspense>
  );
}
