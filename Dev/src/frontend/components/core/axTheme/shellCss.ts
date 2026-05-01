// App-shell CSS — dock, header, nav, mobile, tables, buttons, badges, notifications.
// Theme-aware: every value reads from --ax-* CSS vars.
// Replaces the hand-coded legacy styles in the original ui_styles.ts.

export const axShellCss = `
    body { background: var(--ax-app-scenery); }
    body.theme-dark {
      background: var(--ax-app-scenery) !important;
      color-scheme: dark;
    }
    html:has(body.theme-dark) {
      background-color: var(--ax-bg) !important;
      color-scheme: dark;
    }

    /* ════════════════════════════════════════════════════════════════════════
       Host-page dark-mode hijack (Dark Reader–style filter inversion).

       In dark mode the underlying Schwab page stays white-themed, which then
       bleeds through translucent glass tiers in the dock and floating
       panels. Filter-inverting Schwab's body children (header, layout,
       footer, custom-element widgets like quick-quote / responsive-meganav)
       turns their bright surfaces into a dark, tone-matched backdrop while
       keeping the content readable.

       AlexQuant overlays are excluded so they render with their native dark
       palette. The exclusion list covers: the dock (#alexquant-container),
       any id-prefixed overlay (#alexquant-*), the tooltip host
       (alexquant-tip), the notification stack, mobile UI surfaces, and any
       element explicitly tagged with .ax-shell-element (snapshot tab/panel,
       AlertPanel, modal overlays).

       Re-invert images / video / iframes / canvases inside Schwab content so
       logos, photos, and embedded graphics keep their original colours.
       ════════════════════════════════════════════════════════════════════════ */

    body.theme-dark.ax-host-hijack > *:not(#alexquant-container):not([id^="alexquant-"]):not(alexquant-tip):not(.ax-shell-element):not(.dock-notification-container):not(.mobile-tab-bar):not(.mobile-more-sheet):not(.mobile-more-backdrop):not(script):not(style):not(link):not(noscript):not(template):not(meta) {
      filter: invert(0.93) hue-rotate(180deg);
      transition: filter 0.3s ease;
    }
    body.theme-dark.ax-host-hijack > *:not(#alexquant-container):not([id^="alexquant-"]):not(alexquant-tip):not(.ax-shell-element):not(.dock-notification-container) img,
    body.theme-dark.ax-host-hijack > *:not(#alexquant-container):not([id^="alexquant-"]):not(alexquant-tip):not(.ax-shell-element):not(.dock-notification-container) video,
    body.theme-dark.ax-host-hijack > *:not(#alexquant-container):not([id^="alexquant-"]):not(alexquant-tip):not(.ax-shell-element):not(.dock-notification-container) iframe,
    body.theme-dark.ax-host-hijack > *:not(#alexquant-container):not([id^="alexquant-"]):not(alexquant-tip):not(.ax-shell-element):not(.dock-notification-container) canvas {
      filter: invert(1) hue-rotate(180deg);
    }
    /* Don't double-invert AlexQuant assistant button or any element that
       explicitly opts out via a class. */
    body.theme-dark .ax-no-invert,
    body.theme-dark .ax-no-invert * {
      filter: none !important;
    }

    .dock-container {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 80vw;
      height: 100vh;
      max-height: 100vh;
      background: var(--ax-glass-3-bg);
      -webkit-backdrop-filter: blur(var(--ax-glass-3-blur)) saturate(var(--ax-glass-3-saturate)) brightness(var(--ax-glass-3-brightness));
      backdrop-filter: blur(var(--ax-glass-3-blur)) saturate(var(--ax-glass-3-saturate)) brightness(var(--ax-glass-3-brightness));
      border-radius: 0;
      z-index: var(--ax-z-dock);
      font-family: var(--ax-font-body);
      box-shadow: var(--ax-glass-3-shadow), var(--ax-glass-3-edge);
      color: var(--ax-fg);
      overflow: hidden;
      border: none;
      transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                  height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                  opacity 0.3s ease,
                  transform 0.3s ease,
                  box-shadow 0.3s ease;
    }
    /* Auto-attached by startGlobalRimObserver — adds the mouse-tracked rim
       and the right-edge separator that gives the dock its "floating slab"
       feel against Schwab's filter-inverted backdrop. */
    .dock-container.ax-glass-rim::before,
    .dock-container.ax-glass-rim::after {
      border-radius: 0;
    }

    .liquid-glass {
      position: relative;
      background: var(--ax-glass-2-bg);
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      border: 1px solid var(--ax-glass-2-border);
      border-radius: var(--ax-radius-2xl);
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
      overflow: hidden;
      transition: box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
                  transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .liquid-glass.no-highlight::before { display: none; }

    .dock-modal {
      --modal-tabs-height: 44px;
    }
    .dock-modal .ios-table {
      background: var(--ax-bg-table);
      border-color: var(--ax-border-subtle);
      margin-top: 0;
      transform: translateY(0);
    }
    .dock-modal .ios-table tr:nth-child(even){
      background-color: var(--ax-bg-row-hover);
    }
    .dock-modal .ios-table-head {
      top: 0;
      z-index: var(--ax-z-table-sticky-header);
    }

    .dock-minimized {
      width: 200px !important;
      height: 75px !important;
      transform: scale(0.98);
      box-shadow: var(--ax-shadow-md);
    }
    .dock-expanded {
      width: 82vw;
      height: 100% !important;
      border-radius: 0;
      transform: none;
      box-shadow: var(--ax-shadow-lg);
    }

    .dock-header {
      background-color: transparent;
      border-bottom: 1px solid var(--ax-border-subtle);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: grab;
      user-select: none;
    }
    .dock-title {
      font-size: 1.4rem;
      font-weight: var(--ax-fw-semibold);
      background: var(--ax-title-gradient);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      letter-spacing: -0.5px;
      flex-shrink: 0;
    }

    .dock-header-center {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1 1 0%;
      min-width: 0;
      overflow: hidden;
      justify-content: center;
    }
    .dock-totals {
      display: flex;
      gap: 16px;
      font-size: var(--ax-fs-md);
      color: var(--ax-fg);
    }
    .dock-indices {
      display: flex;
      gap: 16px;
      font-size: var(--ax-fs-md);
      color: var(--ax-fg);
      align-items: center;
    }
    .dock-nav-sep,
    .dock-center-sep {
      width: 1px;
      height: 24px;
      border-left: 1px dashed var(--ax-border-strong);
      flex-shrink: 0;
    }

    .dock-status-container {
      display: flex;
      gap: 16px;
      flex-shrink: 0;
    }
    .dock-status-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .dock-status-label {
      font-size: var(--ax-fs-md);
      color: var(--ax-fg);
    }
    .dock-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ax-fg-muted);
      transition: background 220ms cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
    }
    /* "streamer-on" rides the same breath pulse as .ax-status-dot--live so
       the dock's "live data" indicator and floating panel dots tell the
       same story visually. "currentColor" is set so axStatusPulse's
       color-mix() picks up the green glow automatically. */
    .dock-status-dot--streamer-on {
      --dock-streamer-target: var(--ax-green);
      background: var(--ax-green);
      color: var(--ax-green);
      box-shadow: 0 0 6px color-mix(in srgb, var(--ax-green) 60%, transparent);
      animation: axStatusPulse 1.8s ease-in-out infinite;
    }
    .dock-status-dot--streamer-off {
      --dock-streamer-target: var(--ax-gray);
      background: var(--ax-gray);
      box-shadow: none;
      animation: none;
    }
    .dock-status-dot--streamer-flash {
      animation: dockStreamerFlash 0.2s ease;
    }
    .dock-snapshot-area {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    /* Minimized state */
    .dock-minimized .dock-header > *:not(.dock-title):not(.dock-toggle-btn):not(.dock-share-btn) {
      display: none !important;
    }
    .dock-minimized .dock-toggle-btn { margin-left: auto; }
    .dock-minimized .dock-settings-wrapper { display: none !important; }

    /* Settings button + dropdown */
    .dock-settings-wrapper {
      position: relative;
      flex-shrink: 0;
    }
    .dock-settings-btn {
      position: relative;
      font-size: 1.2rem;
      border: 1px solid var(--ax-glass-2-border);
      border-radius: var(--ax-radius-xl);
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      background: var(--ax-glass-2-bg);
      color: var(--ax-fg);
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      transition: all 0.2s ease;
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
    }
    .dock-settings-btn:hover {
      transform: translateY(-1px);
      box-shadow: var(--ax-shadow-md);
    }
    .dock-settings-badge {
      display: none;
      position: absolute;
      top: -4px;
      right: -4px;
      align-items: center;
      justify-content: center;
      font-size: var(--ax-fs-2xs);
      font-weight: var(--ax-fw-bold);
      padding: 1px 4px;
      border-radius: var(--ax-radius-sm);
      line-height: 1.3;
      white-space: nowrap;
      pointer-events: none;
    }
    .dock-settings-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 240px;
      background: var(--ax-bg-card);
      color: var(--ax-fg);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--ax-border);
      border-radius: var(--ax-radius-xl);
      box-shadow: var(--ax-shadow-md);
      padding: 12px;
      z-index: var(--ax-z-nav-dropdown);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-4px) scale(0.97);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .dock-settings-wrapper.open .dock-settings-panel {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .dock-settings-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dock-settings-row + .dock-settings-row {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--ax-border-subtle);
    }
    .dock-settings-label {
      font-size: var(--ax-fs-md);
      font-weight: var(--ax-fw-semibold);
      color: var(--ax-fg-2);
      letter-spacing: 0.3px;
    }
    .dock-settings-options {
      display: flex;
      gap: 4px;
    }
    .dock-settings-opt {
      flex: 1;
      padding: 6px 4px;
      border: 1px solid var(--ax-border);
      border-radius: var(--ax-radius-md);
      background: transparent;
      font-size: var(--ax-fs-md);
      font-weight: var(--ax-fw-semibold);
      color: var(--ax-fg-2);
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: var(--ax-font-body);
    }
    .dock-settings-opt:hover {
      background: var(--ax-tone-info-soft-bg);
      border-color: var(--ax-tone-info-border);
    }
    .dock-settings-opt.active {
      background: var(--ax-tone-info-bg);
      border-color: var(--ax-blue);
      color: var(--ax-blue);
    }

    .dock-minimized .dock-content { display: none !important; }

    /* Nav */
    .dock-nav {
      display: flex;
      gap: 12px;
      background: transparent;
      border-radius: var(--ax-radius-xl);
      padding: 6px;
      flex-shrink: 0;
    }
    .dock-nav-button {
      position: relative;
      cursor: pointer;
      font-size: var(--ax-fs-xl);
      padding: 8px 16px;
      border: 1px solid transparent;
      background: transparent;
      border-radius: var(--ax-radius-lg);
      transition: all 0.2s ease;
      color: var(--ax-fg-2);
      font-weight: var(--ax-fw-semibold);
      box-shadow: none;
    }
    .dock-nav-button:hover { transform: translateY(-1px); }

    .offer-tab-container {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
      width: 100%;
    }
    .dock-tab {
      padding: 14px;
      border: none;
      border-radius: var(--ax-radius-md);
      background: transparent;
      color: var(--ax-fg-2);
      font-weight: var(--ax-fw-medium);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .dock-tab.active {
      background-color: var(--ax-blue);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(10, 132, 255, 0.25);
    }

    .redeemed-stats-row,
    .stats-row {
      display: flex;
      gap: 8px;
      width: 100%;
      flex-wrap: wrap;
      align-items: stretch;
    }

    .dock-nav-button.active {
      font-weight: var(--ax-fw-heavy);
      background-color: var(--ax-blue);
      color: #ffffff;
      box-shadow:
        0 4px 14px color-mix(in srgb, var(--ax-blue) 38%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.25);
      border-color: rgba(255,255,255,0.30);
    }
    .dock-nav-button.active::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      background-color: var(--ax-blue);
      border-radius: 50%;
      box-shadow: 0 0 8px color-mix(in srgb, var(--ax-blue) 60%, transparent);
      animation: pulseIndicator 1.5s infinite alternate;
    }

    .dock-nav-group { position: relative; }
    .dock-nav-group-btn {
      position: relative;
      cursor: pointer;
      font-size: var(--ax-fs-xl);
      padding: 8px 16px;
      border: 1px solid transparent;
      background: transparent;
      border-radius: var(--ax-radius-lg);
      transition: all 0.2s ease;
      color: var(--ax-fg-2);
      font-weight: var(--ax-fw-semibold);
      box-shadow: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dock-nav-group-btn:hover { transform: translateY(-1px); }
    .dock-nav-group-btn .nav-caret {
      font-size: var(--ax-fs-xs);
      transition: transform 0.2s ease;
    }
    .dock-nav-group.open .nav-caret { transform: rotate(180deg); }
    .dock-nav-group-btn.active {
      font-weight: var(--ax-fw-heavy);
      background-color: var(--ax-blue);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(10, 132, 255, 0.30);
      border-color: rgba(255,255,255,0.25);
    }
    .dock-nav-group-btn.active .nav-caret { color: #ffffff; }

    .dock-nav-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%) scale(0.95);
      opacity: 0;
      pointer-events: none;
      min-width: 160px;
      background: var(--ax-bg-card);
      color: var(--ax-fg);
      border: 1px solid var(--ax-border);
      border-radius: var(--ax-radius-xl);
      box-shadow: var(--ax-shadow-md);
      padding: 6px;
      z-index: var(--ax-z-nav-dropdown);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .dock-nav-group.open .dock-nav-dropdown {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) scale(1);
    }
    .dock-nav-dropdown-item {
      display: block;
      width: 100%;
      padding: 8px 14px;
      border: none;
      background: transparent;
      border-radius: var(--ax-radius-md);
      font-size: var(--ax-fs-menu);
      font-weight: var(--ax-fw-medium);
      color: var(--ax-fg-2);
      cursor: pointer;
      text-align: left;
      transition: background 0.15s ease;
    }
    .dock-nav-dropdown-item:hover {
      background: var(--ax-tone-info-soft-bg);
      color: var(--ax-blue);
    }
    .dock-nav-dropdown-item.active {
      background: var(--ax-tone-info-bg);
      color: var(--ax-blue);
      font-weight: var(--ax-fw-bold);
    }

    .dock-toggle-btn {
      font-size: 1.2rem;
      border: 1px solid var(--ax-glass-2-border);
      border-radius: var(--ax-radius-xl);
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      background: var(--ax-glass-2-bg);
      color: var(--ax-fg);
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      transition: all 0.2s ease;
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
    }
    .dock-toggle-btn:hover {
      transform: translateY(-1px);
      box-shadow: var(--ax-shadow-md);
    }

    .dock-content {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(100vh - 80px);
      height: calc(100vh - 80px);
      color: var(--ax-fg);
    }

    /* iOS Tables */
    .ios-table {
      width: max-content;
      min-width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      font-family: var(--ax-font-body);
      border-radius: var(--ax-radius-md);
      overflow: hidden;
      background: var(--ax-bg-table);
      color: var(--ax-fg);
      box-shadow: var(--ax-glass-1-shadow);
      border: 1px solid var(--ax-border);
    }
    .ios-table-head {
      background: var(--ax-bg-table-head);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: var(--ax-z-table-header);
      box-shadow: inset 0 -1px 0 var(--ax-border-subtle);
    }
    .ios-table th {
      padding: var(--ios-table-cell-padding);
      font-weight: var(--ax-fw-semibold);
      font-family: var(--ax-font-body);
      font-size: var(--ax-fs-2xs);
      color: var(--ax-table-head);
      border-bottom: 1px solid var(--ax-border-subtle);
      text-align: center;
      vertical-align: middle;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: var(--ax-bg-table-head);
    }
    .ios-table-header-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .ios-table-header-label {
      display: inline-block;
      margin-left: 6px;
    }
    .ios-table th.sortable {
      cursor: pointer;
      position: relative;
      padding-left: 28px;
      padding-right: 28px;
    }
    .ios-sort-button {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    }
    .ios-sort-button:hover { opacity: 1; }
    .ios-sort-indicator { display: inline-flex; line-height: 0; }

    .ios-table tr { transition: background-color 0.2s ease; }
    /* Recorder uses an alpha 0.018 stripe — almost invisible, but enough
       to give long tables a calm rhythm without the harsh banding the
       previous --ax-bg-subtle gave. Pure-white backgrounds in light mode
       fall through to the soft chrome below. */
    body.theme-dark .ios-table tr:nth-child(even) td {
      background-color: rgba(255,255,255,0.018);
    }
    body:not(.theme-dark) .ios-table tr:nth-child(even) td {
      background-color: rgba(15,30,60,0.018);
    }
    .group-summary-row td { background-color: var(--ax-bg-group); }
    .ios-table tr:hover { background-color: var(--ax-bg-row-hover); }
    .ios-table td {
      padding: var(--ios-table-cell-padding);
      color: var(--ax-fg);
      border-bottom: 1px solid var(--ax-border-subtle);
      vertical-align: middle;
      font-variant-numeric: tabular-nums lining-nums;
    }

    .ios-status {
      display: inline-block;
      padding: 5px 10px;
      border-radius: var(--ax-radius-pill);
      font-size: var(--ax-fs-lg);
      font-weight: var(--ax-fw-medium);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .ios-status.active, .ios-status.success {
      background-color: var(--ax-tone-positive-bg);
      color: var(--ax-positive);
      border: 1px solid var(--ax-tone-positive-border);
    }
    .ios-status.pending {
      background-color: var(--ax-tone-neutral-bg);
      color: var(--ax-orange);
      border: 1px solid var(--ax-tone-neutral-border);
    }
    .ios-status.inactive, .ios-status.failed, .ios-status.canceled {
      background-color: var(--ax-tone-negative-bg);
      color: var(--ax-negative);
      border: 1px solid var(--ax-tone-negative-border);
    }

    .ios-empty-state {
      padding: var(--ios-empty-padding);
      text-align: center;
      color: var(--ax-fg-2);
    }

    /* Search */
    .ios-search-container {
      position: relative;
      box-sizing: border-box;
      width: 220px;
      box-shadow: var(--ax-glass-1-shadow);
      border-radius: var(--ax-radius-xl);
      border: 1px solid var(--ax-border);
      background: var(--ax-bg-input);
      color: var(--ax-fg);
      -webkit-backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate));
      backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate));
    }
    .ios-search-input {
      width: 100%;
      padding: 10px 32px 10px 12px;
      border-radius: var(--ax-radius-xl);
      border: 1px solid transparent;
      background: transparent;
      font-size: var(--ax-fs-menu);
      font-family: var(--ax-font-body);
      color: var(--ax-fg);
    }
    .ios-search-input:focus {
      outline: none;
      border-color: var(--ax-blue);
      box-shadow: 0 0 0 2px rgba(10, 132, 255, 0.10);
    }
    .ios-search-icon {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--ax-fg-muted);
      transition: color .3s ease;
    }
    .ios-search-clear {
      position: absolute;
      right: 30px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--ax-fg-muted);
      display: none;
      padding: 4px;
    }
    .ios-search-container:focus-within {
      box-shadow: 0 0 0 2px rgba(10, 132, 255, 0.10);
    }

    .ios-highlight-row {
      border-left: 3px solid var(--ax-yellow);
      background: var(--ax-bg-highlight);
    }
    .ios-match-enrolled {
      background-color: var(--ax-tone-positive-bg) !important;
      border-left: 3px solid var(--ax-positive) !important;
    }
    .ios-match-eligible {
      background-color: var(--ax-tone-info-bg) !important;
      border-left: 3px solid var(--ax-blue) !important;
    }

    /* Action chip */
    .action-chip {
      display: inline-flex; align-items: center; justify-content: center;
      height: 28px; min-width: 78px; padding: 0 10px; border-radius: 9999px;
      font: 600 12.5px/28px var(--ax-font-body);
      border: 1px solid transparent; box-shadow: var(--ax-glass-1-shadow);
      transition: background .15s ease, transform .15s ease, border-color .15s ease;
    }
    .action-chip--enroll {
      background: var(--ax-tone-info-bg);
      border-color: var(--ax-tone-info-border);
      color: var(--ax-blue);
      cursor: pointer;
    }
    .action-chip--enroll:hover { background: var(--ax-tone-info-soft-bg); filter: brightness(1.05); }
    .action-chip--enroll:active { transform: translateY(1px); }
    .action-chip--enroll:focus-visible { outline: 2px solid rgba(10,132,255,0.35); outline-offset: 2px; }
    .action-chip--enrolled {
      background: var(--ax-tone-positive-bg);
      border-color: var(--ax-tone-positive-border);
      color: var(--ax-positive);
      cursor: pointer;
    }
    .action-chip--enrolled:hover { filter: brightness(1.05); }
    .action-chip--enrolled:active { transform: translateY(1px); }
    .action-chip--enrolled:focus-visible {
      outline: 2px solid var(--ax-tone-positive-border); outline-offset: 2px;
    }

    @media (max-width: 768px) {
      .dock-container { width: 95%; left: 2.5%; }
      .summary-header,
      .button-container { flex-direction: column; align-items: stretch; }
      .chart-grid-responsive { grid-template-columns: 1fr !important; }
    }

    .dock-container .ios-table {
      background: var(--ax-bg-table);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    .dock-container .ios-table-head {
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: inset 0 -1px 0 var(--ax-border-subtle);
    }

    button:focus-visible, .ios-table th.sortable:focus-visible {
      outline: 2px solid rgba(10, 132, 255, 0.35);
      outline-offset: 2px;
      border-radius: var(--ax-radius-lg);
    }

    .hidden { display: none !important; }
    .text-muted { color: var(--ax-fg-muted); opacity: 0.85; }

    /* Buttons (.btn family) */
    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: var(--ax-radius-lg);
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, background .15s ease, color .15s ease, filter .15s ease;
      font-weight: var(--ax-fw-semibold);
      font-family: var(--ax-font-body);
    }
    .btn--sm { padding: 6px 12px; font-size: var(--ax-fs-lg); }
    .btn--md { padding: 10px 16px; font-size: var(--ax-fs-menu); }
    .btn--lg { padding: 12px 24px; font-size: var(--ax-fs-2xl); }
    .btn--full { width: 100%; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn--primary {
      background: var(--ax-blue);
      color: #ffffff;
      border-color: var(--ax-blue);
      box-shadow: 0 1px 3px rgba(10, 132, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.22);
    }
    .btn--primary:hover:not(:disabled) { filter: brightness(1.06); }
    .btn--secondary {
      background: var(--ax-bg-glass-inset);
      color: var(--ax-fg);
      border-color: var(--ax-border);
      box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);
    }
    .btn--secondary:hover:not(:disabled) { background: var(--ax-bg-row-hover); }
    .btn--danger {
      background: var(--ax-red);
      color: #ffffff;
      border-color: var(--ax-red);
      box-shadow: 0 1px 3px rgba(215, 49, 38, 0.30), inset 0 1px 0 rgba(255,255,255,0.22);
    }
    .btn--danger:hover:not(:disabled) { filter: brightness(1.06); }
    .btn--success {
      background: var(--ax-green);
      color: #ffffff;
      border-color: var(--ax-green);
      box-shadow: 0 1px 3px rgba(52, 199, 89, 0.30), inset 0 1px 0 rgba(255,255,255,0.22);
    }
    .btn--success:hover:not(:disabled) { filter: brightness(1.06); }
    .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--ax-shadow-md); }
    .btn:active:not(:disabled) { transform: translateY(0); box-shadow: var(--ax-shadow-sm); }

    .fav-toggle {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 4px;
      border-radius: var(--ax-radius-md);
      color: var(--ax-fg-muted);
    }
    .fav-toggle:hover {
      transform: none;
      background: var(--ax-bg-row-hover);
    }
    .fav-toggle:focus-visible {
      outline: 2px solid rgba(10,132,255,0.35);
      outline-offset: 2px;
    }

    /* Badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: var(--ax-radius-md);
      border: 1px solid currentColor;
      background: var(--ax-glass-1-bg);
      -webkit-backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate));
      backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate));
      transition: transform .15s ease, box-shadow .15s ease;
    }
    .badge--sm { padding: 3px 6px; font-size: var(--ax-fs-sm); border-radius: var(--ax-radius-sm); }
    .badge--md { padding: 4px 8px; font-size: var(--ax-fs-md); border-radius: var(--ax-radius-md); }
    .badge--lg { padding: 5px 10px; font-size: var(--ax-fs-lg); border-radius: var(--ax-radius-md); }
    .badge:hover { transform: translateY(-2px); box-shadow: var(--ax-shadow-sm); }

    /* Notifications */
    .dock-notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: var(--ax-z-notification);
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: 360px;
    }
    /* Notification card — glass tier-2 + tone-tinted bg + tinted left bar.
       Replaces the previous opaque solid-color block; this lets the dock's
       blurred background show through and matches recorder.user.js's
       layered approach to alerts. */
    .dock-notification {
      pointer-events: auto;
      padding: 11px 14px 11px 16px;
      border-radius: var(--ax-radius-lg);
      background: var(--ax-glass-2-bg);
      border: 1px solid var(--ax-glass-2-border);
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));
      color: var(--ax-fg);
      font-size: var(--ax-fs-menu);
      font-weight: var(--ax-fw-medium);
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
      overflow: hidden;
      opacity: 0;
      transform: translateX(100px);
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .dock-notification::before {
      content: "";
      position: absolute;
      top: 0; bottom: 0; left: 0;
      width: 3px;
      background: currentColor;
    }
    .dock-notification.show { opacity: 1; transform: translateX(0); }
    .dock-notification.removing { opacity: 0; transform: translateX(100px); pointer-events: none; }
    .dock-notification.info {
      color: var(--ax-blue);
      background:
        linear-gradient(180deg,
          color-mix(in srgb, var(--ax-blue) 14%, transparent),
          color-mix(in srgb, var(--ax-blue) 6%, transparent)),
        var(--ax-glass-2-bg);
    }
    .dock-notification.success {
      color: var(--ax-positive);
      background:
        linear-gradient(180deg,
          color-mix(in srgb, var(--ax-positive) 14%, transparent),
          color-mix(in srgb, var(--ax-positive) 6%, transparent)),
        var(--ax-glass-2-bg);
    }
    .dock-notification.error {
      color: var(--ax-critical);
      background:
        linear-gradient(180deg,
          color-mix(in srgb, var(--ax-critical) 16%, transparent),
          color-mix(in srgb, var(--ax-critical) 7%, transparent)),
        var(--ax-glass-2-bg);
    }
    .dock-notification.warning {
      color: var(--ax-orange);
      background:
        linear-gradient(180deg,
          color-mix(in srgb, var(--ax-orange) 14%, transparent),
          color-mix(in srgb, var(--ax-orange) 6%, transparent)),
        var(--ax-glass-2-bg);
    }
    /* The accent currentColor on .dock-notification.{info,success,error,warning}
       drives the ::before bar; the message text and close button explicitly
       reset to neutral foreground so they stay readable on the tinted glass
       background. .icon / .accent children opt into the accent by re-asserting
       currentColor to override this normalization. */
    .dock-notification > :not(.close):not(.icon):not(.accent) { color: var(--ax-fg); }
    .dock-notification > .icon,
    .dock-notification > .accent { color: currentColor; flex-shrink: 0; }
    .dock-notification .close {
      background: none;
      border: none;
      color: var(--ax-fg-2);
      font-size: 18px;
      cursor: pointer;
      padding: 0 0 0 8px;
      margin-left: auto;
      opacity: 0.7;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, color 0.2s;
    }
    .dock-notification .close:hover { opacity: 1; }
    .dock-notification:hover { box-shadow: var(--ax-shadow-lg); }

    /* Refresh dropdown */
    .refresh-dropdown-container {
      position: relative;
      display: flex;
      align-items: center;
      margin-right: 12px;
    }
    .refresh-brand-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
      color: #fff;
      font-size: var(--ax-fs-xs);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-weight: var(--ax-fw-semibold);
    }
    .refresh-brand-logo svg { width: 16px; height: 16px; display: block; }
    .refresh-dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      background: var(--ax-bg-card);
      color: var(--ax-fg);
      border: 1px solid var(--ax-border);
      border-radius: var(--ax-radius-xl);
      box-shadow: var(--ax-shadow-md);
      z-index: var(--ax-z-nav-dropdown);
      min-width: 180px;
      display: none;
      margin-top: 8px;
      padding: 6px;
      overflow: hidden;
    }
    .refresh-dropdown-container.open .refresh-dropdown-menu { display: block; }
    .refresh-dropdown-item {
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: var(--ax-fs-menu);
      color: var(--ax-fg);
      border-radius: var(--ax-radius-md);
      margin: 2px;
      transition: background-color .15s ease, color .15s ease;
      background: transparent;
      font-weight: var(--ax-fw-semibold);
      gap: 8px;
    }
    .refresh-dropdown-item:hover { background-color: var(--ax-bg-row-hover); }

    .dock-modal .modal-header {
      background: var(--ax-bg-table-head);
      box-shadow: inset 0 -1px 0 var(--ax-border-subtle);
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: .001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .001ms !important;
      }
    }

    /* Responsive header priority */
    .cw-lte-1500 .dock-status-container { display: none !important; }
    .cw-lte-1300 .dock-indices [data-index-symbol="$RUT"] { display: none !important; }
    .cw-lte-1200 .dock-indices [data-index-symbol="$DJI"] { display: none !important; }
    .cw-lte-1050 .dock-indices [data-index-symbol="$COMPX"] { display: none !important; }
    .cw-lte-950 .dock-indices { display: none !important; }
    .cw-lte-950 .dock-center-sep { display: none !important; }
    .cw-lte-820 .dock-totals-accval { display: none !important; }
    .cw-lte-640 .dock-totals { display: none !important; }
    .cw-lte-640 .dock-nav-sep { display: none !important; }
    .cw-lte-500 .dock-nav { display: none !important; }

    /* Mobile layout */
    .layout-mobile .dock-container {
      width: 100vw !important;
      height: 100vh !important;
      border-radius: 0;
      left: 0 !important;
      top: 0 !important;
    }
    .layout-mobile .dock-header {
      padding: 8px 16px;
      gap: 8px;
    }
    .layout-mobile .dock-content {
      padding: 8px 12px;
      max-height: calc(100vh - 48px - 56px - env(safe-area-inset-bottom, 0px));
      height: calc(100vh - 48px - 56px - env(safe-area-inset-bottom, 0px));
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    /* Mobile chrome (.mobile-tab-bar / .mobile-more-sheet) rides the same
       glass tokens as desktop floating panels — tier-2 bg + tier-2 shadow +
       saturate-145% blur — so the bottom tab bar feels physically connected
       to the dock above instead of being a flat strip. */
    .mobile-tab-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(56px + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      display: flex;
      justify-content: space-around;
      align-items: center;
      background: var(--ax-glass-2-bg);
      backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));
      border-top: 1px solid var(--ax-glass-2-border);
      box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);
      z-index: var(--ax-z-sticky-nav);
    }
    .mobile-tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      cursor: pointer;
      color: var(--ax-fg-2);
      font-size: var(--ax-fs-xs);
      font-weight: var(--ax-fw-medium);
      background: none;
      border: none;
      font-family: var(--ax-font-body);
      -webkit-tap-highlight-color: transparent;
    }
    .mobile-tab-item.active { color: var(--ax-blue); }
    .mobile-tab-item svg { width: 22px; height: 22px; }

    .mobile-more-sheet {
      position: fixed;
      bottom: calc(56px + env(safe-area-inset-bottom, 0px));
      left: 0;
      right: 0;
      background: var(--ax-glass-3-bg);
      backdrop-filter: blur(var(--ax-glass-3-blur)) saturate(var(--ax-glass-3-saturate)) brightness(var(--ax-glass-3-brightness));
      -webkit-backdrop-filter: blur(var(--ax-glass-3-blur)) saturate(var(--ax-glass-3-saturate)) brightness(var(--ax-glass-3-brightness));
      border-top: 1px solid var(--ax-glass-3-border);
      border-radius: var(--ax-radius-2xl) var(--ax-radius-2xl) 0 0;
      padding: 12px 0 4px;
      z-index: var(--ax-z-sticky-nav);
      box-shadow: var(--ax-glass-3-shadow), var(--ax-glass-3-edge);
    }
    .mobile-more-sheet-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      font-size: var(--ax-fs-xl);
      color: var(--ax-fg);
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      font-family: var(--ax-font-body);
      -webkit-tap-highlight-color: transparent;
    }
    .mobile-more-sheet-item:active { background: var(--ax-bg-row-hover); }
    .mobile-more-backdrop {
      position: fixed;
      inset: 0;
      background: var(--ax-modal-backdrop-light);
      z-index: calc(var(--ax-z-sticky-nav) - 1);
    }

    .layout-mobile .section-grid {
      grid-template-columns: 1fr !important;
      gap: 8px !important;
    }
    .layout-mobile .chart-grid-responsive {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
    .layout-mobile .opening-chart-grid {
      grid-template-columns: 1fr !important;
      gap: 8px !important;
    }
    .layout-mobile .alexquant-news-layout {
      grid-template-columns: 1fr !important;
    }
    .layout-mobile .ai-analysis-container {
      max-width: 100% !important;
      padding: 12px 14px !important;
    }
    .layout-mobile .page-header {
      padding: 10px 12px !important;
    }
    .layout-mobile .control-bar {
      flex-wrap: wrap;
      gap: 6px !important;
    }

    .table-scroll {
      overflow-x: auto;
      scrollbar-gutter: stable both-edges;
      padding-right: 14px;
    }
    .ios-table tbody tr:hover {
      background: var(--ax-bg-row-hover);
      box-shadow: inset 0 1px 0 var(--ax-border-subtle), inset 0 -1px 0 var(--ax-border-subtle);
    }
    .ios-table td { line-height: 1.2; padding-top: 6px; padding-bottom: 6px; }
    .ios-table th { line-height: 1.2; padding-top: 8px; padding-bottom: 8px; }
  `;
