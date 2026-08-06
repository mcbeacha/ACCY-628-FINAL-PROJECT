"use client";

import {
  DARK_THEME,
  DEFAULT_THEME,
  FUN_THEME,
  LIGHT_THEME,
  THEME_STORAGE_KEY,
  normalizeTheme,
  type ThemeId,
} from "@/lib/constants";
import { Moon, Sparkles, Sun } from "lucide-react";
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

function applyTheme(next: ThemeId) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* private browsing — keep the in-page theme working anyway */
  }
  document.documentElement.setAttribute("data-theme", next);
  listeners.forEach((notify) => notify());
}

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isFun = theme === FUN_THEME;
  const isDark = theme === DARK_THEME;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    // Exits Fun if active; otherwise flips light ↔ dark as before.
    if (isFun) {
      applyTheme(LIGHT_THEME);
      return;
    }
    applyTheme(isDark ? LIGHT_THEME : DARK_THEME);
  }

  function selectFun() {
    applyTheme(FUN_THEME);
  }

  const nextLabel = isFun
    ? "Exit Fun theme to light mode"
    : isDark
      ? "Switch to light mode"
      : "Switch to dark mode";
  const Icon = isDark && !isFun ? Sun : Moon;
  const lightDarkLabel = isDark && !isFun ? "Dark" : "Light";

  if (compact) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm"
        onClick={toggle}
        aria-label={isFun ? "Switch to light mode" : nextLabel}
        title={isFun ? "Switch to light mode" : nextLabel}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <span className="text-xs font-semibold opacity-70">Theme</span>
      <button
        type="button"
        className={[
          "btn btn-outline btn-sm gap-2",
          isFun ? "opacity-50" : "",
        ].join(" ")}
        onClick={toggle}
        aria-label={nextLabel}
        aria-pressed={isDark && !isFun}
      >
        <Icon className="h-4 w-4" />
        {lightDarkLabel}
      </button>
      <button
        type="button"
        className={[
          "btn btn-sm gap-2",
          isFun ? "btn-primary" : "btn-outline",
        ].join(" ")}
        onClick={selectFun}
        aria-label="Switch to Fun neon theme"
        aria-pressed={isFun}
      >
        <Sparkles className="h-4 w-4" />
        Fun
      </button>
    </div>
  );
}
