import { requireUser } from "@/lib/auth";
import { canManageRetainers } from "@/lib/permissions";
import { RetainersClient } from "./RetainersClient";
import { redirect } from "next/navigation";

export default async function RetainersPage() {
  const { profile } = await requireUser();
  if (!canManageRetainers(profile.role)) redirect("/dashboard");
  return <RetainersClient userId={profile.id} />;
}
