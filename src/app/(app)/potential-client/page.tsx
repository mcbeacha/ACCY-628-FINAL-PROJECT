import { requireUser } from "@/lib/auth";
import { ClientHomePage } from "@/components/client-home/ClientHomePage";
import { redirect } from "next/navigation";

export default async function PotentialClientPage() {
  const { profile, supabase } = await requireUser();
  if (profile.role !== "client") {
    redirect("/dashboard");
  }

  const { data: leads } = await supabase
    .from("practice_area_leads")
    .select(
      "*, lead:profiles!practice_area_leads_lead_attorney_id_fkey(id, full_name, job_title)"
    )
    .eq("active_status", true)
    .order("display_order");

  return <ClientHomePage profile={profile} initialLeads={(leads || []) as never[]} />;
}
