import { requireUser } from "@/lib/auth";
import { canPostPayments } from "@/lib/permissions";
import { PaymentsClient } from "./PaymentsClient";
import { redirect } from "next/navigation";

export default async function PaymentsPage() {
  const { profile } = await requireUser();
  if (!canPostPayments(profile.role)) redirect("/dashboard");
  return <PaymentsClient userId={profile.id} />;
}
