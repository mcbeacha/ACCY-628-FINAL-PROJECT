import { requireUser } from "@/lib/auth";
import { canEnterTime } from "@/lib/permissions";
import { ExpenseEntryForm } from "@/components/ExpenseEntryForm";
import { redirect } from "next/navigation";

export default async function EnterExpensePage() {
  const { profile } = await requireUser();
  if (!canEnterTime(profile.role)) redirect("/dashboard");
  return <ExpenseEntryForm userId={profile.id} />;
}
