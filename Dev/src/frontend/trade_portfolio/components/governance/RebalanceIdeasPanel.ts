import { ui_createElement } from "../../../components/core/builders/createElement";
import { DS_BUTTONS, DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/styles/theme";
import type{
  RebalanceAnchorMode,
  RebalanceModeId,
} from "../../../../shared/types/core";
import type { BetaHorizon } from "../../../../backend/computation/beta/types";

import {
  type Payload,
  type SortKey,
  BETA_HORIZONS,
  METRIC_GROUPS,
  GREEK_MODES,
  PRIVACY_HIDDEN_METRICS,
  PRIVACY_HIDDEN_GREEKS,
  MAGNIFIED_MODES,
  normalizeSymbolKey,
} from "./rebalanceTypes";
import {
  getShareMode,
  getCustomMultiplier,
  onShareModeChange,
} from "../../../../shared/utils/domain/globalShareMode";
import {
  buildTradeSuggestions,
  renderTradeSuggestions,
} from "./rebalanceSuggestions";
import { type MaskConfig } from "./rebalanceTableHelpers";
import { buildRebalanceTable } from "./rebalanceTableBuilder";
import { updateRebalanceIncremental } from "./rebalanceIncrementalUpdate";
import { createTargetEditing } from "./rebalanceTargetEditing";
import { setupProfileActions } from "./rebalanceProfileActions";

// ── Main Panel ──

export function renderRebalanceIdeasPanel(
  payload: Payload,
): HTMLElement & { cleanup?: () => void; update?: (next: Payload) => void } {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (next: Payload) => void;
  };

  const panelHeader = ui_createElement("div", {
    styleString:
      "display:flex; align-items:center; justify-content:space-between; gap:8px;" +
      " margin-bottom:8px;",
  });
  panelHeader.appendChild(
    ui_createElement("h3", {
      text: "Rebalance",
      styleString: DS_TYPOGRAPHY.panelTitle + " margin:0;",
    }),
  );
  panel.appendChild(panelHeader);

  let latestPayload = payload;
  let betaHorizon: BetaHorizon = "short";
  const profileSelect = ui_createElement("select", {
    props: { title: "Rebalance profile list" },
    styleString:
      "width:clamp(240px, 28vw, 360px); max-width:100%; flex:0 1 340px; height:30px; padding:0 8px;" +
      " font-size:var(--ax-fs-md); border:1px solid var(--ax-border); border-radius:var(--ax-radius-md);" +
      " background:var(--ax-bg-input); color:var(--ax-fg);",
  }) as HTMLSelectElement;
  const importFileBtn = ui_createElement("button", {
    text: "Import",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:5px 10px; font-size:12px; border-radius:8px;",
  }) as HTMLButtonElement;
  const recalculateBtn = ui_createElement("button", {
    text: "Recalculate",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:5px 10px; font-size:12px; border-radius:8px;",
  }) as HTMLButtonElement;
  const saveProfileBtn = ui_createElement("button", {
    text: "Save",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:5px 10px; font-size:12px; border-radius:8px; color:var(--ios-blue);",
  }) as HTMLButtonElement;
  const deleteProfileBtn = ui_createElement("button", {
    text: "Delete",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.danger +
      " padding:5px 10px; font-size:12px; border-radius:8px;",
  }) as HTMLButtonElement;
  const loadProfileBtn = ui_createElement("button", {
    text: "Load",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:5px 10px; font-size:12px; border-radius:8px;",
  }) as HTMLButtonElement;
  const exportSelectedBtn = ui_createElement("button", {
    text: "Export",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:5px 10px; font-size:12px; border-radius:8px;",
  }) as HTMLButtonElement;
  const exportAllBtn = ui_createElement("button", {
    text: "Export All",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:5px 10px; font-size:12px; border-radius:8px;",
  }) as HTMLButtonElement;
  recalculateBtn.addEventListener("click", () => {
    if (latestPayload.onRecalculate) latestPayload.onRecalculate();
  });
  // Watchlist ticker input
  const watchlistInput = ui_createElement("input", {
    props: { type: "text", placeholder: "Add to watchlist\u2026" },
    styleString:
      "width:100px; padding:4px 8px; font-size:var(--ax-fs-md); border:1px solid var(--ax-border); border-radius:6px; background:var(--ax-bg-input); color:var(--ax-fg); font-family:inherit; outline:none;",
  }) as HTMLInputElement;
  const watchlistAddBtn = ui_createElement("button", {
    text: "+",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " padding:4px 8px; font-size:13px; font-weight:700; border-radius:6px; line-height:1;",
  }) as HTMLButtonElement;
  const normalizeTickerSymbol = (value: string): string =>
    normalizeSymbolKey(value);
  const hasExistingWatchlistKey = (symbol: string): boolean => {
    const allKeys = new Set<string>();
    for (const key of Object.keys(latestPayload.derived.byUnderlying ?? {})) {
      const normalized = normalizeTickerSymbol(key);
      if (normalized) allKeys.add(normalized);
    }
    for (const key of Object.keys(latestPayload.rebalanceTargets ?? {})) {
      const normalized = normalizeTickerSymbol(key);
      if (normalized) allKeys.add(normalized);
    }
    for (const key of latestPayload.extraBetaTickers ?? []) {
      const normalized = normalizeTickerSymbol(key);
      if (normalized) allKeys.add(normalized);
    }
    return allKeys.has(symbol);
  };
  const doAddWatchlist = () => {
    const val = normalizeTickerSymbol(watchlistInput.value);
    if (!val || hasExistingWatchlistKey(val)) {
      watchlistInput.value = "";
      return;
    }
    watchlistInput.value = "";
    if (latestPayload.onAddTicker) latestPayload.onAddTicker(val);
  };
  watchlistAddBtn.addEventListener("click", doAddWatchlist);
  watchlistInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAddWatchlist();
  });

  // ── Main content: table (4/5) + trade suggestions (1/5) side-by-side ──
  const showTradeSuggestions = payload.showTradeSuggestions !== false;
  const mainContent = ui_createElement("div", {
    styleString: "display:flex; gap:10px; align-items:stretch;",
  });

  // ── Left pane: controls + table ──────────────────────────────────────
  const tablePane = ui_createElement("div", {
    styleString: `${showTradeSuggestions ? "flex:4;" : "flex:1;"} min-width:0; display:flex; flex-direction:column; gap:8px;`,
  });
  const controlsBar = ui_createElement("div", {
    styleString:
      "display:flex; flex-direction:column; gap:6px; padding:8px; border-radius:var(--ax-radius-md);" +
      " border:1px solid var(--ax-border); background:var(--ax-glass-2-bg);",
  });
  const controlsRow = ui_createElement("div", {
    styleString:
      "display:flex; flex-wrap:nowrap; gap:6px; align-items:center; min-width:0;" +
      " overflow-x:auto; scrollbar-width:thin;",
  });
  // Share mode is now global — subscribe for re-render on change
  const unsubShareMode = onShareModeChange(() => {
    // Reset sort if sorted by masked column when mode is dollarOff
    const mode = getShareMode();
    if (mode === "dollarOff" && sortKey) {
      const sk = sortKey;
      if (
        (typeof sk === "string" &&
          (PRIVACY_HIDDEN_METRICS.has(sk as RebalanceAnchorMode) ||
            PRIVACY_HIDDEN_GREEKS.has(sk as RebalanceModeId))) ||
        (typeof sk === "string" &&
          sk.startsWith("tgt:") &&
          PRIVACY_HIDDEN_METRICS.has(sk.slice(4) as RebalanceAnchorMode)) ||
        (typeof sk === "string" &&
          sk.startsWith("dev:") &&
          PRIVACY_HIDDEN_METRICS.has(sk.slice(4) as RebalanceAnchorMode))
      ) {
        sortKey = null;
        sortAsc = true;
      }
    }
    renderedKeyList = "";
    renderAll(latestPayload);
  });

  const divider = (): HTMLElement =>
    ui_createElement("span", {
      styleString:
        "width:1px; align-self:stretch; background:var(--ios-border); margin:0 2px;",
    });

  const profileGroup = ui_createElement("div", {
    styleString:
      "display:flex; flex-wrap:wrap; gap:6px; align-items:center; flex:1 1 auto; min-width:280px;",
  });
  profileGroup.appendChild(profileSelect);
  profileGroup.appendChild(loadProfileBtn);
  profileGroup.appendChild(saveProfileBtn);
  profileGroup.appendChild(deleteProfileBtn);
  profileGroup.appendChild(divider());
  profileGroup.appendChild(importFileBtn);
  profileGroup.appendChild(exportSelectedBtn);
  profileGroup.appendChild(exportAllBtn);
  profileGroup.appendChild(divider());
  profileGroup.appendChild(watchlistInput);
  profileGroup.appendChild(watchlistAddBtn);

  // ── Beta horizon selector (inline dropdown) ──
  const horizonGroup = ui_createElement("div", {
    styleString: "display:flex; align-items:center; gap:4px; white-space:nowrap;",
  });
  horizonGroup.appendChild(
    ui_createElement("span", {
      text: "\u03B2",
      styleString:
        "font-size:12px; color:var(--ios-text-secondary); font-weight:600;",
    }),
  );
  const horizonSelect = ui_createElement("select", {
    styleString:
      "padding:3px 6px; font-size:var(--ax-fs-md); font-weight:var(--ax-fw-bold); border:1px solid var(--ax-border);" +
      " border-radius:6px; background:var(--ax-bg-input); color:var(--ax-fg);" +
      " font-family:inherit; cursor:pointer; outline:none;",
  }) as HTMLSelectElement;
  for (const opt of BETA_HORIZONS) {
    const option = document.createElement("option");
    option.value = opt.key;
    option.textContent = opt.label;
    if (opt.key === betaHorizon) option.selected = true;
    horizonSelect.appendChild(option);
  }
  horizonSelect.addEventListener("change", () => {
    const next = horizonSelect.value as BetaHorizon;
    if (betaHorizon === next) return;
    betaHorizon = next;
    renderedKeyList = "";
    renderAll(latestPayload);
  });
  horizonGroup.appendChild(horizonSelect);

  controlsRow.appendChild(profileGroup);
  controlsRow.appendChild(divider());
  controlsRow.appendChild(recalculateBtn);
  // Spacer pushes β selector to the right
  controlsRow.appendChild(ui_createElement("div", { styleString: "flex:1;" }));
  controlsRow.appendChild(horizonGroup);
  // Privacy button removed — share mode is now global (header button)
  controlsBar.appendChild(controlsRow);

  const tableContainer = ui_createElement("div", {
    styleString: "min-width:0; overflow-x:auto;",
  });
  tablePane.appendChild(controlsBar);
  tablePane.appendChild(tableContainer);
  mainContent.appendChild(tablePane);

  // ── Trade Suggestions (right, 1/5 width) ──
  let tradesBody: HTMLElement | null = null;
  if (showTradeSuggestions) {
    const tradesColumn = ui_createElement("div", {
      styleString:
        "flex:1; min-width:180px; display:flex; flex-direction:column;" +
        " border-left:1px solid var(--ios-border);",
    });
    tradesColumn.appendChild(
      ui_createElement("span", {
        text: "Trade Suggestions",
        styleString:
          "font-size:13px; font-weight:600; color:var(--ios-text-primary); padding:8px 10px 4px;",
      }),
    );
    tradesBody = ui_createElement("div", {
      styleString:
        "display:flex; flex-direction:column; gap:6px; padding:4px 10px 8px; overflow-y:auto; flex:1;",
    });
    tradesColumn.appendChild(tradesBody);
    mainContent.appendChild(tradesColumn);
  }

  panel.appendChild(mainContent);

  // ── State ──
  // Share mode derived helpers — read from global state
  const isMetricMasked = (m: RebalanceAnchorMode): boolean =>
    getShareMode() === "dollarOff" && PRIVACY_HIDDEN_METRICS.has(m);
  const isGreekMasked = (m: RebalanceModeId): boolean =>
    getShareMode() === "dollarOff" && PRIVACY_HIDDEN_GREEKS.has(m);
  const getDisplayMultiplier = (m: RebalanceModeId): number => {
    const mode = getShareMode();
    if (!MAGNIFIED_MODES.has(m)) return 1;
    if (mode === "10x") return 10;
    if (mode === "custom") return getCustomMultiplier();
    return 1;
  };
  const MASKED_TEXT = "****";
  const getVisibleMetricGroups = (): RebalanceAnchorMode[] => METRIC_GROUPS;
  const getVisibleGreekModes = (): RebalanceModeId[] => GREEK_MODES;
  let selfTriggeredUpdate = false;
  // Per-underlying, per-anchor-mode input elements
  const inputsByKey = new Map<
    string,
    Map<RebalanceAnchorMode, HTMLInputElement>
  >();
  // Which anchor mode is active per underlying
  const anchorByKey = new Map<string, RebalanceAnchorMode>();
  const dirtyKeys = new Set<string>();
  // DOM refs for incremental updates
  const curRefs = new Map<string, HTMLElement>();
  const tgtRefs = new Map<string, HTMLElement>();
  const devRefs = new Map<string, HTMLElement>();
  const priceRefs = new Map<string, HTMLElement>();
  const totalCurRefs = new Map<RebalanceModeId, HTMLElement>();
  const totalTgtRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  const totalDevRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  // Sub-total refs for grouped sections
  const eqTotalCurRefs = new Map<RebalanceModeId, HTMLElement>();
  const eqTotalTgtRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  const eqTotalDevRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  const etfTotalCurRefs = new Map<RebalanceModeId, HTMLElement>();
  const etfTotalTgtRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  const etfTotalDevRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  const watchlistTotalCurRefs = new Map<RebalanceModeId, HTMLElement>();
  const watchlistTotalTgtRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  const watchlistTotalDevRefs = new Map<RebalanceAnchorMode, HTMLElement>();
  let lastEquityKeys: string[] = [];
  let lastEtfKeys: string[] = [];
  let lastWatchlistKeys: string[] = [];
  let renderedKeyList = "";
  let sortKey: SortKey | null = null;
  let sortAsc = true;
  let lastTargetsHash = "";
  let lastProfilesHash = "";
  let selectedProfileId = "";

  const {
    parseAnchorInputValue,
    getAllKeys,
    saveUnderlyingTarget,
    handleTargetInput,
    updateAnchorVisuals,
  } = createTargetEditing({
    inputsByKey,
    anchorByKey,
    dirtyKeys,
    devRefs,
    profileSelect,
    getLatestPayload: () => latestPayload,
    getBetaHorizon: () => betaHorizon,
    getSelectedProfileId: () => selectedProfileId,
    setSelectedProfileId: (s) => {
      selectedProfileId = s;
    },
    setSelfTriggeredUpdate: (b) => {
      selfTriggeredUpdate = b;
    },
    setLastTargetsHash: (s) => {
      lastTargetsHash = s;
    },
    getDisplayMultiplier,
  });

  const { syncProfileControls } = setupProfileActions({
    profileSelect,
    saveProfileBtn,
    loadProfileBtn,
    deleteProfileBtn,
    exportSelectedBtn,
    exportAllBtn,
    importFileBtn,
    inputsByKey,
    anchorByKey,
    dirtyKeys,
    getLatestPayload: () => latestPayload,
    setLatestPayload: (p) => {
      latestPayload = p;
    },
    getBetaHorizon: () => betaHorizon,
    getSelectedProfileId: () => selectedProfileId,
    setSelectedProfileId: (s) => {
      selectedProfileId = s;
    },
    getLastProfilesHash: () => lastProfilesHash,
    setLastProfilesHash: (s) => {
      lastProfilesHash = s;
    },
    setSelfTriggeredUpdate: (b) => {
      selfTriggeredUpdate = b;
    },
    setLastTargetsHash: (s) => {
      lastTargetsHash = s;
    },
    setRenderedKeyList: (s) => {
      renderedKeyList = s;
    },
    parseAnchorInputValue,
    renderAll: (p) => renderAll(p),
  });

  const maskConfig: MaskConfig = {
    isMetricMasked,
    isGreekMasked,
    getDisplayMultiplier,
    MASKED_TEXT,
  };

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
    renderedKeyList = ""; // force rebuild
    renderMetrics(latestPayload);
  }

  // ── Section helpers for equity/ETF grouping ──
  // buildRepeatedHeaderRows, buildSummaryRow, updateSummaryRefs are in rebalanceTableHelpers.ts

  // ── Build unified metrics table ──
  function buildTable(p: Payload) {
    buildRebalanceTable(
      {
        tableContainer,
        curRefs,
        tgtRefs,
        devRefs,
        priceRefs,
        totalCurRefs,
        totalTgtRefs,
        totalDevRefs,
        eqTotalCurRefs,
        eqTotalTgtRefs,
        eqTotalDevRefs,
        etfTotalCurRefs,
        etfTotalTgtRefs,
        etfTotalDevRefs,
        watchlistTotalCurRefs,
        watchlistTotalTgtRefs,
        watchlistTotalDevRefs,
        inputsByKey,
        anchorByKey,
        setLastEquityKeys: (k) => {
          lastEquityKeys = k;
        },
        setLastEtfKeys: (k) => {
          lastEtfKeys = k;
        },
        setLastWatchlistKeys: (k) => {
          lastWatchlistKeys = k;
        },
        setRenderedKeyList: (s) => {
          renderedKeyList = s;
        },
        setLastTargetsHash: (s) => {
          lastTargetsHash = s;
        },
        getBetaHorizon: () => betaHorizon,
        getSortKey: () => sortKey,
        getSortAsc: () => sortAsc,
        maskConfig,
        MASKED_TEXT,
        getAllKeys,
        getVisibleMetricGroups,
        getVisibleGreekModes,
        isMetricMasked,
        isGreekMasked,
        getDisplayMultiplier,
        handleSort,
        handleTargetInput,
        saveUnderlyingTarget,
        updateAnchorVisuals,
      },
      p,
    );
  }

  // ── Incremental update (patches current, linked targets, deviations; preserves anchor inputs) ──
  function updateIncremental(p: Payload) {
    updateRebalanceIncremental(
      {
        priceRefs,
        curRefs,
        devRefs,
        anchorByKey,
        inputsByKey,
        dirtyKeys,
        totalCurRefs,
        totalTgtRefs,
        totalDevRefs,
        eqTotalCurRefs,
        eqTotalTgtRefs,
        eqTotalDevRefs,
        etfTotalCurRefs,
        etfTotalTgtRefs,
        etfTotalDevRefs,
        watchlistTotalCurRefs,
        watchlistTotalTgtRefs,
        watchlistTotalDevRefs,
        getBetaHorizon: () => betaHorizon,
        getLastEquityKeys: () => lastEquityKeys,
        getLastEtfKeys: () => lastEtfKeys,
        getLastWatchlistKeys: () => lastWatchlistKeys,
        isMetricMasked,
        isGreekMasked,
        getDisplayMultiplier,
        getAllKeys,
        maskConfig,
        MASKED_TEXT,
      },
      p,
    );
  }

  // ── Orchestrator: decide full rebuild vs incremental ──
  function renderMetrics(p: Payload) {
    const keys = getAllKeys(p);
    const keyList = keys.join(",");
    const targetsHash = JSON.stringify(p.rebalanceTargets ?? {});

    let settingsChanged = targetsHash !== lastTargetsHash;
    if (selfTriggeredUpdate) {
      selfTriggeredUpdate = false;
      settingsChanged = false;
    }

    const needsRebuild = keyList !== renderedKeyList || settingsChanged;
    if (needsRebuild) {
      if (settingsChanged) inputsByKey.clear();
      buildTable(p);
    } else {
      updateIncremental(p);
    }
  }

  // ── Trade suggestions renderer ──
  const renderTrades = (p: Payload) => {
    if (!tradesBody) return;
    tradesBody.innerHTML = "";
    const result = buildTradeSuggestions(p, betaHorizon);
    tradesBody.appendChild(
      renderTradeSuggestions(result, getShareMode() === "dollarOff", getShareMode() === "custom" ? getCustomMultiplier() : getShareMode() === "10x" ? 10 : 1),
    );
  };

  // ── Render all ──
  const renderAll = (p: Payload) => {
    latestPayload = p;
    syncProfileControls(p);
    renderMetrics(p);
    renderTrades(p);
  };

  renderAll(payload);

  panel.update = (next: Payload) => {
    renderAll(next);
  };
  panel.cleanup = () => {
    dirtyKeys.forEach((key) => saveUnderlyingTarget(key));
    unsubShareMode();
  };

  return panel;
}
