import { redirect } from "next/navigation";

/** Legacy portal route — Current Client milestones live under /client-portal. */
export default function LegacyPortalRedirect() {
  redirect("/client-portal/milestones");
}
