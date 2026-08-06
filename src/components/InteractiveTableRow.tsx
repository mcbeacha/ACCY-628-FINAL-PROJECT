"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

/**
 * Full-row navigable table row with shared interactive-row hover feedback.
 * Nested links/buttons should call stopPropagation to avoid double navigation.
 */
export function InteractiveTableRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    router.push(href);
  }

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, label")) return;
    go();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  }

  return (
    <tr
      className={`interactive-row ${className}`.trim()}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="link"
    >
      {children}
    </tr>
  );
}
