import { requireUser } from "@/lib/auth";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import {
  buildAttorneyMetricsWorkbook,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/attorney-excel";
import { canViewReports } from "@/lib/permissions";

export async function GET() {
  const { profile, supabase } = await requireUser();

  if (!canViewReports(profile.role)) {
    return new Response("Forbidden.", { status: 403 });
  }

  const isAttorneyScoped = profile.role === "attorney";

  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw);

  let timeQuery = supabase
    .from("time_entries")
    .select("*, matters(matter_number, matter_name)")
    .order("work_date", { ascending: false });

  if (isAttorneyScoped) {
    timeQuery = timeQuery.eq("employee_id", profile.id);
  }

  const { data: myTime } = await timeQuery;

  const workbook = buildAttorneyMetricsWorkbook({
    matters: bundle.matters,
    invoices: bundle.raw.invoices,
    matterRows: bundle.raw.matterRows,
    myTime: myTime || [],
    timeSheetTitle: isAttorneyScoped ? "My Time" : "Time Entries",
  });

  const buffer = await workbookToBuffer(workbook);
  const filename = isAttorneyScoped ? "attorney-metrics.xlsx" : "matter-billing-metrics.xlsx";
  return xlsxResponse(buffer, filename);
}
