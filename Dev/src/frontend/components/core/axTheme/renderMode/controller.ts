// Render-mode state — Full vs Eco.
//
// Mirrors the light/dark theme controller pattern: a single source of
// truth, dual-write persistence (IndexedDB canonical, localStorage as
// boot fast-path cache — see STORAGE.md), observer subscriptions, and
// a body class hook that CSS can target. Adding a future mode
// (PowerSaver, Battery, ...) is a one-file change here plus a
// corresponding rule block in overrideCss.ts.
//
// "full" is the rich default with all glass effects, blur, glow, and
// motion. "eco" disables expensive composites (backdrop-filter, the
// SVG refraction filter, glass-rim mouse tracking, canvas shadowBlur),
// kills infinite pulse animations, and zeroes out transition /
// animation durations using the W3C reduced-motion idiom — preserving
// each transition's property + easing definition so toggling back to
// Full immediately restores the original feel without rebuilding any
// stylesheet.
//
// Decoupling: this module talks to liquidGlass via a single
// setLiquidGlassEnabled() switch. liquidGlass.ts has zero awareness of
// render modes, so future modes can be added here without touching
// the liquid-glass runtime.

import type { KVStore } from "backend/core/db/core/KVStore";

import { setLiquidGlassEnabled } from "../liquidGlass";

export type AxRenderMode = "full" | "eco";

const STORAGE_KEY = "alexquant.renderMode";
const RENDER_MODE_KV_KEY = "ui.renderMode";
const ECO_BODY_CLASS = "ax-eco";

let _mode: AxRenderMode = "full";
let _initialized = false;
let _kv: KVStore | null = null;
const _observers = new Set<(mode: AxRenderMode) => void>();

export function getRenderMode(): AxRenderMode {
  return _mode;
}

export function isEco(): boolean {
  return _mode === "eco";
}

/** Subscribe to render-mode changes. Returns unsubscribe function. */
export function onRenderModeChanged(
  cb: (mode: AxRenderMode) => void,
): () => void {
  _observers.add(cb);
  return () => {
    _observers.delete(cb);
  };
}

/** Set render mode and persist (dual-write: localStorage + KV when attached). Idempotent: same-mode calls are a no-op. */
export function setRenderMode(mode: AxRenderMode): void {
  if (_mode === mode) return;
  _mode = mode;
  applyMode(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* non-critical */
  }
  if (_kv) {
    void _kv.set(RENDER_MODE_KV_KEY, mode).catch(() => {
      /* non-critical: localStorage already has the value */
    });
  }
}

/**
 * Reconcile against the canonical KV value once the IndexedDB-backed
 * KVStore is ready. Call before any UI is rendered. If KV is empty,
 * backfill it from the localStorage-derived boot value.
 */
export async function hydrateRenderModeFromKV(kv: KVStore): Promise<void> {
  _kv = kv;
  let stored: AxRenderMode | undefined;
  try {
    stored = await kv.get<AxRenderMode>(RENDER_MODE_KV_KEY);
  } catch {
    return;
  }
  if (stored === "full" || stored === "eco") {
    if (stored !== _mode) setRenderMode(stored);
  } else {
    void kv.set(RENDER_MODE_KV_KEY, _mode).catch(() => {
      /* non-critical */
    });
  }
}

/**
 * Initialise render mode from persisted preference. Idempotent. Should
 * run before the liquid-glass runtime bootstraps so the SVG filter and
 * rim observer pick up the correct enabled flag.
 */
export function initRenderMode(): void {
  if (_initialized) return;
  _initialized = true;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "full" || stored === "eco") {
      _mode = stored;
    }
  } catch {
    /* fallback to default */
  }

  applyMode(_mode);
}

function applyMode(mode: AxRenderMode): void {
  // Body class — CSS overrides in overrideCss.ts target body.ax-eco.
  // Body may not exist yet at document_start; defer the toggle.
  if (typeof document !== "undefined") {
    const body = document.body;
    if (body) {
      body.classList.toggle(ECO_BODY_CLASS, mode === "eco");
    } else {
      const apply = () => {
        document.body?.classList.toggle(ECO_BODY_CLASS, mode === "eco");
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply, { once: true });
      } else {
        queueMicrotask(apply);
      }
    }
  }

  // Drive the liquid-glass runtime synchronously regardless of body
  // readiness — the flag gates every later attach call, so toggling it
  // before the rim observer fires is what makes "boot into eco" silent.
  setLiquidGlassEnabled(mode === "full");

  for (const cb of _observers) {
    try {
      cb(mode);
    } catch {
      /* observer errors are non-critical */
    }
  }
}
