import { requireUser } from "@/lib/auth";
import { canEnterTime, canViewInternalCost } from "@/lib/permissions";
import { TimeEntryForm } from "@/components/TimeEntryForm";
import { redirect } from "next/navigation";

export default async function EnterTimePage() {
  const { profile } = await requireUser();
  if (!canEnterTime(profile.role)) redirect("/dashboard");
  return (
    <TimeEntryForm
      userId={profile.id}
      showInternalCost={canViewInternalCost(profile.role)}
    />
  );
}
