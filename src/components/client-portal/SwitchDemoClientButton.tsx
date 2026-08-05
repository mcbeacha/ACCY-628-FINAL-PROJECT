"use client";

import { useDemoRole } from "@/components/demo/DemoRoleProvider";

export function SwitchDemoClientButton({
  target,
  className,
  children,
}: {
  target: "potential_client" | "current_client";
  className?: string;
  children: React.ReactNode;
}) {
  const demo = useDemoRole();

  if (!demo) {
    // Non-demo: plain link fallback
    const href = target === "current_client" ? "/client-portal" : "/potential-client";
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={demo.switching}
      onClick={() => void demo.setActiveDemoRole(target)}
    >
      {demo.switching ? "Switching…" : children}
    </button>
  );
}
