import { requireUser } from "@/lib/auth";
import { canManageAllocations } from "@/lib/permissions";
import { AllocationsClient } from "./AllocationsClient";
import { redirect } from "next/navigation";

export default async function CostAllocationsPage() {
  const { profile } = await requireUser();
  if (!canManageAllocations(profile.role)) redirect("/dashboard");
  return (
    <AllocationsClient
      userId={profile.id}
      canApprove={profile.role === "managing_partner"}
    />
  );
}
