// Components shell CSS: tables, search, buttons, badges.
export const axShellCssComponents = `
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
`;
