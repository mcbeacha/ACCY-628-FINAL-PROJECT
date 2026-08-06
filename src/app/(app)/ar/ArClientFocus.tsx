"use client";

import { useEffect } from "react";

/** Scroll to Outstanding by Client when arriving from the Firm Pulse card. */
export function ArClientFocus({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const el = document.getElementById("outstanding-by-client");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [active]);

  return null;
}
