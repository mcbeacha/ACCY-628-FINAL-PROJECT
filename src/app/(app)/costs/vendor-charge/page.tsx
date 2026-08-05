import { requireUser } from "@/lib/auth";
import { canEnterMatterCosts } from "@/lib/permissions";
import { VendorChargeForm } from "@/components/VendorChargeForm";
import { redirect } from "next/navigation";

export default async function VendorChargePage() {
  const { profile } = await requireUser();
  if (!canEnterMatterCosts(profile.role)) redirect("/dashboard");
  return <VendorChargeForm userId={profile.id} role={profile.role} />;
}
