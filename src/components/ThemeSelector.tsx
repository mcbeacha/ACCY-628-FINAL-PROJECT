"use client";

import { THEMES } from "@/lib/constants";
import { useEffect, useState } from "react";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState("corporate");

  useEffect(() => {
    const saved = localStorage.getItem("rlg-theme") || "corporate";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function onChange(next: string) {
    setTheme(next);
    localStorage.setItem("rlg-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <label className={`flex items-center gap-2 ${compact ? "" : "w-full"}`}>
      {!compact && <span className="text-xs font-semibold opacity-70">Theme</span>}
      <select
        className={`select select-bordered ${compact ? "select-sm" : "select-sm"} max-w-[10rem]`}
        value={theme}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Color theme"
      >
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
