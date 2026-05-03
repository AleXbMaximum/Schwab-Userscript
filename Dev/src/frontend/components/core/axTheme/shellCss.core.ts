// Core shell CSS: dock, header skeleton, settings button.
export const axShellCssCore = `
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
`;
