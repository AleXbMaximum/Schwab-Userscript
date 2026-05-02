// Theme + style runtime entry. Thin wrapper around the AlexQuant
// design-token system in ./axTheme. Existing callsites import the same
// three functions (addAnimationStyles / addGlobalStyle / applyColorTheme),
// which now bootstrap the unified theme stylesheet and apply the chosen
// light / dark mode.

import { ensureAxUICss } from "./axTheme/runtime";
import { initTheme, setTheme, type AxThemeMode } from "./axTheme/controller";

/** Inject all CSS — vars + reset + utilities + presets + animations + shell. */
export function addGlobalStyle(): void {
  ensureAxUICss();
}

/** Animations are bundled inside ensureAxUICss(); kept for back-compat. */
export function addAnimationStyles(): void {
  ensureAxUICss();
}

/**
 * Initialise / apply a colour theme. Recognised values:
 *   - "default" → boot-mode: load persisted preference (falls back to
 *                  the dark default if none). Does not overwrite the
 *                  user's stored mode.
 *   - "light"   → force light theme (persists choice).
 *   - "dark"    → force dark theme (persists choice).
 *
 * Always idempotent: ensures CSS is injected and the controller is wired.
 */
export function applyColorTheme(theme = "default"): string {
  ensureAxUICss();
  initTheme();

  if (theme === "light" || theme === "dark") {
    const mode: AxThemeMode = theme;
    setTheme(mode);
  }
  // "default" / anything else → keep the persisted mode already applied
  // by initTheme().
  return theme;
}
