import { requireUser } from "@/lib/auth";
import { MatterDetailClient } from "./MatterDetailClient";
import { Suspense } from "react";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  return (
    <Suspense fallback={<div className="p-6 text-sm opacity-60">Loading matter…</div>}>
      <MatterDetailClient matterId={id} role={profile.role} userId={profile.id} />
    </Suspense>
  );
}
