import { injectStylesheet } from "./ui_builders";

export { addAnimationStyles, addGlobalStyle, applyColorTheme };

function addAnimationStyles() {
  injectStylesheet("dock-animation-styles", `
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
            0% { background-color: var(--ios-orange); }
            100% { background-color: var(--dock-streamer-target, var(--ios-gray)); }
        }
        
        .ios-sort-animation {
            animation: iosBounce 0.3s ease;
        }

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

        .flash-update-green {
            animation: flashUpdateGreen 0.6s ease;
        }

        .flash-update-red {
            animation: flashUpdateRed 0.6s ease;
        }
    `);
}

function addGlobalStyle() {
  const globalCSS = `
        :focus-visible {
            outline: 2px solid rgba(0,122,255,0.35);
            outline-offset: 2px;
            border-radius: 6px;
        }

        input:not([type=checkbox]):not([type=radio]):focus,
        select:focus,
        textarea:focus {
            border-color: var(--ios-blue) !important;
            box-shadow: 0 0 0 3px rgba(0,122,255,0.1);
            outline: none;
        }

        input:disabled, select:disabled, textarea:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    :root {
        --lg-alpha-1: .80;
        --lg-alpha-2: .65;
        --lg-saturate: 140%;
        --lg-blur: 16px;
        --lg-border: rgba(255,255,255,.22);
        --lg-shadow: 0 8px 24px rgba(12,38,73,.10);
        --lg-highlight-1: rgba(255,255,255,.55);
        --lg-highlight-2: rgba(255,255,255,.25);

        --ios-blue: #007AFF;
        --ios-dark-blue: #0062CC;
        --ios-green: rgb(32, 169, 69);
        --ios-orange: rgb(215, 129, 0);
        --ios-red: rgb(215, 49, 38);
        --ios-gray: rgb(142, 142, 147);

        --ios-background: rgba(255, 255, 255, 0.8);
        --ios-secondary-bg: rgba(249, 249, 251, 0.6);
        --ios-light-gray: rgba(142, 142, 147, 0.1);

        --ios-text-primary: #1c1c1e;
    --ios-text-secondary: #3a3a3c;

        --ios-border: rgba(230, 230, 230, 0.7);
        --ios-radius: 18px;
        --ios-table-border-radius: 8px;
        --ios-table-header: #1b5fa7;
        --ios-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

        --ios-title-gradient: linear-gradient(45deg, #4CAF50, #2196F3);
        --ios-button-gradient: linear-gradient(45deg, rgb(84,99,86), rgb(27,66,29));
        --ios-header-bg: linear-gradient(to right, rgba(245, 245, 247, 0.9), rgba(235, 235, 242, 0.85));

        --ios-shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.06);
        --ios-shadow-md: 0 5px 16px rgba(0, 0, 0, 0.1);
        --ios-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);

        --ios-anim-fast: 0.2s;
        --ios-anim-medium: 0.3s;
        --ios-anim-slow: 0.5s;

        --ios-status-active-bg: rgba(52, 199, 89, 0.15);
        --ios-status-pending-bg: rgba(215, 129, 0, 0.15);
        --ios-status-inactive-bg: rgba(255, 59, 48, 0.15);

    --ios-table-cell-padding: 6px 10px;
    --ios-table-row-hover: rgba(0, 0, 0, 0.04);
    --ios-table-header-font-size: 11px;
    --ios-table-cell-font-size: 12.5px;

        --ios-highlight-bg: rgba(255, 204, 0, 0.2);
        --ios-highlight-border: rgba(255, 204, 0, 0.8);
        --ios-highlight-hover: rgba(255, 204, 0, 0.25);

        --ios-empty-padding: 60px 20px;

        /* Layer scale (z-index) */
        --z-table-header: 10;
        --z-table-sticky-cell: 30;
        --z-table-sticky-header: 32;
        --z-sticky-nav: 100;
        --z-sticky-control: 110;
        --z-sticky-state: 120;
        --z-nav-dropdown: 200;
        --z-page-popover: 210;
        --z-alert: 100000;
        --z-notification: 100100;
        --z-dock: 100200;
        --z-floating-panel: 100300;
        --z-floating-toggle: 100400;
        --z-modal-backdrop: 100500;
        --z-modal-content: 100600;
        --z-tooltip: 100700;

    --glass-1-blur: 10px;
    --glass-1-saturate: 115%;
    --glass-1-bg: rgba(255,255,255,0.06);
    --glass-1-border: rgba(255,255,255,0.18);
    --glass-1-shadow: 0 8px 24px rgba(12,38,73,0.10);

    --glass-2-blur: 16px;
    --glass-2-saturate: 140%;
    --glass-2-bg-gradient: linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.10));
    --glass-2-border: rgba(255,255,255,0.24);
    --glass-2-shadow: 0 4px 12px rgba(0,0,0,0.08);

    --glass-3-blur: 20px;
    --glass-3-saturate: 140%;
    --glass-3-bg: rgba(255,255,255,0.28);
    --glass-3-inset-shadow: inset 0 1px 0 rgba(255,255,255,0.40);
    }

    .dock-container {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: 80vw;
        height: 100vh;
        max-height: 100vh;
        background: var(--glass-3-bg);
        -webkit-backdrop-filter: blur(var(--glass-3-blur)) saturate(var(--glass-3-saturate));
        backdrop-filter: blur(var(--glass-3-blur)) saturate(var(--glass-3-saturate));
        border-radius: 0;
        z-index: var(--z-dock, 100300);
        font-family: var(--ios-font);
        box-shadow: var(--ios-shadow), var(--glass-3-inset-shadow);
        overflow: hidden;
        border: none;
        transition: all 0.3s ease;
    }

    .liquid-glass {
        position: relative;
        background: var(--glass-2-bg-gradient);
        -webkit-backdrop-filter: blur(var(--glass-2-blur)) saturate(var(--glass-2-saturate));
        backdrop-filter: blur(var(--glass-2-blur)) saturate(var(--glass-2-saturate));
        border: 1px solid var(--glass-2-border);
        border-radius: var(--ios-radius);
        box-shadow: var(--glass-2-shadow);
        overflow: hidden;
    }

    .liquid-glass::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 55px;
        pointer-events: none;
        background: linear-gradient(180deg, var(--lg-highlight-1), var(--lg-highlight-2), transparent 70%);
    }

    .liquid-glass.no-highlight::before { display: none; }

    body.theme-dark .liquid-glass {
        background: linear-gradient(135deg, rgba(44,44,48,0.42), rgba(30,30,34,0.35));
        border-color: rgba(255,255,255,0.08);
        box-shadow: var(--lg-shadow-strong);
    }

    .dock-modal {
        --lg-alpha-1: 0.9;
        --lg-alpha-2: 0.85;
        --lg-blur: 10px;
        --modal-tabs-height: 44px;
    }
    .dock-modal .ios-table {
        background: #ffffff;
        border-color: rgba(0,0,0,0.08);
        margin-top: 0;
        transform: translateY(0);
    }
    .dock-modal .ios-table tr:nth-child(even){
        background-color: rgba(0,0,0,0.02);
    }
    .dock-modal .ios-table-head {
        top: 0;
        z-index: var(--z-table-sticky-header, 32);
    }

    .dock-minimized {
        width: 200px !important;
        height: 75px !important;
        transform: scale(0.98);
        box-shadow: 0 12px 18px rgba(0,0,0,0.20);
    }

    .dock-expanded {
        width: 82vw;
        height: 100% !important;
        border-radius: 0;
        transform: none;
        box-shadow: var(--ios-shadow);
    }

    .dock-header {
        background-color: transparent;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        cursor: grab;
        user-select: none;
    }

    .dock-title {
        font-size: 1.4rem;
        font-weight: 600;
        background: var(--ios-title-gradient);
        -webkit-background-clip: text;
        color: transparent;
        letter-spacing: -0.5px;
        flex-shrink: 0;
    }

    /* ── Header center data area (flex:1, wraps totals + indices) ── */
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
        font-size: 12px;
    }

    .dock-indices {
        display: flex;
        gap: 16px;
        font-size: 12px;
        align-items: center;
    }

    .dock-nav-sep,
    .dock-center-sep {
        width: 1px;
        height: 24px;
        border-left: 1px dashed #ccc;
        flex-shrink: 0;
    }

    /* ── Status indicators ── */
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
        font-size: 12px;
        color: var(--ios-text-primary);
    }

    .dock-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ccc;
        transition: background 0.3s;
    }

    .dock-status-dot--streamer-on {
        --dock-streamer-target: var(--ios-green);
        background: var(--ios-green);
    }

    .dock-status-dot--streamer-off {
        --dock-streamer-target: var(--ios-gray);
        background: var(--ios-gray);
    }

    .dock-status-dot--streamer-flash {
        animation: dockStreamerFlash 0.2s ease;
    }

    .dock-snapshot-area {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    /* ── Minimized state: only logo + toggle + share btn visible, driven by CSS ── */
    .dock-minimized .dock-header > *:not(.dock-title):not(.dock-toggle-btn):not(.dock-share-btn) {
        display: none !important;
    }
    .dock-minimized .dock-toggle-btn {
        margin-left: auto;
    }
    .dock-minimized .dock-settings-wrapper {
        display: none !important;
    }

    /* ── Settings button + dropdown panel ── */
    .dock-settings-wrapper {
        position: relative;
        flex-shrink: 0;
    }
    .dock-settings-btn {
        position: relative;
        font-size: 1.2rem;
        border: 1px solid var(--glass-2-border);
        border-radius: 12px;
        width: 46px;
        height: 46px;
        flex-shrink: 0;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        background: var(--glass-2-bg-gradient);
        -webkit-backdrop-filter: blur(var(--glass-2-blur)) saturate(var(--glass-2-saturate));
        backdrop-filter: blur(var(--glass-2-blur)) saturate(var(--glass-2-saturate));
        transition: all 0.2s ease;
        box-shadow: var(--glass-2-shadow);
    }
    .dock-settings-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
    .dock-settings-badge {
        display: none;
        position: absolute;
        top: -4px;
        right: -4px;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
        padding: 1px 4px;
        border-radius: 6px;
        line-height: 1.3;
        white-space: nowrap;
        pointer-events: none;
    }
    .dock-settings-panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 220px;
        background: rgba(255,255,255,0.96);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 14px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.14);
        padding: 12px;
        z-index: var(--z-nav-dropdown, 200);
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
    .dock-settings-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--ios-text-secondary);
        letter-spacing: 0.3px;
    }
    .dock-settings-options {
        display: flex;
        gap: 4px;
    }
    .dock-settings-opt {
        flex: 1;
        padding: 6px 4px;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 8px;
        background: transparent;
        font-size: 12px;
        font-weight: 600;
        color: var(--ios-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: var(--ios-font);
    }
    .dock-settings-opt:hover {
        background: rgba(0,122,255,0.06);
        border-color: rgba(0,122,255,0.2);
    }
    .dock-settings-opt.active {
        background: rgba(0,122,255,0.12);
        border-color: var(--ios-blue);
        color: var(--ios-blue);
    }
    .dock-minimized .dock-content {
        display: none !important;
    }

    .dock-nav {
        display: flex;
        gap: 12px;
        background: transparent;
        border-radius: 12px;
        padding: 6px;
        flex-shrink: 0;
    }

    .dock-nav-button {
        position: relative;
        cursor: pointer;
        font-size: 15px;
        padding: 8px 16px;
        border: 1px solid transparent; /* transparent by default */
        background: transparent; /* remove white-ish plate */
        border-radius: 10px;
        transition: all 0.2s ease;
        color: var(--ios-text-secondary);
        font-weight: 600;
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
        border-radius: 8px;
        background: transparent;
        color: var(--ios-text-secondary);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .dock-tab.active {
        background-color: var(--ios-blue);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
    }

    .redeemed-stats-row {
        display: flex;
        gap: 8px;
        width: 100%;
        flex-wrap: wrap;
        align-items: stretch;
    }

    .stats-row {
        display: flex;
        gap: 8px;
        width: 100%;
        flex-wrap: wrap;
        align-items: stretch;
    }

    .dock-nav-button.active {
        font-weight: 800;
        background-color: var(--ios-blue);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
        border-color: rgba(255,255,255,0.25);
    }

    .dock-nav-button.active::after {
        content: '';
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 8px;
        height: 8px;
        background-color: var(--ios-blue);
        border-radius: 50%;
        animation: pulseIndicator 1.5s infinite alternate;
    }

    .dock-nav-group {
        position: relative;
    }

    .dock-nav-group-btn {
        position: relative;
        cursor: pointer;
        font-size: 15px;
        padding: 8px 16px;
        border: 1px solid transparent;
        background: transparent;
        border-radius: 10px;
        transition: all 0.2s ease;
        color: var(--ios-text-secondary);
        font-weight: 600;
        box-shadow: none;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .dock-nav-group-btn:hover { transform: translateY(-1px); }

    .dock-nav-group-btn .nav-caret {
        font-size: 10px;
        transition: transform 0.2s ease;
    }

    .dock-nav-group.open .nav-caret {
        transform: rotate(180deg);
    }

    .dock-nav-group-btn.active {
        font-weight: 800;
        background-color: var(--ios-blue);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
        border-color: rgba(255,255,255,0.25);
    }

    .dock-nav-group-btn.active .nav-caret {
        color: #ffffff;
    }

    .dock-nav-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%) scale(0.95);
        opacity: 0;
        pointer-events: none;
        min-width: 140px;
        background: var(--glass-2-bg, rgba(255,255,255,0.95));
        border: 1px solid var(--glass-2-border, rgba(0,0,0,0.08));
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        padding: 6px;
        z-index: var(--z-nav-dropdown, 200);
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
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--ios-text-secondary);
        cursor: pointer;
        text-align: left;
        transition: background 0.15s ease;
    }

    .dock-nav-dropdown-item:hover {
        background: rgba(0, 122, 255, 0.08);
        color: var(--ios-blue);
    }

    .dock-nav-dropdown-item.active {
        background: rgba(0, 122, 255, 0.12);
        color: var(--ios-blue);
        font-weight: 700;
    }

    .dock-toggle-btn {
        font-size: 1.2rem;
    border: 1px solid var(--glass-2-border);
    border-radius: 12px;
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    background: var(--glass-2-bg-gradient);
    -webkit-backdrop-filter: blur(var(--glass-2-blur)) saturate(var(--glass-2-saturate));
    backdrop-filter: blur(var(--glass-2-blur)) saturate(var(--glass-2-saturate));
    transition: all 0.2s ease;
    box-shadow: var(--glass-2-shadow);
    }

    .dock-toggle-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }

    .dock-content {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(100vh - 80px);
        height: calc(100vh - 80px);
    }

    .ios-table{
        width: max-content;
        min-width: 100%;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0;
        font-family: var(--ios-font);
        border-radius: var(--ios-table-border-radius);
        overflow: hidden;
    background: var(--glass-1-bg);
    -webkit-backdrop-filter: blur(var(--glass-1-blur)) saturate(var(--glass-1-saturate));
    backdrop-filter: blur(var(--glass-1-blur)) saturate(var(--glass-1-saturate));
    box-shadow: var(--glass-1-shadow);
    border: 1px solid var(--glass-1-border);
    }

    .ios-table-head{
    background: var(--ios-header-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: var(--z-table-header, 10);
    box-shadow: inset 0 -1px 0 rgba(0,0,0,0.06);
    }

    .ios-table th{
        padding: var(--ios-table-cell-padding);
        font-weight: 400; /* headers should not be bold */
        font-family: var(--ios-font);
        font-size: var(--ios-table-header-font-size);
        color: var(--ios-table-header);
        border-bottom: 1px solid rgba(60, 60, 67, 0.12);
        text-align: center; /* center align header text */
        vertical-align: middle;
        letter-spacing: 0.2px;
        background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(250,250,252,0.75));
    }

    .ios-table-header-icon{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
    }

    .ios-table-header-label{
        display: inline-block;
        margin-left: 6px;
    }

    .ios-table th.sortable{
        cursor: pointer;
        position: relative;
        padding-left: 28px; /* balance right padding for centered text */
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
        opacity: 0.7; /* DS_OPACITY.muted */
        transition: opacity 0.2s ease;
    }
    .ios-sort-button:hover { opacity: 1; }
    .ios-sort-indicator { display: inline-flex; line-height: 0; }

    .ios-table tr{
        transition: background-color 0.2s ease;
    }

    .ios-table tr:nth-child(even){
        background-color: var(--ios-secondary-bg);
    }
    .group-summary-row td{
        background-color: #f5f7fb;
    }

    .ios-table tr:hover{
        background-color: var(--ios-table-row-hover);
    }

    .ios-table td{
        padding: var(--ios-table-cell-padding);
        color: #222;
        border-bottom: 1px solid rgba(60, 60, 67, 0.04);
        vertical-align: middle;
    }

    .ios-status{
        display: inline-block;
        padding: 5px 10px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .ios-status.active, .ios-status.success{
        background-color: var(--ios-status-active-bg);
        color: var(--ios-green);
        border: 1px solid rgba(52, 199, 89, 0.25);
    }

    .ios-status.pending {
        background-color: var(--ios-status-pending-bg);
        color: var(--ios-orange);
        border: 1px solid rgba(215, 129, 0, 0.25);
    }

    .ios-status.inactive, .ios-status.failed, .ios-status.canceled {
        background-color: var(--ios-status-inactive-bg);
        color: var(--ios-red);
        border: 1px solid rgba(255, 59, 48, 0.25);
    }

    .ios-empty-state{
        padding: var(--ios-empty-padding);
        text-align: center;
    }

    .ios-search-container {
        position: relative;
        box-sizing: border-box;
        width: 220px;
    box-shadow: var(--glass-1-shadow);
    border-radius: 12px;
    border: 1px solid var(--glass-1-border);
    background: var(--glass-1-bg);
    -webkit-backdrop-filter: blur(var(--glass-1-blur)) saturate(var(--glass-1-saturate));
    backdrop-filter: blur(var(--glass-1-blur)) saturate(var(--glass-1-saturate));
    }

    .ios-search-input {
        width: 100%;
        padding: 10px 32px 10px 12px;
        border-radius: 12px;
        border: 1px solid transparent;
        background: transparent;
        font-size: 14px;
        font-family: var(--ios-font);
        color: var(--ios-text-primary);
    }

    .ios-search-input:focus {
        outline: none;
        border-color: var(--ios-blue);
        box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.08);
    }

    .action-chip {
        display:inline-flex; align-items:center; justify-content:center;
        height:28px; min-width:78px; padding:0 10px; border-radius:9999px;
        font:600 12.5px/28px system-ui, -apple-system, "Segoe UI", Roboto;
        border:1px solid transparent; box-shadow:var(--lg-shadow);
        transition: background .15s ease, transform .15s ease, border-color .15s ease;
    }
    .action-chip--enroll {
        background: rgba(0,122,255,0.12);
        border-color: rgba(0,122,255,0.35);
        color: #007aff;
        cursor: pointer;
    }
    .action-chip--enroll:hover {
        background: rgba(0,122,255,0.18);
    }
    .action-chip--enroll:active {
        transform: translateY(1px);
    }
    .action-chip--enroll:focus-visible {
        outline: 2px solid rgba(0,122,255,0.35);
        outline-offset: 2px;
    }
    .action-chip--enrolled {
        background: rgba(16,185,129,0.12);
        border-color: rgba(16,185,129,0.35);
        color: #0e9f6e;
        cursor: pointer; pointer-events: auto;
    }
    .action-chip--enrolled:hover { background: rgba(16,185,129,0.18); }
    .action-chip--enrolled:active { transform: translateY(1px); }
    .action-chip--enrolled:focus-visible { outline: 2px solid rgba(16,185,129,0.35); outline-offset: 2px; }

    @media (max-width: 768px) {
        .dock-container {
            width: 95%;
            left: 2.5%;
        }

        .summary-header,
        .button-container {
            flex-direction: column;
            align-items: stretch;
        }

        .chart-grid-responsive {
            grid-template-columns: 1fr !important;
        }
    }

    .dock-container .ios-table {
        background: rgba(255,255,255,.92);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }
    .dock-container .ios-table-head {
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    box-shadow: inset 0 -1px 0 rgba(0,0,0,.06);
    }

    button:focus-visible, .ios-table th.sortable:focus-visible {
        outline: 2px solid rgba(0,122,255,.35);
        outline-offset: 2px;
        border-radius: 10px;
    }

    .hidden { display: none !important; }
    .text-muted { color: var(--ios-text-secondary); opacity:0.7; /* DS_OPACITY.muted */ }

    .btn { position:relative; display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:12px; border:1px solid transparent; cursor:pointer; transition: transform .15s ease, box-shadow .15s ease, background .15s ease, color .15s ease; font-weight:600; font-family: var(--ios-font); }
    .btn--sm { padding:6px 12px; font-size:13px; }
    .btn--md { padding:10px 16px; font-size:14px; }
    .btn--lg { padding:12px 24px; font-size:16px; }
    .btn--full { width: 100%; }
    .btn:disabled { opacity:.6; cursor:not-allowed; }
    .btn--primary { background: linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 8%), linear-gradient(135deg, rgba(0,122,255,0.9), rgba(0,122,255,0.8)); color:#fff; border-color: rgba(255,255,255,0.25); box-shadow: 0 6px 16px rgba(0,122,255,0.20); }
    .btn--secondary { background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.12)); color:var(--ios-text-secondary); border-color: var(--lg-border); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .btn--danger { background: linear-gradient(135deg, rgba(255,59,48,0.9), rgba(255,59,48,0.8)); color:#fff; border-color: rgba(255,59,48,0.5); box-shadow: 0 6px 16px rgba(255,59,48,0.20); }
    .btn--success { background: linear-gradient(135deg, rgba(52,199,89,0.9), rgba(52,199,89,0.8)); color:#fff; border-color: rgba(52,199,89,0.5); box-shadow: 0 6px 16px rgba(52,199,89,0.20); }
    .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--ios-shadow-md); }
    .btn:active:not(:disabled) { transform: translateY(0); box-shadow: var(--ios-shadow-sm); }

    .fav-toggle { background: transparent !important; border: none !important; box-shadow: none !important; padding: 4px; border-radius: 8px; }
    .fav-toggle:hover { transform: none; background: rgba(0,0,0,0.04); }
    .fav-toggle:focus-visible { outline: 2px solid rgba(0,122,255,.35); outline-offset: 2px; }

    .badge { display:inline-flex; align-items:center; gap:4px; border-radius:12px; border:1px solid currentColor; background: linear-gradient(135deg, rgba(255,255,255,var(--lg-alpha-1)), rgba(255,255,255,var(--lg-alpha-2))); -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)); backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)); transition: transform .15s ease, box-shadow .15s ease; }
    .badge--sm { padding:3px 6px; font-size:11px; border-radius:8px; }
    .badge--md { padding:4px 8px; font-size:12px; border-radius:10px; }
    .badge--lg { padding:5px 10px; font-size:13px; border-radius:12px; }
    .badge:hover { transform: translateY(-2px); box-shadow: 0 2px 5px rgba(0,0,0,0.08); }

    .dock-notification-container { position: fixed; top: 20px; right: 20px; z-index: var(--z-notification, 100100); display: flex; flex-direction: column; gap: 12px; pointer-events: none; max-width: 360px; }
    .dock-notification { pointer-events: auto; padding: 12px 14px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #fff; font-size: 14px; display: flex; align-items: center; gap: 8px; opacity: 0; transform: translateX(100px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .dock-notification.show { opacity: 1; transform: translateX(0); }
    .dock-notification.removing { opacity: 0; transform: translateX(100px); pointer-events: none; }
    .dock-notification.info { background-color: var(--ios-blue); }
    .dock-notification.success { background-color: var(--ios-green); }
    .dock-notification.error { background-color: var(--ios-red); }
    .dock-notification.warning { background-color: var(--ios-orange); }
    .dock-notification .close { background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0 0 0 8px; margin-left: auto; opacity: 0.7; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; } /* DS_OPACITY.muted */
    .dock-notification .close:hover { opacity: 1; }
    .dock-notification:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.2); }

    .refresh-dropdown-container { position: relative; display:flex; align-items:center; margin-right: 12px; }
    .refresh-brand-logo { display:flex; align-items:center; justify-content:center; margin-left:6px; color:#fff; font-size:10px; letter-spacing:0.4px; text-transform:uppercase; font-weight:600; }
    .refresh-brand-logo svg { width:16px; height:16px; display:block; }
    .refresh-dropdown-menu { position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; box-shadow: 0 12px 24px rgba(0,0,0,0.14); z-index: var(--z-nav-dropdown, 200); min-width: 180px; display: none; margin-top: 8px; padding: 6px; overflow: hidden; }
    .refresh-dropdown-container.open .refresh-dropdown-menu { display:block; }
    .refresh-dropdown-item { padding: 10px 12px; cursor: pointer; display: flex; align-items: center; font-size: 14px; color: #1c1c1e; border-radius: 8px; margin: 2px; transition: background-color .15s ease, color .15s ease; background: transparent; font-weight: 600; gap: 8px; }
    .refresh-dropdown-item:hover { background-color: rgba(0,0,0,0.05); }

    .ios-search-icon { position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; transition: color .3s ease; }
    .ios-search-clear { position:absolute; right:30px; top:50%; transform:translateY(-50%); background:none; border:none; font-size:18px; cursor:pointer; color:var(--ios-gray); display:none; padding:4px; }
    .ios-search-container:focus-within { box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1); }

    .ios-highlight-row { border-left: 3px solid var(--ios-highlight-border); background: var(--ios-highlight-bg); }
    .ios-match-enrolled { background-color: rgba(52, 199, 89, 0.15) !important; border-left: 3px solid rgba(52, 199, 89, 0.6) !important; }
    .ios-match-eligible { background-color: rgba(0, 122, 255, 0.15) !important; border-left: 3px solid rgba(0, 122, 255, 0.6) !important; }

    .dock-modal .modal-header {
        background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.86));
        box-shadow: inset 0 -1px 0 rgba(0,0,0,.06);
    }

    @media (prefers-reduced-motion: reduce) {
        * {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .001ms !important;
        }
    }

    /* === Responsive header priority (ResizeObserver-driven) ===
       A ResizeObserver on .dock-container measures its actual content-box
       width and toggles .cw-lte-<bp> classes. This ensures breakpoints
       respond to the real container width (including side-panel shrinkage),
       independent of viewport size.
       Priority order (highest = hidden last):
       1. AlexQuant logo + toggle   (never hidden)
       2. Trade / Analysis nav     (hidden last among removables)
       3. DayChange + TotalChange  (first account-info pair)
       4. AccVal + Cash            (second account-info pair)
       5. $SPX
       6. $COMPX
       7. $DJI
       8. $RUT                     (hidden first among data items)
       Status indicators are not in the priority list → hidden earliest.
    */

    /* Tier 0 (not in priority list): hide status indicator lights first */
    .cw-lte-1500 .dock-status-container { display: none !important; }

    /* Tier 8: hide $RUT */
    .cw-lte-1300 .dock-indices [data-index-symbol="$RUT"] { display: none !important; }

    /* Tier 7: hide $DJI */
    .cw-lte-1200 .dock-indices [data-index-symbol="$DJI"] { display: none !important; }

    /* Tier 6: hide $COMPX */
    .cw-lte-1050 .dock-indices [data-index-symbol="$COMPX"] { display: none !important; }

    /* Tier 5: hide $SPX (last index) + center separator */
    .cw-lte-950 .dock-indices { display: none !important; }
    .cw-lte-950 .dock-center-sep { display: none !important; }

    /* Tier 4: hide AccVal + Cash pair */
    .cw-lte-820 .dock-totals-accval { display: none !important; }

    /* Tier 3: hide all totals (DayChange + TotalChange) + nav separator */
    .cw-lte-640 .dock-totals { display: none !important; }
    .cw-lte-640 .dock-nav-sep { display: none !important; }

    /* Tier 2: hide Trade / Analysis nav buttons */
    .cw-lte-500 .dock-nav { display: none !important; }

    /* ══════════════════════════════════════════════════════════════════════════
       Mobile Layout — driven by .layout-mobile on <html>
       Set by initLayoutMode() via matchMedia('(max-width: 768px)')
       ══════════════════════════════════════════════════════════════════════════ */

    /* ── Shell ── */
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
    /* Element visibility in mobile is handled by ResizeObserver breakpoints
       (.cw-lte-*) based on actual container width — no separate mobile overrides.
       This preserves the priority-based hide sequence at all widths. */

    /* ── Bottom Tab Bar ── */
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
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        z-index: var(--z-sticky-nav, 100);
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
        color: var(--ios-text-secondary);
        font-size: 10px;
        font-weight: 500;
        background: none;
        border: none;
        font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, sans-serif);
        -webkit-tap-highlight-color: transparent;
    }
    .mobile-tab-item.active { color: var(--ios-blue); }
    .mobile-tab-item svg { width: 22px; height: 22px; }

    /* ── More‐sheet overlay (mobile "More" tab) ── */
    .mobile-more-sheet {
        position: fixed;
        bottom: calc(56px + env(safe-area-inset-bottom, 0px));
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.96);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 14px 14px 0 0;
        padding: 12px 0 4px;
        z-index: var(--z-sticky-nav, 100);
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
    }
    .mobile-more-sheet-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        font-size: 15px;
        color: var(--ios-text-primary);
        background: none;
        border: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, sans-serif);
        -webkit-tap-highlight-color: transparent;
    }
    .mobile-more-sheet-item:active { background: rgba(0, 0, 0, 0.04); }
    .mobile-more-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.2);
        z-index: calc(var(--z-sticky-nav, 100) - 1);
    }

    /* ── Page-level mobile rules ── */

    /* Section grids (Portfolio, Options, etc.) → single column with tighter gap */
    .layout-mobile .section-grid {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
    }

    /* Chart page: single column, tighter gap */
    .layout-mobile .chart-grid-responsive {
        grid-template-columns: 1fr !important;
        gap: 12px !important;
    }

    /* Opening page: tighter chart grid */
    .layout-mobile .opening-chart-grid {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
    }

    /* News page: single column */
    .layout-mobile .alexquant-news-layout {
        grid-template-columns: 1fr !important;
    }

    /* AI page: full width, reduced padding */
    .layout-mobile .ai-analysis-container {
        max-width: 100% !important;
        padding: 12px 14px !important;
    }

    /* Universal mobile spacing helpers */
    .layout-mobile .page-header {
        padding: 10px 12px !important;
    }
    .layout-mobile .control-bar {
        flex-wrap: wrap;
        gap: 6px !important;
    }

    `;

  const extraCSS = `
        .table-scroll {
            overflow-x: auto;
            scrollbar-gutter: stable both-edges;
            padding-right: 14px;
        }
        .ios-table tbody tr:hover {
            background: rgba(0,0,0,0.03);
            box-shadow: inset 0 1px 0 rgba(0,0,0,0.04), inset 0 -1px 0 rgba(0,0,0,0.04);
        }
        .ios-table td { line-height: 1.2; padding-top: 6px; padding-bottom: 6px; }
        .ios-table th { line-height: 1.2; padding-top: 8px; padding-bottom: 8px; }
    `;
  injectStylesheet("dock-extra-styles", extraCSS);
  injectStylesheet("dock-global-styles", globalCSS);
}

function applyColorTheme(theme = "default") {
  const root = document.documentElement;

  root.style.setProperty("--ios-blue", "#007AFF");
  root.style.setProperty("--ios-dark-blue", "#0062CC");
  root.style.setProperty("--ios-green", "rgb(32, 169, 69)");
  root.style.setProperty("--ios-orange", "rgb(215, 129, 0)");
  root.style.setProperty("--ios-red", "rgb(215, 49, 38)");

  root.style.setProperty(
    "--ios-title-gradient",
    "linear-gradient(45deg, #4CAF50, #2196F3)",
  );

  requestAnimationFrame(() => {
    document.body.classList.remove(
      "theme-default",
      "theme-green",
      "theme-purple",
      "theme-dark",
    );
    document.body.classList.add(`theme-${theme}`);
  });

  return theme;
}
