import { ClientPortalExperienceGuard } from "@/components/client-portal/ClientPortalExperienceGuard";

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return <ClientPortalExperienceGuard>{children}</ClientPortalExperienceGuard>;
}
