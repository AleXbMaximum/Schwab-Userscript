// Base reset / utilities / presets / animations / app-shell CSS.
// All values come from --ax-* CSS vars so the entire stylesheet is theme-aware.

export const axResetCss = `
    :focus-visible {
      outline: 2px solid rgba(10,132,255,0.35);
      outline-offset: 2px;
      border-radius: var(--ax-radius-md);
    }

    input:not([type=checkbox]):not([type=radio]):focus,
    select:focus,
    textarea:focus {
      border-color: var(--ax-blue) !important;
      box-shadow: 0 0 0 3px rgba(10,132,255,0.1);
      outline: none;
    }

    input:disabled, select:disabled, textarea:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    input:focus-visible,
    textarea:focus-visible,
    button:focus-visible,
    .ios-table th.sortable:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.25);
    }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.25); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.45); }
    ::-webkit-scrollbar-corner { background: transparent; }
    body.theme-dark ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); }
    body.theme-dark ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.32); }

    /* Button press feedback */
    button:active:not(:disabled) {
      transform: scale(0.97);
      filter: brightness(0.92);
    }
    button, [role="button"] { transition: all 0.15s ease; }

    /* Theme transition */
    .theme-transitioning,
    .theme-transitioning *,
    .theme-transitioning *::before,
    .theme-transitioning *::after {
      transition:
        background-color 0.3s ease,
        color 0.3s ease,
        border-color 0.3s ease,
        box-shadow 0.3s ease,
        background 0.3s ease !important;
    }

    /* Native form coherence */
    body.theme-dark select, body.theme-dark option, body.theme-dark optgroup {
      color-scheme: dark;
    }
    body.theme-dark option, body.theme-dark optgroup {
      background-color: #2c2c2e;
      color: var(--ax-fg);
    }
    body.theme-dark input:not([type=checkbox]):not([type=radio]),
    body.theme-dark select,
    body.theme-dark textarea {
      color: var(--ax-fg);
      background-color: var(--ax-bg-input);
    }
    body.theme-dark ::placeholder {
      color: var(--ax-fg-2);
      opacity: 0.7;
    }

    /* ─── Defensive overrides for legacy inline-style hardcoded surfaces ───
       Catches the common patterns embedded in older renderers' styleString
       values where translucent white backgrounds were used directly. In
       dark mode those would otherwise punch through as bright white panels
       on a dark canvas. */
    body.theme-dark [style*="background: rgba(255, 255, 255"],
    body.theme-dark [style*="background: rgba(255,255,255"],
    body.theme-dark [style*="background:rgba(255,255,255"],
    body.theme-dark [style*="background:rgba(255, 255, 255"],
    body.theme-dark [style*="background-color: rgba(255, 255, 255"],
    body.theme-dark [style*="background-color: rgba(255,255,255"],
    body.theme-dark [style*="background-color:rgba(255,255,255"],
    body.theme-dark [style*="background: rgb(255, 255, 255)"],
    body.theme-dark [style*="background: rgb(255,255,255)"],
    body.theme-dark [style*="background:rgb(255,255,255)"],
    body.theme-dark [style*="background: #fff"],
    body.theme-dark [style*="background:#fff"],
    body.theme-dark [style*="background-color: #fff"],
    body.theme-dark [style*="background-color:#fff"],
    body.theme-dark [style*="background: #FFF"],
    body.theme-dark [style*="background:#FFF"],
    body.theme-dark [style*="background: white"],
    body.theme-dark [style*="background:white"],
    body.theme-dark [style*="background-color: white"],
    body.theme-dark [style*="background-color:white"] {
      background-color: var(--ax-bg-card) !important;
      background-image: none !important;
    }

    /* Dark mode: defensive text-color override for inline-style black/dark text. */
    body.theme-dark [style*="color: #1c1c1e"],
    body.theme-dark [style*="color:#1c1c1e"],
    body.theme-dark [style*="color: #3a3a3c"],
    body.theme-dark [style*="color:#3a3a3c"],
    body.theme-dark [style*="color: #222"],
    body.theme-dark [style*="color:#222"],
    body.theme-dark [style*="color: #111"],
    body.theme-dark [style*="color:#111"],
    body.theme-dark [style*="color: #000"],
    body.theme-dark [style*="color:#000"],
    body.theme-dark [style*="color: black"],
    body.theme-dark [style*="color:black"] {
      color: var(--ax-fg) !important;
    }

    /* Dark mode: defensive border color for hardcoded light borders. */
    body.theme-dark [style*="border: 1px solid #fff"],
    body.theme-dark [style*="border:1px solid #fff"],
    body.theme-dark [style*="border-color: #fff"],
    body.theme-dark [style*="border-color:#fff"] {
      border-color: var(--ax-border) !important;
    }
  `;

