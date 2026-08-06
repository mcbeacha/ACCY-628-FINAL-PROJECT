import confetti from "canvas-confetti";
import {
  FUN_THEME,
  THEME_STORAGE_KEY,
  normalizeTheme,
} from "@/lib/constants";

export function isFunThemeActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)) === FUN_THEME;
  } catch {
    return false;
  }
}

/** Neon confetti burst for ~2 seconds when Fun theme is active. */
export function celebrateTaskComplete(): void {
  if (typeof window === "undefined") return;
  if (!isFunThemeActive()) return;

  const end = Date.now() + 2000;
  const colors = ["#ff2bd6", "#00f0ff", "#b8ff00", "#ffe600", "#ff3366", "#39c5ff"];

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.65 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.65 },
      colors,
      zIndex: 9999,
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    } else {
      confetti.reset();
    }
  };

  frame();
}
