// Central theme state management.
// Single source of truth for the current theme mode.
//
// Persistence is dual-write: IndexedDB (`kv:ui.themeMode`) is canonical;
// `localStorage:alexquant.themeMode` is a synchronous boot fast-path cache
// because IndexedDB opens asynchronously and the body class drives a host-page
// filter hijack that must be live before Schwab paints. See STORAGE.md.
//
// Mode is now a pure light/dark toggle — Auto / system-preference
// tracking has been removed. Old persisted "auto" values are migrated
// once on first read (resolved against the current OS preference and
// rewritten as a concrete light/dark value).

import type { KVStore } from "backend/core/db/core/KVStore";

import { isEco } from "./renderMode/controller";

export type AxThemeMode = "light" | "dark";
export type AxEffectiveTheme = "light" | "dark";

const THEME_STORAGE_KEY = "alexquant.themeMode";
const THEME_KV_KEY = "ui.themeMode";

let _mode: AxThemeMode = "dark";
let _effective: AxEffectiveTheme = "dark";
let _initialized = false;
let _kv: KVStore | null = null;
const _observers = new Set<(effective: AxEffectiveTheme) => void>();

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

/** Set theme mode and persist (dual-write: localStorage + KV when attached). */
export function setTheme(mode: AxThemeMode): void {
  _mode = mode;
  applyEffective(mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* non-critical */
  }
  if (_kv) {
    void _kv.set(THEME_KV_KEY, mode).catch(() => {
      /* non-critical: localStorage already has the value */
    });
  }
}

/**
 * Reconcile the in-memory mode against the canonical KV value once the
 * IndexedDB-backed KVStore is ready. Call before any UI is rendered so a
 * cross-device divergence (KV says light, localStorage says dark) cannot
 * produce a visible flip. If KV is empty, backfill it from the value
 * already loaded from localStorage at boot.
 */
export async function hydrateThemeFromKV(kv: KVStore): Promise<void> {
  _kv = kv;
  let stored: AxThemeMode | undefined;
  try {
    stored = await kv.get<AxThemeMode>(THEME_KV_KEY);
  } catch {
    return;
  }
  if (stored === "light" || stored === "dark") {
    if (stored !== _mode) setTheme(stored);
  } else {
    void kv.set(THEME_KV_KEY, _mode).catch(() => {
      /* non-critical */
    });
  }
}

/** Initialize theme from persisted preference. Call once at boot. */
export function initTheme(): void {
  if (_initialized) return;
  _initialized = true;

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* fallback to default */
  }

  if (stored === "light" || stored === "dark") {
    _mode = stored;
  } else if (stored === "auto") {
    // Migration: a user previously chose Auto. Resolve once to a concrete
    // mode based on current OS preference and persist that, so future
    // reads land in the light/dark branch above.
    const prefersDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    _mode = prefersDark ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, _mode);
    } catch {
      /* non-critical */
    }
  }
  // else: keep default "dark"

  applyEffective(_mode, false);
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

  // Skip the cross-fade transition in Eco mode — its 350ms full-tree
  // transition is exactly the kind of motion Eco strips out elsewhere.
  if (animate && !isEco()) {
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
