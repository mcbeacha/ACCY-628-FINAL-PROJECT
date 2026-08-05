"use client";

import { useDemoRole } from "@/components/demo/DemoRoleProvider";
import { useEffect } from "react";

/** When opening Current Client routes from Potential Client nav, sync the demo key. */
export function ClientPortalExperienceGuard({ children }: { children: React.ReactNode }) {
  const demo = useDemoRole();
  const key = demo?.activeDemoRole;
  const setRole = demo?.setActiveDemoRole;

  useEffect(() => {
    if (!setRole) return;
    if (key === "potential_client") {
      void setRole("current_client", { silent: true, home: false });
    }
  }, [key, setRole]);

  return <>{children}</>;
}
