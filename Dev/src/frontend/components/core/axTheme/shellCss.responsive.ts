// Responsive + notifications shell CSS.
export const axShellCssResponsive = `
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
