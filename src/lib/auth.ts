import { isDemoMode } from "@/lib/demo-config";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

function authEntryPath(error?: "profile") {
  if (isDemoMode()) {
    return error === "profile" ? "/demo-enter?error=profile" : "/demo-enter";
  }
  return error === "profile" ? "/login?error=profile" : "/login";
}

async function ensureProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
): Promise<Profile | null> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return existing as Profile;
  }

  // Selection failed or row missing — try to create a client profile for this auth user
  if (selectError) {
    console.error("Profile select error:", selectError.message);
  }

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    user.email?.split("@")[0] ||
    "User";

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        email: user.email || `${user.id}@unknown.local`,
        role: "client" as UserRole,
        job_title: "Client Portal User",
        active_status: true,
      },
      { onConflict: "id" }
    )
    .select("*")
    .maybeSingle();

  if (insertError) {
    console.error("Profile create error:", insertError.message);
    return null;
  }

  return (created as Profile) || null;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(authEntryPath());
  }

  const profile = await ensureProfile(supabase, user);

  if (!profile) {
    // Avoid middleware bounce: end the session and show a clear login error
    await supabase.auth.signOut();
    redirect(authEntryPath("profile"));
  }

  return { supabase, user, profile };
}
