import { requireUser } from "@/lib/auth";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import {
  buildAttorneyMetricsWorkbook,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/attorney-excel";

export async function GET() {
  const { profile, supabase } = await requireUser();

  if (profile.role !== "attorney") {
    return new Response("Forbidden: attorney role required.", { status: 403 });
  }

  const raw = await loadAnalyticsData(supabase);
  const bundle = computeAnalytics(raw);

  const { data: myTime } = await supabase
    .from("time_entries")
    .select("*, matters(matter_number, matter_name)")
    .eq("employee_id", profile.id)
    .order("work_date", { ascending: false });

  const workbook = buildAttorneyMetricsWorkbook({
    matters: bundle.matters,
    invoices: bundle.raw.invoices,
    matterRows: bundle.raw.matterRows,
    myTime: myTime || [],
  });

  const buffer = await workbookToBuffer(workbook);
  return xlsxResponse(buffer, "attorney-metrics.xlsx");
}
