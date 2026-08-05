import { requireUser } from "@/lib/auth";
import { canApproveMatterCosts } from "@/lib/permissions";
import { CostReviewClient } from "./CostReviewClient";
import { redirect } from "next/navigation";

export default async function CostReviewPage() {
  const { profile } = await requireUser();
  if (!canApproveMatterCosts(profile.role)) redirect("/dashboard");
  return <CostReviewClient userId={profile.id} role={profile.role} />;
}
