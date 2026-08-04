import { requireUser } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsNotice } from "@/components/analytics/AnalyticsNotice";
import Link from "next/link";
import { redirect } from "next/navigation";

const REPORTS = [
  { slug: "matter-profitability", title: "Matter Profitability Report", roles: "Partner & Billing" },
  { slug: "client-profitability", title: "Client Profitability Report", roles: "Partner & Billing" },
  { slug: "practice-area", title: "Practice Area Profitability Report", roles: "Partner & Billing" },
  { slug: "attorney-productivity", title: "Attorney Productivity Report", roles: "Partner & Billing" },
  { slug: "time-entries", title: "Time Entry Report", roles: "Partner & Billing" },
  { slug: "expenses", title: "Expense Report", roles: "Partner & Billing" },
  { slug: "invoice-register", title: "Invoice Register", roles: "Partner & Billing" },
  { slug: "ar-aging", title: "Accounts Receivable Aging Report", roles: "Partner & Billing" },
  { slug: "payment-register", title: "Payment Register", roles: "Partner & Billing" },
  { slug: "retainer-ledger", title: "Retainer Ledger Report", roles: "Partner & Billing" },
  { slug: "journal-entries", title: "Journal Entry Report", roles: "Partner & Billing" },
  { slug: "write-downs-offs", title: "Write-Down and Write-Off Report", roles: "Partner & Billing" },
  { slug: "unbilled", title: "Unbilled Activity Report", roles: "Partner & Billing" },
  { slug: "budget-variance", title: "Matter Budget Variance Report", roles: "Partner & Billing" },
];

export default async function ReportsHubPage() {
  const { profile } = await requireUser();
  if (!canViewReports(profile.role)) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Reports"
        description="Filterable operational and financial reports with CSV export. Exports only include records allowed by your login (RLS)."
      />
      <AnalyticsNotice />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.slug}
            href={`/reports/${r.slug}`}
            className="card bg-base-100 border border-base-300 shadow-sm hover:border-primary transition-colors"
          >
            <div className="card-body p-4">
              <h2 className="font-semibold text-sm">{r.title}</h2>
              <p className="text-xs opacity-60">{r.roles}</p>
              <span className="link text-sm">Open report →</span>
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs opacity-60">
        Quick views also live under Profitability, Productivity, AR, and Journal menus.
      </p>
    </>
  );
}
