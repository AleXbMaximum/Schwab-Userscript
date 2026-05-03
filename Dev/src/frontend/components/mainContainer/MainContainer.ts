import { ui_createElement } from "../core/builders/createElement";
import { ui_toggleMinimize, ui_makeDraggable } from "../core/behaviors/windowBehaviors";
import type { LayoutMode } from "../core/behaviors/layoutMode";
import { buildShareModeButton } from "./shareModeButton";

type NavGroup = { label: string; items: { text: string; view: string }[] };
type ChangeViewFn = (view: string) => void;

// SVG icons for mobile bottom tab bar (24×24 simple outlines)
const TAB_ICONS: Record<string, string> = {
  HOLDINGS:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  PORTFOLIO:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  VISUALIZE:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 5-7"/></svg>',
  OPTIONS:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  MORE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
};

// Flat list of items shown in the bottom tab bar (first 4 are direct tabs, rest go under "More")
const MOBILE_DIRECT_TABS: { text: string; view: string }[] = [
  { text: "Holdings", view: "HOLDINGS" },
  { text: "Portfolio", view: "PORTFOLIO" },
  { text: "Options", view: "OPTIONS" },
  { text: "Visualize", view: "VISUALIZE" },
];
const MOBILE_MORE_ITEMS: { text: string; view: string }[] = [
  { text: "Option Flow", view: "OPTION_FLOW" },
  { text: "AI Analysis", view: "AI_ANALYSIS" },
  { text: "News", view: "NEWS" },
];

