// All Eco-mode CSS overrides live here. Injected once after the rest of
// the AlexQuant stylesheet so the !important rules take precedence over
// the Full-mode glass / animation defaults defined in baseCss.ts.
//
// Eco is theme-orthogonal: every override below targets `body.ax-eco`
// without a `.theme-dark` qualifier, so the same rule applies in both
// light-Eco and dark-Eco. Anything theme-specific stays in baseCss.ts /
// shellCss.ts and reads the --ax-* vars from cssVars.ts.
//
// Strategy:
//   - Hard disables for the 🔴/🟠 hot spots: backdrop-filter, glass
//     refract filter, glass rim, glass shadow, infinite pulse animation.
//   - Universal duration zeroing using the W3C reduced-motion idiom.
//     Kills every transition / animation duration without touching the
//     property + easing declarations themselves, so toggling back to
//     Full instantly restores motion.
//   - Whitelisted exceptions: data-update flashes (flash-update-*) and
//     the dock streamer flash carry information ("price changed",
//     "streamer reconnected"), so they keep their original duration.

export const axEcoOverrideCss = `
    /* ─── Glass surfaces: drop backdrop-filter + box-shadow, swap in
           solid theme background. Borders stay in place via the inherited
           --ax-glass-N-border vars so the surface keeps its outline. The
           selector list covers every preset that composes a glass tier;
           any new glass-based preset must be added here too. ─────────── */
    body.ax-eco .ax-glass-1,
    body.ax-eco .ax-glass-2,
    body.ax-eco .ax-glass-3,
    body.ax-eco .az-preset-panel,
    body.ax-eco .az-preset-card,
    body.ax-eco .az-preset-collapsible-card,
    body.ax-eco .az-preset-metric-cell,
    body.ax-eco .az-preset-metric-cell-inline {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      background: var(--ax-bg-card) !important;
      box-shadow: none !important;
    }

    /* ─── Glass refract: SVG chromatic-aberration filter is the
           single most expensive composite in Full mode (a 12-primitive
           feFilter pipeline). Disabled wholesale. The JS bootstrap also
           skips ensureLiquidGlassFilter() when Eco is the boot mode. */
    body.ax-eco .ax-glass-refract {
      filter: none !important;
    }

    /* ─── Glass rim pseudo-elements: hide the parameterised primary +
           secondary blend layers. The JS listeners are also detached
           when Eco is active, so the per-mousemove rAF flush stops
           firing too. */
    body.ax-eco .ax-glass-rim::before,
    body.ax-eco .ax-glass-rim::after {
      display: none !important;
    }

    /* ─── Status-dot pulse: kill the 1.8s infinite box-shadow
           animation on .ax-status-dot--live / --alert. The colored dot
           itself stays so users still see live / alert state. */
    body.ax-eco .ax-status-dot--live,
    body.ax-eco .ax-status-dot--alert {
      animation: none !important;
    }

    /* ─── Universal duration zero — standard reduced-motion idiom.
           Keeps transition property + easing intact (so a toggle back
           to Full restores motion immediately) but drops every
           animation / transition to instantaneous. Covers every
           transition and keyframe animation across the frontend without
           each component having to opt in. */
    body.ax-eco *,
    body.ax-eco *::before,
    body.ax-eco *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }

    /* ─── Whitelist: data-change flashes carry information ("price
           updated", "streamer reconnected"), so we restore their
           original durations after the universal rule above.
           The unqualified body.ax-eco selector already matches both
           light-Eco and dark-Eco (the dark-theme override only swaps
           the keyframe name, not the selector), so no theme-qualified
           duplicate is needed here. */
    body.ax-eco .flash-update-green,
    body.ax-eco .flash-update-red {
      animation-duration: 0.6s !important;
    }
    body.ax-eco .dock-status-dot--streamer-flash {
      animation-duration: 0.2s !important;
    }
  `;
