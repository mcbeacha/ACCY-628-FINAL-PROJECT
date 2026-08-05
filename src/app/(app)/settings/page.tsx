import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ThemeSelector } from "@/components/ThemeSelector";
import { ROLE_LABELS } from "@/lib/constants";
import { SettingsPreferences } from "./SettingsPreferences";

export default async function SettingsPage() {
  const { profile } = await requireUser();
  const isClient = profile.role === "client";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile display, appearance, and workspace preferences."
      />

      <div className="space-y-4 max-w-3xl">
        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="font-display text-xl font-semibold">Profile</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold opacity-60 uppercase tracking-wide">Name</dt>
                <dd className="mt-1">{profile.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold opacity-60 uppercase tracking-wide">Email</dt>
                <dd className="mt-1">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold opacity-60 uppercase tracking-wide">Job title</dt>
                <dd className="mt-1">{profile.job_title || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold opacity-60 uppercase tracking-wide">Role</dt>
                <dd className="mt-1">{ROLE_LABELS[profile.role]}</dd>
              </div>
            </dl>
            <p className="text-sm opacity-70">
              Profile changes are managed by firm administration.
            </p>
          </div>
        </section>

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="font-display text-xl font-semibold">Appearance</h2>
            <p className="text-sm opacity-70">
              Switch your workspace between light and dark mode.
            </p>
            <ThemeSelector />
          </div>
        </section>

        {!isClient && <SettingsPreferences />}
      </div>
    </>
  );
}
