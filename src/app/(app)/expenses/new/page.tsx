import { requireUser } from "@/lib/auth";
import { canEnterTime } from "@/lib/permissions";
import { ExpenseEntryForm } from "@/components/ExpenseEntryForm";
import { redirect } from "next/navigation";

export default async function EnterExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; matter?: string }>;
}) {
  const { profile } = await requireUser();
  if (!canEnterTime(profile.role)) redirect("/dashboard");
  const params = await searchParams;
  return (
    <ExpenseEntryForm
      userId={profile.id}
      editId={params.edit || undefined}
      defaultMatterId={params.matter || undefined}
    />
  );
}
