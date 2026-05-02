// CSS runtime — injects the full UI stylesheet into <head> on first use.
// Idempotent: subsequent calls are a single boolean check.

import { axCssVars } from "./cssVars";
import {
  axResetCss,
  axUtilitiesCss,
  axPresetsCss,
  axAnimationsCss,
  axGlassCss,
} from "./baseCss";
import { axShellCss } from "./shellCss";
import {
  ensureLiquidGlassFilter,
  startGlobalRimObserver,
} from "./liquidGlass";
import { initRenderMode } from "./renderMode/controller";
import { axEcoOverrideCss } from "./renderMode/overrideCss";

const STYLE_ID = "ax-ui-runtime";

let injected = false;
let runtimeBootstrapped = false;

function bootstrapLiquidGlassRuntime(): void {
  if (runtimeBootstrapped) return;
  runtimeBootstrapped = true;
  // SVG filter wants document.body — defer if not yet available.
  if (typeof document === "undefined") return;
  const apply = () => {
    ensureLiquidGlassFilter();
    startGlobalRimObserver();
  };
  if (document.body) {
    apply();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    queueMicrotask(apply);
  }
}

export function ensureAxUICss(): void {
  // Render mode must be resolved before bootstrapLiquidGlassRuntime() so
  // the liquidGlassEnabled flag is set when ensureLiquidGlassFilter() and
  // attachLiquidGlassRim() run on DOMContentLoaded. initRenderMode() is
  // idempotent — calling it from every entry point of the runtime is
  // cheap and means consumers cannot accidentally bootstrap before the
  // renderMode controller has read its persisted preference.
  initRenderMode();
  if (injected) {
    bootstrapLiquidGlassRuntime();
    return;
  }
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    bootstrapLiquidGlassRuntime();
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  // axEcoOverrideCss goes last: even though !important wins regardless
  // of source order, putting the eco overrides at the tail keeps the
  // stylesheet self-documenting (Full-mode rules first, Eco hot-fix
  // overrides at the bottom).
  style.textContent = [
    axCssVars(),
    axResetCss,
    axGlassCss,
    axUtilitiesCss,
    axPresetsCss,
    axAnimationsCss,
    axShellCss,
    axEcoOverrideCss,
  ].join("\n");
  // <head> may not exist yet at document_start; fall back to documentElement
  // so the stylesheet still lands above any later content.
  const target = document.head ?? document.documentElement;
  if (target) {
    target.appendChild(style);
    injected = true;
  } else if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (!injected) {
          (document.head ?? document.documentElement).appendChild(style);
          injected = true;
        }
      },
      { once: true },
    );
  }
  bootstrapLiquidGlassRuntime();
}

/** Compose a class list, ignoring falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