// ──────────────────────────────────────────────────────────────────────────
// Liquid-glass utility classes — drop-in replacements for the repeated 6-line
// inline-style blob (`background + backdrop-filter + border + shadow + edge`)
// that floating panels used to ship verbatim. Each tier maps to a glass token
// emitted by axTheme/cssVars.ts.
//
// `.ax-glass-rim` adds the mouse-tracked dual-blend gradient rim. JS in
// liquidGlass.ts writes --ax-lg-mx / --ax-lg-my / --ax-lg-hover; CSS turns
// those into a cubic-bezier-eased rim that follows the pointer. The rim
// renders best on dark glass (light theme falls back to a static glow).
// ──────────────────────────────────────────────────────────────────────────

export const axGlassCss = `
    .ax-glass-1, .ax-glass-2, .ax-glass-3 {
      position: relative;
    }
    .ax-glass-1 {
      background: var(--ax-glass-1-bg);
      border: 1px solid var(--ax-glass-1-border);
      box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);
      -webkit-backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate)) brightness(var(--ax-glass-1-brightness));
      backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate)) brightness(var(--ax-glass-1-brightness));
    }
    .ax-glass-2 {
      background: var(--ax-glass-2-bg);
      border: 1px solid var(--ax-glass-2-border);
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
    }
    .ax-glass-3 {
      background: var(--ax-glass-3-bg);
      border: 1px solid var(--ax-glass-3-border);
      box-shadow: var(--ax-glass-3-shadow), var(--ax-glass-3-edge);
      -webkit-backdrop-filter: blur(var(--ax-glass-3-blur)) saturate(var(--ax-glass-3-saturate)) brightness(var(--ax-glass-3-brightness));
      backdrop-filter: blur(var(--ax-glass-3-blur)) saturate(var(--ax-glass-3-saturate)) brightness(var(--ax-glass-3-brightness));
    }

    /* ─── Mouse-tracked rim (dark theme — full cubic-bezier gradient) ───
       Two pseudo-elements on the same border-box give us screen + overlay
       blend modes simultaneously, ported from recorder.user.js .lg-rim--*. */
    .ax-glass-rim { position: relative; }
    .ax-glass-rim::before,
    .ax-glass-rim::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      padding: 1px;
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
              mask-composite: exclude;
      background: linear-gradient(
        calc((135 + var(--ax-lg-mx, 0) * 1.2) * 1deg),
        rgba(255,255,255,0) 0%,
        rgba(255,255,255, calc(0.04 + var(--ax-lg-mx-abs, 0) * 0.014)) calc(max(10, 33 + var(--ax-lg-my, 0) * 0.3) * 1%),
        rgba(255,255,255, calc(0.10 + var(--ax-lg-mx-abs, 0) * 0.018)) calc(min(90, 66 + var(--ax-lg-my, 0) * 0.4) * 1%),
        rgba(255,255,255,0) 100%
      );
      transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ax-glass-rim::before {
      mix-blend-mode: screen;
      opacity: calc(0.40 + var(--ax-lg-hover, 0) * 0.30);
    }
    .ax-glass-rim::after {
      mix-blend-mode: overlay;
      opacity: calc(0.28 + var(--ax-lg-hover, 0) * 0.20);
    }
    /* Light theme rim is much subtler — strong overlay blend on white reads
       as a black halo, so we drop it to a thin cool inner highlight only. */
    body:not(.theme-dark) .ax-glass-rim::before {
      background: linear-gradient(
        calc((135 + var(--ax-lg-mx, 0) * 1.2) * 1deg),
        rgba(15,30,60,0) 0%,
        rgba(15,30,60, calc(0.02 + var(--ax-lg-mx-abs, 0) * 0.005)) 50%,
        rgba(15,30,60,0) 100%
      );
      mix-blend-mode: multiply;
      opacity: calc(0.50 + var(--ax-lg-hover, 0) * 0.30);
    }
    body:not(.theme-dark) .ax-glass-rim::after {
      display: none;
    }

    /* ─── Liquid-glass refraction filter handle ───
       Adds the SVG chromatic-aberration filter from liquidGlass.ts. Use
       sparingly — backdrop-filter + filter on the same element compounds
       composite cost. Reserve for hero panels (snapshot, dock header). */
    .ax-glass-refract {
      filter: url(#ax-lg-filter);
    }

    /* ─── Status dot family ───
       Small pulsing/idle indicators ported from recorder.user.js .dot. The
       breath glow is the visual difference between "live data" and "frozen
       snapshot" — gives the UI a heartbeat without animating panel chrome.
       Each variant sets BOTH "background" and "color" so the keyframe's
       color-mix(in srgb, currentColor ...) picks up the correct halo tint;
       without "color:" the pulse animation falls back to inherited color. */
    .ax-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--ax-fg-muted);
      color: var(--ax-fg-muted);
      transition: background 220ms cubic-bezier(0.16, 1, 0.3, 1),
                  color 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ax-status-dot--live {
      background: var(--ax-positive);
      color: var(--ax-positive);
      box-shadow: 0 0 6px color-mix(in srgb, var(--ax-positive) 60%, transparent);
      animation: axStatusPulse 1.8s ease-in-out infinite;
    }
    .ax-status-dot--paused {
      background: var(--ax-orange);
      color: var(--ax-orange);
      box-shadow: 0 0 6px color-mix(in srgb, var(--ax-orange) 60%, transparent);
    }
    .ax-status-dot--offline {
      background: var(--ax-fg-muted);
      color: var(--ax-fg-muted);
      box-shadow: none;
    }
    .ax-status-dot--alert {
      background: var(--ax-critical);
      color: var(--ax-critical);
      box-shadow: 0 0 6px color-mix(in srgb, var(--ax-critical) 60%, transparent);
      animation: axStatusPulse 1.4s ease-in-out infinite;
    }
  `;

