import { requireUser } from "@/lib/auth";
import { canViewDataQuality } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { loadAnalyticsData } from "@/lib/analytics-data";
import { buildDataQualityExceptions } from "@/lib/data-quality";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DataQualityPage() {
  const { profile, supabase } = await requireUser();
  if (!canViewDataQuality(profile.role)) redirect("/dashboard");

  const raw = await loadAnalyticsData(supabase);
  const { data: rates } = await supabase.from("employee_rates").select("*").eq("active_status", true);
  const exceptions = buildDataQualityExceptions(raw, rates);

  return (
    <>
      <PageHeader
        title="Data Quality & Exceptions"
        description="Read-only detection of incomplete or inconsistent records. No automatic corrections."
      />
      <p className="text-sm">
        {exceptions.length} exception{exceptions.length === 1 ? "" : "s"} found · Generated{" "}
        {new Date().toLocaleString()}
      </p>
      {exceptions.length === 0 ? (
        <EmptyState title="No data-quality exceptions detected." />
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <div className="table-wrap">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Issue</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className={`badge badge-sm ${
                          e.severity === "high"
                            ? "badge-error"
                            : e.severity === "medium"
                              ? "badge-warning"
                              : "badge-ghost"
                        }`}
                      >
                        {e.severity}
                      </span>
                    </td>
                    <td>{e.category}</td>
                    <td className="text-sm">{e.message}</td>
                    <td>
                      {e.href && (
                        <Link href={e.href} className="link text-sm">
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
