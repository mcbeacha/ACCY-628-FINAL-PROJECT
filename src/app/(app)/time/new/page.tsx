import { requireUser } from "@/lib/auth";
import { canEnterTime, canViewInternalCost } from "@/lib/permissions";
import { TimeEntryForm } from "@/components/TimeEntryForm";
import { redirect } from "next/navigation";

export default async function EnterTimePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; matter?: string }>;
}) {
  const { profile } = await requireUser();
  if (!canEnterTime(profile.role)) redirect("/dashboard");
  const params = await searchParams;
  return (
    <TimeEntryForm
      userId={profile.id}
      showInternalCost={canViewInternalCost(profile.role)}
      editId={params.edit || undefined}
      defaultMatterId={params.matter || undefined}
    />
  );
}