export const axUtilitiesCss = `
    /* Display */
    .u-block { display: block; }
    .u-inline { display: inline; }
    .u-inline-block { display: inline-block; }
    .u-inline-flex { display: inline-flex; }
    .u-grid { display: grid; }
    .u-hidden { display: none !important; }
    .u-flex { display: flex; }
    .u-flex-col { display: flex; flex-direction: column; }
    .u-flex-row { display: flex; flex-direction: row; }
    .u-flex-wrap { flex-wrap: wrap; }
    .u-flex-1 { flex: 1; min-width: 0; }
    .u-flex-auto { flex: auto; }
    .u-flex-none { flex: none; }
    .u-flex-shrink-0 { flex-shrink: 0; }

    /* Alignment */
    .u-items-start { align-items: flex-start; }
    .u-items-center { align-items: center; }
    .u-items-end { align-items: flex-end; }
    .u-items-stretch { align-items: stretch; }
    .u-items-baseline { align-items: baseline; }
    .u-justify-start { justify-content: flex-start; }
    .u-justify-center { justify-content: center; }
    .u-justify-end { justify-content: flex-end; }
    .u-justify-between { justify-content: space-between; }
    .u-justify-around { justify-content: space-around; }

    /* Gap */
    .u-gap-0 { gap: 0; }
    .u-gap-1 { gap: 4px; }
    .u-gap-2 { gap: 6px; }
    .u-gap-3 { gap: 8px; }
    .u-gap-4 { gap: 10px; }
    .u-gap-5 { gap: 12px; }
    .u-gap-6 { gap: 14px; }
    .u-gap-7 { gap: 16px; }
    .u-gap-8 { gap: 20px; }
    .u-gap-9 { gap: 24px; }

    /* Padding */
    .u-p-0 { padding: 0; }
    .u-p-1 { padding: 4px; }
    .u-p-2 { padding: 6px; }
    .u-p-3 { padding: 8px; }
    .u-p-4 { padding: 10px; }
    .u-p-5 { padding: 12px; }
    .u-p-7 { padding: 16px; }
    .u-p-8 { padding: 20px; }

    /* Radius */
    .u-radius-none { border-radius: 0; }
    .u-radius-xs { border-radius: var(--ax-radius-xs); }
    .u-radius-sm { border-radius: var(--ax-radius-sm); }
    .u-radius-md { border-radius: var(--ax-radius-md); }
    .u-radius-lg { border-radius: var(--ax-radius-lg); }
    .u-radius-xl { border-radius: var(--ax-radius-xl); }
    .u-radius-2xl { border-radius: var(--ax-radius-2xl); }
    .u-radius-full { border-radius: var(--ax-radius-pill); }
    .u-radius-circle { border-radius: 50%; }

    /* Typography */
    .u-text-primary { color: var(--ax-fg); }
    .u-text-secondary { color: var(--ax-fg-2); }
    .u-text-muted { color: var(--ax-fg-muted); }
    .u-text-positive { color: var(--ax-positive); }
    .u-text-negative { color: var(--ax-negative); }
    .u-text-zero { color: var(--ax-fg-muted); }
    .u-text-neutral { color: var(--ax-orange); }
    .u-text-info { color: var(--ax-blue); }
    .u-text-critical { color: var(--ax-critical); }
    .u-font-normal { font-weight: var(--ax-fw-normal); }
    .u-font-medium { font-weight: var(--ax-fw-medium); }
    .u-font-semibold { font-weight: var(--ax-fw-semibold); }
    .u-font-bold { font-weight: var(--ax-fw-bold); }
    .u-text-2xs { font-size: var(--ax-fs-2xs); }
    .u-text-xs { font-size: var(--ax-fs-xs); }
    .u-text-sm { font-size: var(--ax-fs-sm); }
    .u-text-md { font-size: var(--ax-fs-md); }
    .u-text-lg { font-size: var(--ax-fs-lg); }
    .u-text-xl { font-size: var(--ax-fs-xl); }
    .u-tabular-nums { font-variant-numeric: tabular-nums lining-nums; }
    .u-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .u-whitespace-nowrap { white-space: nowrap; }
    .u-text-center { text-align: center; }
    .u-text-right { text-align: right; }
    .u-text-left { text-align: left; }
    .u-uppercase { text-transform: uppercase; }
    .u-font-mono { font-family: var(--ax-font-mono); }
    .u-font-body { font-family: var(--ax-font-body); }

    /* Bg / border */
    .u-bg-subtle { background: var(--ax-bg-subtle); }
    .u-bg-card { background: var(--ax-bg-card); }
    .u-bg-chip { background: var(--ax-bg-chip); }
    .u-bg-panel { background: var(--ax-bg-panel); }
    .u-border { border: 1px solid var(--ax-border); }
    .u-border-subtle { border: 1px solid var(--ax-border-subtle); }
    .u-border-t { border-top: 1px solid var(--ax-border-subtle); }
    .u-border-b { border-bottom: 1px solid var(--ax-border-subtle); }

    /* Sizing */
    .u-min-w-0 { min-width: 0; }
    .u-max-w-full { max-width: 100%; }
    .u-w-full { width: 100%; }
    .u-h-full { height: 100%; }

    /* Overflow */
    .u-overflow-hidden { overflow: hidden; }
    .u-overflow-auto { overflow: auto; }
    .u-overflow-y-auto { overflow-y: auto; }
    .u-overflow-x-auto { overflow-x: auto; }

    /* Cursor */
    .u-cursor-pointer { cursor: pointer; }
    .u-cursor-default { cursor: default; }
    .u-cursor-not-allowed { cursor: not-allowed; }

    /* State */
    .is-disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .is-hidden { display: none !important; }
  `;

