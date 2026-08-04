import { requireUser } from "@/lib/auth";
import { canApproveExpenses } from "@/lib/permissions";
import { ExpenseReviewClient } from "./ExpenseReviewClient";
import { redirect } from "next/navigation";

export default async function ExpenseReviewPage() {
  const { profile } = await requireUser();
  if (!canApproveExpenses(profile.role)) redirect("/dashboard");
  return <ExpenseReviewClient userId={profile.id} />;
}
