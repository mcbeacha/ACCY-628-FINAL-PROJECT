import { requireUser } from "@/lib/auth";
import { canApproveTime } from "@/lib/permissions";
import { TimeReviewClient } from "./TimeReviewClient";
import { redirect } from "next/navigation";

export default async function TimeReviewPage() {
  const { profile } = await requireUser();
  if (!canApproveTime(profile.role)) redirect("/dashboard");
  return <TimeReviewClient userId={profile.id} role={profile.role} />;
}
