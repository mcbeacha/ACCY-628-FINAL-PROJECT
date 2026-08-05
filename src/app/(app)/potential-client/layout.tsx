import { PotentialClientExperienceGuard } from "@/components/client-portal/PotentialClientExperienceGuard";

export default function PotentialClientLayout({ children }: { children: React.ReactNode }) {
  return <PotentialClientExperienceGuard>{children}</PotentialClientExperienceGuard>;
}
