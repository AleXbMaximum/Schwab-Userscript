// Centralized layout-mode detection for CSS class toggles and JS branching.

export type LayoutMode = "desktop" | "mobile";
type Listener = (mode: LayoutMode) => void;

let current: LayoutMode = "desktop";
const listeners = new Set<Listener>();

/** Initialize layout detection and keep it reactive on viewport changes. */
export function initLayoutMode(): LayoutMode {
  const mql = window.matchMedia("(max-width: 768px)");
  current = mql.matches ? "mobile" : "desktop";
  applyHtmlClass(current);
  mql.addEventListener("change", (e) => {
    const next: LayoutMode = e.matches ? "mobile" : "desktop";
    if (next === current) return;
    current = next;
    applyHtmlClass(current);
    listeners.forEach((fn) => fn(current));
  });
  return current;
}

/** Synchronous read of current layout mode. */
export function getLayoutMode(): LayoutMode {
  return current;
}

/** Subscribe to layout mode changes. Returns an unsubscribe function. */
export function onLayoutModeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function applyHtmlClass(mode: LayoutMode) {
  document.documentElement.classList.toggle("layout-mobile", mode === "mobile");
  document.documentElement.classList.toggle(
    "layout-desktop",
    mode === "desktop",
  );
}
