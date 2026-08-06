import { requireUser } from "@/lib/auth";
import {
  buildClientsWorkbook,
  workbookToBuffer,
  xlsxResponse,
} from "@/lib/attorney-excel";
import type { Client } from "@/lib/types";

export async function GET() {
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
