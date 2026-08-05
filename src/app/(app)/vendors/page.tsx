import { requireUser } from "@/lib/auth";
import { canManageVendors } from "@/lib/permissions";
import { VendorsClient } from "./VendorsClient";
import { redirect } from "next/navigation";

export default async function VendorsPage() {
  const { profile } = await requireUser();
  if (!canManageVendors(profile.role)) redirect("/dashboard");
  return (
    <VendorsClient
      userId={profile.id}
      role={profile.role}
      canApprove={profile.role === "managing_partner"}
    />
  );
}
