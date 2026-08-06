import { requireUser } from "@/lib/auth";
import {
  buildAttorneyMetricsWorkbook,
  buildClientsWorkbook,
  workbookToBuffer,
} from "@/lib/attorney-excel";
import { computeAnalytics, loadAnalyticsData } from "@/lib/analytics-data";
import {
  absoluteExportUrl,
  isExportKind,
  parseExportTicket,
  signExportTicket,
  storeExportBuffer,
} from "@/lib/export-ticket";
import type { Client } from "@/lib/types";

export async function GET(request: Request) {
  const { profile, supabase } = await requireUser();

  if (profile.role !== "attorney") {
    return new Response("Forbidden: attorney role required.", { status: 403 });
  }

  const kindParam = new URL(request.url).searchParams.get("kind");
  if (!isExportKind(kindParam)) {
    return Response.json({ error: "kind must be metrics or clients." }, { status: 400 });
  }

  const ticket = signExportTicket({ kind: kindParam, sub: profile.id });
  const payload = parseExportTicket(ticket);
  if (!payload) {
    return Response.json({ error: "Failed to mint export ticket." }, { status: 500 });
  }

  if (kindParam === "metrics") {
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
    storeExportBuffer(payload.jti, buffer, "attorney-metrics.xlsx");
  } else {
    const { data } = await supabase.from("clients").select("*").order("client_number");
    const clients = (data || []) as Client[];
    const workbook = buildClientsWorkbook(clients);
    const buffer = await workbookToBuffer(workbook);
    storeExportBuffer(payload.jti, buffer, "attorney-clients.xlsx");
  }

  const url = absoluteExportUrl(request, kindParam, ticket);
  return Response.json({ ticket, url, kind: kindParam });
}
