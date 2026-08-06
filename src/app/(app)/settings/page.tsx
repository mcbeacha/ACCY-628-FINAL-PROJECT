import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ThemeSelector } from "@/components/ThemeSelector";
import { ROLE_LABELS } from "@/lib/constants";
import { canEditApprovalThresholds } from "@/lib/firm-thresholds";
import { SettingsPreferences } from "./SettingsPreferences";
import { ThresholdsSettingsClient } from "./ThresholdsSettingsClient";
import Link from "next/link";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { profile } = await requireUser();
  const isClient = profile.role === "client";
  const canEditThresholds = canEditApprovalThresholds(profile.role);
  const params = await searchParams;
  const requestedTab = params?.tab === "thresholds" ? "thresholds" : "general";
  const activeTab = requestedTab === "thresholds" && canEditThresholds ? "thresholds" : "general";

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          canEditThresholds
            ? "Manage your profile, appearance, and firm approval thresholds."
            : "Manage your profile display, appearance, and workspace preferences."
        }
      />

      <div role="tablist" className="tabs tabs-boxed w-fit mb-4">
        <Link
          href="/settings"
          role="tab"
          className={`tab ${activeTab === "general" ? "tab-active" : ""}`}
          aria-selected={activeTab === "general"}
        >
          General
        </Link>
        {canEditThresholds && (
          <Link
            href="/settings?tab=thresholds"
            role="tab"
            className={`tab ${activeTab === "thresholds" ? "tab-active" : ""}`}
            aria-selected={activeTab === "thresholds"}
          >
            Thresholds
          </Link>
        )}
      </div>

      {activeTab === "thresholds" && canEditThresholds ? (
        <div className="max-w-3xl">
          <ThresholdsSettingsClient userId={profile.id} />
        </div>
      ) : (
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
                  <dt className="text-xs font-semibold opacity-60 uppercase tracking-wide">
                    Job title
                  </dt>
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
      )}
    </>
  );
}
