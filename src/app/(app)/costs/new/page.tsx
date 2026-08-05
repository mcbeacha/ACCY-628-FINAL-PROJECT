import { requireUser } from "@/lib/auth";
import { canEnterMatterCosts } from "@/lib/permissions";
import { CostEntryForm } from "@/components/CostEntryForm";
import { redirect } from "next/navigation";

export default async function NewCostPage() {
  const { profile } = await requireUser();
  if (!canEnterMatterCosts(profile.role)) redirect("/dashboard");
  return <CostEntryForm userId={profile.id} role={profile.role} />;
}