export const axPresetsCss = `
    /* Typography presets */
    .az-typo-panel-title {
      margin: 0 0 4px 0;
      font-size: var(--ax-fs-xl);
      font-weight: var(--ax-fw-bold);
      color: var(--ax-fg);
      letter-spacing: -0.2px;
    }
    .az-typo-panel-desc {
      font-size: var(--ax-fs-sm);
      color: var(--ax-fg-2);
      margin-bottom: 8px;
    }
    .az-typo-metric-label {
      font-size: var(--ax-fs-xs);
      font-weight: var(--ax-fw-bold);
      color: var(--ax-fg-2);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .az-typo-metric-value {
      font-size: var(--ax-fs-sm);
      font-weight: var(--ax-fw-semibold);
      color: var(--ax-fg);
      font-variant-numeric: tabular-nums lining-nums;
    }
    .az-typo-body-text {
      font-size: var(--ax-fs-md);
      color: var(--ax-fg-2);
      line-height: 1.4;
    }
    .az-typo-caption {
      font-size: var(--ax-fs-xs);
      color: var(--ax-fg-2);
    }
    .az-typo-page-title {
      font-size: var(--ax-fs-3xl);
      font-weight: var(--ax-fw-semibold);
      color: var(--ax-fg);
      margin: 0 0 16px 0;
    }
    .az-typo-heading {
      font-size: var(--ax-fs-lg);
      font-weight: var(--ax-fw-bold);
      color: var(--ax-fg);
      line-height: 1.3;
    }
    .az-typo-mono {
      font-size: var(--ax-fs-md);
      font-weight: var(--ax-fw-semibold);
      color: var(--ax-fg);
      font-family: var(--ax-font-mono);
      font-variant-numeric: tabular-nums lining-nums;
    }

    /* Glass tier-2 surfaces */
    .az-preset-panel,
    .az-preset-card,
    .az-preset-collapsible-card {
      background: var(--ax-glass-2-bg);
      border: 1px solid var(--ax-glass-2-border);
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
    }
    .az-preset-panel { border-radius: var(--ax-radius-xl); padding: 20px; }
    .az-preset-card { border-radius: var(--ax-radius-lg); padding: 16px; }
    .az-preset-collapsible-card { border-radius: var(--ax-radius-lg); overflow: hidden; }

    /* Tier-1 chips / tiles */
    .az-preset-metric-cell,
    .az-preset-metric-cell-inline {
      background: var(--ax-glass-1-bg);
      border: 1px solid var(--ax-glass-1-border);
      box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);
      border-radius: var(--ax-radius-sm);
      display: flex;
    }
    .az-preset-metric-cell { padding: 5px 7px; flex-direction: column; gap: 1px; }
    .az-preset-metric-cell-inline { padding: 4px 8px; gap: 4px; align-items: center; }

    /* Tables */
    .az-preset-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: var(--ax-radius-md);
      overflow: hidden;
      border: 1px solid var(--ax-border);
      background: var(--ax-bg-table);
    }
    .az-preset-table-header {
      text-align: left;
      padding: 8px 10px;
      font-size: var(--ax-fs-sm);
      font-weight: var(--ax-fw-semibold);
      color: var(--ax-table-head);
      letter-spacing: 0.2px;
      border-bottom: 1px solid var(--ax-border-subtle);
      background: var(--ax-bg-table-head);
    }
    .az-preset-table-cell {
      padding: 7px 10px;
      font-size: var(--ax-fs-md);
      color: var(--ax-fg);
      font-variant-numeric: tabular-nums lining-nums;
    }
  `;