export function ui_createMain(
  dependencies: { changeView?: ChangeViewFn; layoutMode?: LayoutMode } = {},
) {
  const { changeView, layoutMode = "desktop" } = dependencies;
  const isMobile = layoutMode === "mobile";

  const uiElements: any = {
    container: null,
    content: null,
    toggleBtn: null,
    btnHoldings: null,
    btnPortfolio: null,
    btnSettings: null,
    nav: null,
  };

  const navGroups: NavGroup[] = [
    {
      label: "Trade",
      items: [
        { text: "Holdings", view: "HOLDINGS" },
        { text: "Portfolio", view: "PORTFOLIO" },
        { text: "News", view: "NEWS" },
      ],
    },
    {
      label: "Analysis",
      items: [
        { text: "Options", view: "OPTIONS" },
        { text: "Option Flow", view: "OPTION_FLOW" },
        { text: "Visualize", view: "VISUALIZE" },
        { text: "AI Analysis", view: "AI_ANALYSIS" },
      ],
    },
  ];

  // ── Container (shared) ──────────────────────────────────────────────────
  uiElements.container = ui_createElement("div", {
    props: {
      id: "alexquant-container",
      role: "region",
      "aria-expanded": "true",
    },
    // `.ax-glass-rim` wires the mouse-tracked rim via the global observer
    // in axTheme/liquidGlass.ts, giving the dock the recorder-style hover
    // light that follows the pointer along its border.
    className: "dock-container dock-expanded ax-glass-rim",
    styleString: isMobile
      ? "left:0; top:0; width:100vw; height:100vh; opacity:0; transform:scale(0.98); transition: opacity .3s ease, transform .3s ease; border-radius:0;"
      : "left:0; top:0; width:82vw; height:100vh; opacity:0; transform:scale(0.98); transition: opacity .3s ease, transform .3s ease, width .3s ease, height .3s ease; border-radius:0;",
  });

  // Expose changeView so page render functions can navigate programmatically
  uiElements.changeView = changeView;

  // ── Shell branch ────────────────────────────────────────────────────────
  if (isMobile) {
    buildMobileShell(uiElements, navGroups, changeView);
  } else {
    buildDesktopShell(uiElements, navGroups, changeView);
  }

  // ── Content area (shared) ───────────────────────────────────────────────
  uiElements.content = ui_createElement("div", {
    className: "dock-content",
    props: { id: "alexquant-content" },
  });

  uiElements.container.appendChild(uiElements.content);

  // ── Mobile bottom tab bar ───────────────────────────────────────────────
  if (isMobile) {
    uiElements.container.appendChild(buildBottomTabBar(changeView));
  }

  // ── Mount to DOM ────────────────────────────────────────────────────────
  document.body.appendChild(uiElements.container);

  // Draggable only on desktop
  if (!isMobile && uiElements._header) {
    ui_makeDraggable(uiElements._header, uiElements.container);
  }

  // ── Responsive header breakpoints (desktop only) ─────────────────────
  // Measures the actual container content-box width via ResizeObserver
  // and toggles .cw-lte-<bp> classes so CSS can hide header elements
  // in priority order — independent of viewport or panel state.
  if (!isMobile) {
    const HEADER_BP = [1500, 1300, 1200, 1050, 950, 820, 640, 500];
    new ResizeObserver(([entry]) => {
      const w =
        entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      const el = uiElements.container as HTMLElement;
      for (const bp of HEADER_BP) {
        el.classList.toggle(`cw-lte-${bp}`, w <= bp);
      }
    }).observe(uiElements.container);
  }

  requestAnimationFrame(() => {
    uiElements.container.style.opacity = "1";
    uiElements.container.style.transform = "scale(1)";
  });

  return uiElements;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Desktop Shell — horizontal header bar with dropdown navigation
// ═══════════════════════════════════════════════════════════════════════════════

function buildDesktopShell(
  uiElements: any,
  navGroups: NavGroup[],
  changeView?: ChangeViewFn,
) {
  const header = ui_createElement("div", { className: "dock-header" });
  uiElements._header = header;

  // ── Priority 1: Logo (always visible) ────────────────────────────────
  const title = ui_createElement("span", {
    text: "AlexQuant",
    className: "dock-title",
  });

  // ── Priority 2: Navigation groups (Trade / Analysis) ─────────────────
  uiElements.nav = ui_createElement("div", { className: "dock-nav" });

  const groupEls: {
    wrapper: HTMLElement;
    btn: HTMLElement;
    dropdown: HTMLElement | null;
    itemEls: HTMLElement[];
  }[] = [];

  function closeAllDropdowns() {
    groupEls.forEach((g) => g.wrapper.classList.remove("open"));
  }

  function activateGroup(groupIdx: number, itemIdx: number) {
    groupEls.forEach((g) => {
      g.btn.classList.remove("active");
      g.itemEls.forEach((el) => el.classList.remove("active"));
    });
    const group = groupEls[groupIdx];
    group.btn.classList.add("active");
    if (group.itemEls[itemIdx]) group.itemEls[itemIdx].classList.add("active");
  }

  navGroups.forEach((groupDef, gIdx) => {
    const isSingle = groupDef.items.length === 1;

    const wrapper = ui_createElement("div", { className: "dock-nav-group" });

    const btn = ui_createElement("button", {
      className: `dock-nav-group-btn${gIdx === 0 ? " active" : ""}`,
      props: {
        innerHTML: `<span class="nav-label">${groupDef.label}</span>${!isSingle ? '<span class="nav-caret">\u25BE</span>' : ""}`,
      },
    });

    let dropdown: HTMLElement | null = null;
    const itemEls: HTMLElement[] = [];

    if (isSingle) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        activateGroup(gIdx, 0);
        if (typeof changeView === "function")
          changeView(groupDef.items[0].view);
      });
    } else {
      dropdown = ui_createElement("div", { className: "dock-nav-dropdown" });

      groupDef.items.forEach((item, iIdx) => {
        const itemEl = ui_createElement("button", {
          className: `dock-nav-dropdown-item${gIdx === 0 && iIdx === 0 ? " active" : ""}`,
          text: item.text,
          events: {
            click: (e) => {
              (e as Event).stopPropagation();
              closeAllDropdowns();
              activateGroup(gIdx, iIdx);
              if (typeof changeView === "function") changeView(item.view);
            },
          },
        });
        itemEls.push(itemEl);
        dropdown!.appendChild(itemEl);
      });

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains("open");
        closeAllDropdowns();
        if (!isOpen) wrapper.classList.add("open");
      });

      wrapper.appendChild(dropdown);
    }

    wrapper.insertBefore(btn, wrapper.firstChild);
    groupEls.push({ wrapper, btn, dropdown, itemEls });
    uiElements.nav.appendChild(wrapper);
  });

  document.addEventListener("click", () => closeAllDropdowns());

  // ── Separator between nav and data ───────────────────────────────────
  const sep1 = ui_createElement("div", { className: "dock-nav-sep" });
  uiElements.sep1 = sep1;

  // ── Priority 3–8: Center data area ───────────────────────────────────
  const centerContainer = ui_createElement("div", {
    className: "dock-header-center",
  });
  uiElements.centerContainer = centerContainer;

  uiElements.totalsContainer = ui_createElement("div", {
    className: "dock-totals",
  });
  const sep2 = ui_createElement("div", { className: "dock-center-sep" });
  uiElements.indicesContainer = ui_createElement("div", {
    className: "dock-indices",
  });

  centerContainer.appendChild(uiElements.totalsContainer);
  centerContainer.appendChild(sep2);
  centerContainer.appendChild(uiElements.indicesContainer);

  // ── Priority 1: Toggle button (always visible) ───────────────────────
  uiElements.toggleBtn = ui_createElement("button", {
    className: "dock-toggle-btn",
    props: {
      innerHTML:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>',
      "aria-label": "Minimize",
    },
    events: {
      click: () => ui_toggleMinimize(uiElements.container, uiElements),
    },
  });

  // ── Share Mode button (left of toggle, always visible) ────────────────
  uiElements.shareModeBtn = buildShareModeButton();

  // ── Snapshot area (detached — kept for API compatibility) ─────────────
  uiElements.snapshotArea = ui_createElement("div", {
    className: "dock-snapshot-area",
  });

  // ── Assemble header ──────────────────────────────────────────────────
  // Minimized state: CSS hides all children except .dock-title and .dock-toggle-btn.
  // .dock-settings-wrapper is explicitly hidden via .dock-minimized rule.
  // Toggle button is always last (rightmost) for consistent access.
  header.appendChild(title);
  header.appendChild(uiElements.nav);
  header.appendChild(sep1);
  header.appendChild(centerContainer);
  header.appendChild(uiElements.shareModeBtn);
  header.appendChild(uiElements.toggleBtn);

  uiElements.container.appendChild(header);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mobile Shell — condensed top bar (title + account value)
