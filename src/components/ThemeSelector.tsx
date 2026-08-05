"use client";

import {
  DARK_THEME,
  DEFAULT_THEME,
  LIGHT_THEME,
  THEME_STORAGE_KEY,
  normalizeTheme,
  type ThemeId,
} from "@/lib/constants";
import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): ThemeId {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function getServerSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === DARK_THEME;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    const next = isDark ? LIGHT_THEME : DARK_THEME;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private browsing — keep the in-page theme working anyway */
    }
    document.documentElement.setAttribute("data-theme", next);
    listeners.forEach((notify) => notify());
  }

  const nextLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;

  if (compact) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm"
        onClick={toggle}
        aria-label={nextLabel}
        title={nextLabel}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <label className="flex w-full items-center gap-3">
      <span className="text-xs font-semibold opacity-70">Theme</span>
      <button
        type="button"
        className="btn btn-outline btn-sm gap-2"
        onClick={toggle}
        aria-label={nextLabel}
        aria-pressed={isDark}
      >
        <Icon className="h-4 w-4" />
        {isDark ? "Dark" : "Light"}
      </button>
    </label>
  );
}
