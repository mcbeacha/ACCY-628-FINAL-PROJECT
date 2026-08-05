import { requireUser } from "@/lib/auth";
import { canViewCostDashboard } from "@/lib/permissions";
import { CostsDashboardClient } from "./CostsDashboardClient";
import { redirect } from "next/navigation";

export default async function CostsDashboardPage() {
  const { profile } = await requireUser();
  if (!canViewCostDashboard(profile.role)) redirect("/dashboard");
  return <CostsDashboardClient />;
}