// ═══════════════════════════════════════════════════════════════════════════════

function buildMobileShell(
  uiElements: any,
  _navGroups: NavGroup[],
  _changeView?: ChangeViewFn,
) {
  const header = ui_createElement("div", {
    className: "dock-header",
    styleString: "padding: 8px 16px; gap: 8px; height: 48px;",
  });
  uiElements._header = header;

  const title = ui_createElement("span", {
    text: "AlexQuant",
    className: "dock-title",
    styleString: "font-size: 15px;",
  });

  // Compact totals display in the top bar
  uiElements.totalsContainer = ui_createElement("div", {
    className: "dock-totals",
    styleString:
      "display: flex; gap: 10px; font-size: 11px; margin-left: auto;",
  });

  // Hidden elements that other systems reference — created but not visible on mobile.
  // CSS hides them via .layout-mobile rules; we still need the DOM references
  // so DataPipelineCoordinator and other consumers don't null-pointer.
  uiElements.nav = ui_createElement("div", {
    className: "dock-nav",
    styleString: "display:none;",
  });
  uiElements.indicesContainer = ui_createElement("div", {
    className: "dock-indices",
    styleString: "display:none;",
  });
  uiElements.centerContainer = ui_createElement("div", {
    styleString: "display:none;",
  });
  uiElements.snapshotArea = ui_createElement("div", {
    className: "dock-snapshot-area",
    styleString: "display:none;",
  });
  uiElements.statusContainer = ui_createElement("div", {
    className: "dock-status-container",
    styleString: "display:none;",
  });
  uiElements.toggleBtn = ui_createElement("button", {
    className: "dock-toggle-btn",
    styleString: "display:none;",
  });

  // Options status dot — still created so analysis pages can reference it
  uiElements.optionsStatus = ui_createElement("div", {
    styleString: "display:none;",
  });

  // Share Mode button for mobile
  uiElements.shareModeBtn = buildShareModeButton();
  uiElements.shareModeBtn.style.cssText =
    "width:32px; height:32px; min-width:32px; border-radius:8px; font-size:0.9rem; padding:0;";

  header.appendChild(title);
  header.appendChild(uiElements.totalsContainer);
  header.appendChild(uiElements.shareModeBtn);

  uiElements.container.appendChild(header);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mobile Bottom Tab Bar
// ═══════════════════════════════════════════════════════════════════════════════

function buildBottomTabBar(changeView?: ChangeViewFn): HTMLElement {
  const bar = ui_createElement("div", { className: "mobile-tab-bar" });

  let _activeView = "HOLDINGS";
  const tabEls: HTMLElement[] = [];
  let moreSheet: HTMLElement | null = null;
  let moreBackdrop: HTMLElement | null = null;

  function setActiveTab(view: string) {
    _activeView = view;
    tabEls.forEach((el) => {
      const tabView = el.dataset.view ?? "";
      el.classList.toggle(
        "active",
        tabView === view ||
          (tabView === "MORE" &&
            MOBILE_MORE_ITEMS.some((m) => m.view === view)),
      );
    });
  }

  function closeMoreSheet() {
    if (moreSheet) {
      moreSheet.remove();
      moreSheet = null;
    }
    if (moreBackdrop) {
      moreBackdrop.remove();
      moreBackdrop = null;
    }
  }

  function openMoreSheet() {
    if (moreSheet) {
      closeMoreSheet();
      return;
    }

    moreBackdrop = ui_createElement("div", {
      className: "mobile-more-backdrop",
      events: { click: closeMoreSheet },
    });

    moreSheet = ui_createElement("div", { className: "mobile-more-sheet" });
    MOBILE_MORE_ITEMS.forEach((item) => {
      const btn = ui_createElement("button", {
        className: "mobile-more-sheet-item",
        text: item.text,
        events: {
          click: () => {
            closeMoreSheet();
            setActiveTab(item.view);
            if (typeof changeView === "function") changeView(item.view);
          },
        },
      });
      moreSheet!.appendChild(btn);
    });

    document.body.appendChild(moreBackdrop);
    document.body.appendChild(moreSheet);
  }

  // Direct tabs
  MOBILE_DIRECT_TABS.forEach((tab) => {
    const el = ui_createElement("button", {
      className: `mobile-tab-item${tab.view === "HOLDINGS" ? " active" : ""}`,
      props: {
        innerHTML: `${TAB_ICONS[tab.view] ?? ""}<span>${tab.text}</span>`,
      },
      events: {
        click: () => {
          closeMoreSheet();
          setActiveTab(tab.view);
          if (typeof changeView === "function") changeView(tab.view);
        },
      },
    });
    el.dataset.view = tab.view;
    tabEls.push(el);
    bar.appendChild(el);
  });

  // "More" tab
  const moreTab = ui_createElement("button", {
    className: "mobile-tab-item",
    props: {
      innerHTML: `${TAB_ICONS.MORE}<span>More</span>`,
    },
    events: { click: openMoreSheet },
  });
  moreTab.dataset.view = "MORE";
  tabEls.push(moreTab);
  bar.appendChild(moreTab);

  return bar;
}

// Settings Button (gear icon + share mode / theme / render dropdown)
// lives in ./shareModeButton.ts.
