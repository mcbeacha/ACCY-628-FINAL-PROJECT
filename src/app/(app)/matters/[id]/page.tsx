import { requireUser } from "@/lib/auth";
import { MatterDetailClient } from "./MatterDetailClient";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  return <MatterDetailClient matterId={id} role={profile.role} userId={profile.id} />;
}
