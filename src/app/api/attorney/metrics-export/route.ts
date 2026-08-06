import { requireUser } from "@/lib/auth";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import {
  buildAttorneyMetricsWorkbook,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/attorney-excel";
import { takeExportBuffer, verifyExportTicket } from "@/lib/export-ticket";

export async function GET(request: Request) {
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (ticket) {
    const payload = verifyExportTicket(ticket);
    if (!payload || payload.kind !== "metrics") {
      return new Response("Invalid or expired export ticket.", { status: 403 });
    }
    const cached = takeExportBuffer(payload.jti);
    if (!cached) {
      return new Response("Export ticket already used or expired.", { status: 410 });
    }
    return xlsxResponse(cached.buffer, cached.filename);
  }

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
