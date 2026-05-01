// Central theme state management.
// Single source of truth for the current theme mode.
// Persists to localStorage so the chosen theme survives reloads.

export type AxThemeMode = "light" | "dark" | "auto";
export type AxEffectiveTheme = "light" | "dark";

const THEME_STORAGE_KEY = "alexquant.themeMode";

let _mode: AxThemeMode = "auto";
let _effective: AxEffectiveTheme = "light";
let _initialized = false;
const _observers = new Set<(effective: AxEffectiveTheme) => void>();
let _mediaQuery: MediaQueryList | null = null;

export function isDarkTheme(): boolean {
  return _effective === "dark";
}

export function getCurrentMode(): AxThemeMode {
  return _mode;
}

export function getEffectiveTheme(): AxEffectiveTheme {
  return _effective;
}

/** Subscribe to theme changes. Returns unsubscribe function. */
export function onThemeChanged(cb: (effective: AxEffectiveTheme) => void): () => void {
  _observers.add(cb);
  return () => {
    _observers.delete(cb);
  };
}

/** Set theme mode and persist. */
export function setTheme(mode: AxThemeMode): void {
  _mode = mode;
  const next = resolveEffective(mode);
  applyEffective(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* non-critical */
  }
}

/** Initialize theme from persisted preference + system detection. Call once at boot. */
export function initTheme(): void {
  if (_initialized) return;
  _initialized = true;

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") {
      _mode = stored;
    }
  } catch {
    /* fallback to auto */
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    _mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    _mediaQuery.addEventListener("change", () => {
      if (_mode === "auto") applyEffective(resolveEffective("auto"));
    });
  }

  applyEffective(resolveEffective(_mode), false);
}

function resolveEffective(mode: AxThemeMode): AxEffectiveTheme {
  if (mode === "auto") {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return "light";
    }
    const mq = _mediaQuery ?? window.matchMedia("(prefers-color-scheme: dark)");
    return mq.matches ? "dark" : "light";
  }
  return mode;
}

/**
 * Mark the host body so dark-mode CSS can target Schwab's content for
 * filter-inversion (Dark Reader–style hijack). The CSS lives in
 * axTheme/shellCss.ts and only filters body children that aren't tagged
 * as AlexQuant overlays (`#alexquant-*`, `.ax-shell-element`, `alexquant-tip`,
 * `.dock-notification-container`, etc.). This keeps Schwab visible but
 * tone-matched to the dark theme, instead of just blanking it out.
 */
function ensurePageHijack(active: boolean): void {
  if (typeof document === "undefined") return;
  // Drop any legacy blackout div from earlier iterations of this work.
  const legacy = document.getElementById("ax-page-blackout");
  if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);

  const body = document.body;
  if (!body) return;
  body.classList.toggle("ax-host-hijack", active);
}

function applyEffective(theme: AxEffectiveTheme, animate = true): void {
  if (typeof document === "undefined") {
    _effective = theme;
    return;
  }

  // Body may not exist yet when the userscript runs at document_start. Defer
  // the class toggle until the body is parsed; CSS vars on :root still apply
  // to the page, so the dark variants pick up automatically once body lands.
  const body = document.body;
  if (!body) {
    _effective = theme;
    if (typeof window !== "undefined") {
      const apply = () => applyEffective(theme, false);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
      } else {
        // Body not yet parsed but readyState advanced — try again next tick.
        queueMicrotask(apply);
      }
    }
    return;
  }

  if (
    theme === _effective &&
    body.classList.contains("theme-dark") === (theme === "dark")
  ) {
    // Even when no class change is needed, make sure the blackout is in sync
    // (e.g. after navigation that wiped body children).
    ensurePageHijack(theme === "dark");
    return;
  }
  _effective = theme;

  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transitioning");
    setTimeout(() => root.classList.remove("theme-transitioning"), 350);
  }

  body.classList.toggle("theme-dark", theme === "dark");
  ensurePageHijack(theme === "dark");

  // Dispatch custom event for canvas/chart listeners
  try {
    window.dispatchEvent(new CustomEvent("themeChanged", { detail: { theme } }));
  } catch {
    /* no-op */
  }

  for (const cb of _observers) {
    try {
      cb(theme);
    } catch {
      /* observer errors are non-critical */
    }
  }
}