export const axAnimationsCss = `
    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes slideIn {
      0% { transform: translateY(20px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes iosBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.3); }
    }
    @keyframes pulseIndicator {
      from { transform: translateX(-50%) scale(0.8); opacity: 0.7; }
      to { transform: translateX(-50%) scale(1.2); opacity: 1; }
    }
    @keyframes dockStreamerFlash {
      0% { background-color: var(--ax-orange); }
      100% { background-color: var(--dock-streamer-target, var(--ax-gray)); }
    }
    .ios-sort-animation { animation: iosBounce 0.3s ease; }

    @keyframes flashUpdateGreen {
      0% { background-color: rgba(70, 210, 70, 0); }
      12% { background-color: rgba(70, 210, 70, 0.16); }
      100% { background-color: rgba(70, 210, 70, 0); }
    }
    @keyframes flashUpdateRed {
      0% { background-color: rgba(217, 70, 70, 0); }
      12% { background-color: rgba(217, 70, 70, 0.16); }
      100% { background-color: rgba(217, 70, 70, 0); }
    }
    @keyframes flashUpdateGreenDark {
      0% { background-color: rgba(80, 220, 100, 0); }
      12% { background-color: rgba(80, 220, 100, 0.22); }
      100% { background-color: rgba(80, 220, 100, 0); }
    }
    @keyframes flashUpdateRedDark {
      0% { background-color: rgba(232, 90, 80, 0); }
      12% { background-color: rgba(232, 90, 80, 0.24); }
      100% { background-color: rgba(232, 90, 80, 0); }
    }
    .flash-update-green { animation: flashUpdateGreen 0.6s ease; }
    .flash-update-red { animation: flashUpdateRed 0.6s ease; }
    body.theme-dark .flash-update-green { animation: flashUpdateGreenDark 0.6s ease; }
    body.theme-dark .flash-update-red { animation: flashUpdateRedDark 0.6s ease; }

    /* ─── Status-dot breath pulse (used by .ax-status-dot--live / --alert) ───
       Mirrors recorder.user.js's aq-pulse: a 1.8s ease-in-out double box-shadow
       expansion that reads as a heartbeat. Tone-matched in both light and
       dark via the --ax-tone-*-border vars. */
    @keyframes axStatusPulse {
      0%, 100% {
        box-shadow:
          0 0 6px color-mix(in srgb, currentColor 60%, transparent);
      }
      50% {
        box-shadow:
          0 0 12px color-mix(in srgb, currentColor 100%, transparent),
          0 0 18px color-mix(in srgb, currentColor 40%, transparent);
      }
    }
    @keyframes axRimSweep {
      0%, 100% { --ax-lg-mx: 0; --ax-lg-mx-abs: 0; --ax-lg-my: 0; }
      25%      { --ax-lg-mx: 28; --ax-lg-mx-abs: 28; --ax-lg-my: -18; }
      50%      { --ax-lg-mx: 0;  --ax-lg-mx-abs: 0;  --ax-lg-my: 18; }
      75%      { --ax-lg-mx: -28; --ax-lg-mx-abs: 28; --ax-lg-my: -10; }
    }
  `;
