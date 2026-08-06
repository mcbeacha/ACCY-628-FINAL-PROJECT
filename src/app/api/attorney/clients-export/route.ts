import { requireUser } from "@/lib/auth";
import {
  buildClientsWorkbook,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/attorney-excel";
import { takeExportBuffer, verifyExportTicket } from "@/lib/export-ticket";
import type { Client } from "@/lib/types";

export async function GET(request: Request) {
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (ticket) {
    const payload = verifyExportTicket(ticket);
    if (!payload || payload.kind !== "clients") {
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

  const { data } = await supabase.from("clients").select("*").order("client_number");
  const clients = (data || []) as Client[];

  const workbook = buildClientsWorkbook(clients);
  const buffer = await workbookToBuffer(workbook);
  return xlsxResponse(buffer, "attorney-clients.xlsx");
}
