import { ui_createElement } from "../../../components/core/createElement";
import { DS_BUTTONS, DS_COMPONENTS, DS_TYPOGRAPHY, DS_COLORS } from "../../../components/core/theme";
import {
  extractModeCurrentValues,
  computeLinkedTargets,
  REBALANCE_MODES,
} from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type { LinkedTargetValues } from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type{
  RebalanceAnchorMode,
  RebalanceModeId,
  RebalanceProfile,
  RebalanceTargetEntry,
  RebalanceTargets,
} from "../../../../shared/types/core";
import type { BetaHorizon } from "../../../../backend/computation/beta/types";

import {
  type Payload,
  type SortKey,
  BETA_HORIZONS,
  CURRENT_MODES,
  TARGET_MODES,
  DEVIATION_MODES,
  METRIC_GROUPS,
  GREEK_MODES,
  PRIVACY_HIDDEN_METRICS,
  PRIVACY_HIDDEN_GREEKS,
  MAGNIFIED_MODES,
  MAX_REBALANCE_PROFILES,
  thStyle,
  tdStyle,
  tableStyle,
  cellInputStyle,
  deviationColor,
  formatTargetInputValue,
  normalizeSymbolKey,
  resolveQuoteLastPrice,
  cloneTargets,
  resolveAllLinkedTargets,
  buildAutoProfileName,
} from "./rebalanceTypes";
import {
  getShareMode,
  getCustomMultiplier,
  onShareModeChange,
} from "../../../../shared/utils/globalShareMode";
import {
  buildTradeSuggestions,
  renderTradeSuggestions,
} from "./rebalanceSuggestions";
import { downloadProfiles, parseImportedProfiles } from "./rebalanceProfileIO";
import {
  type MaskConfig,
  buildRepeatedHeaderRows,
  buildSummaryRow,
  updateSummaryRefs,
  curSpanStyle,
  devSpanStyle,
  groupBorderStyle,
  curCellStyle,
  tgtCellStyle,
  devCellStyle,
} from "./rebalanceTableHelpers";

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
      " font-size:12px; border:1px solid var(--ios-border); border-radius:8px;" +
      " background:rgba(255,255,255,0.92); color:var(--ios-text-primary);",
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
      "width:100px; padding:4px 8px; font-size:12px; border:1px solid var(--ios-border); border-radius:6px; background:rgba(255,255,255,0.92); color:var(--ios-text-primary); font-family:inherit; outline:none;",
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
      "display:flex; flex-direction:column; gap:6px; padding:8px; border-radius:8px;" +
      " border:1px solid var(--ios-border); background:rgba(255,255,255,0.55);",
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
      "padding:3px 6px; font-size:12px; font-weight:700; border:1px solid var(--ios-border);" +
      " border-radius:6px; background:rgba(255,255,255,0.92); color:var(--ios-text-primary);" +
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

  function listProfiles(p: Payload): RebalanceProfile[] {
    return [...(p.rebalanceProfiles ?? [])].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  function collectCurrentTargets(): RebalanceTargets {
    const result: RebalanceTargets = {};
    anchorByKey.forEach((anchor, key) => {
      const inputs = inputsByKey.get(key);
      if (!inputs) return;
      const input = inputs.get(anchor);
      if (!input) return;
      const v = parseAnchorInputValue(anchor, input.value);
      if (v != null) result[key] = { anchor, value: v };
    });
    return result;
  }

  function setButtonEnabled(btn: HTMLButtonElement, enabled: boolean): void {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? "1" : "0.5";
    btn.style.cursor = enabled ? "pointer" : "not-allowed";
  }

  function syncProfileControls(p: Payload): void {
    const profiles = listProfiles(p);
    const profileHash = profiles
      .map((x) => `${x.id}|${x.name}|${x.createdAt}`)
      .join("||");

    if (profileHash !== lastProfilesHash) {
      profileSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent =
        profiles.length > 0 ? "Portfolio ..." : "No portfolio saved";
      profileSelect.appendChild(placeholder);
      profiles.forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        profileSelect.appendChild(option);
      });
      lastProfilesHash = profileHash;
    }

    if (
      selectedProfileId &&
      !profiles.some((profile) => profile.id === selectedProfileId)
    ) {
      selectedProfileId = "";
    }
    if (!selectedProfileId && profiles.length > 0) {
      selectedProfileId = profiles[0].id;
    }
    profileSelect.value = selectedProfileId || "";

    const hasSelection = selectedProfileId.length > 0;
    setButtonEnabled(loadProfileBtn, hasSelection);
    setButtonEnabled(deleteProfileBtn, hasSelection);
    setButtonEnabled(exportAllBtn, profiles.length > 0);
    setButtonEnabled(exportSelectedBtn, hasSelection);
  }

  function parseAnchorInputValue(
    mode: RebalanceAnchorMode,
    rawValue: string,
  ): number | null {
    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) return null;
    const config = REBALANCE_MODES[mode];
    if (config.isPct && (value < 0 || value > 100)) return null;
    // Reverse the display multiplier so persisted value is always 1x
    const mul = getDisplayMultiplier(mode);
    const real = mul !== 1 ? value / mul : value;
    return Math.round(real * 100) / 100;
  }

  function getAllKeys(p: Payload): string[] {
    const keys = new Set<string>(Object.keys(p.derived.byUnderlying ?? {}));
    if (p.rebalanceTargets) {
      for (const k of Object.keys(p.rebalanceTargets)) keys.add(k);
    }
    if (p.extraBetaTickers) {
      for (const k of p.extraBetaTickers) keys.add(k);
    }
    return [...keys].sort();
  }

  function saveUnderlyingTarget(key: string): void {
    const anchor = anchorByKey.get(key);
    const inputs = inputsByKey.get(key);
    if (!anchor || !inputs) return;

    const anchorInput = inputs.get(anchor);
    if (!anchorInput) return;
    const v = parseAnchorInputValue(anchor, anchorInput.value);

    selfTriggeredUpdate = true;
    const merged: RebalanceTargets = {
      ...(latestPayload.rebalanceTargets ?? {}),
    };
    if (v != null) {
      merged[key] = { anchor, value: v };
    } else {
      delete merged[key];
      anchorByKey.delete(key);
    }
    lastTargetsHash = JSON.stringify(merged);
    latestPayload.onUpdateRebalanceTargets?.(merged);
    dirtyKeys.delete(key);
  }

  /** When user types in a target input, update linked values. */
  function handleTargetInput(
    key: string,
    editedMode: RebalanceAnchorMode,
  ): void {
    const inputs = inputsByKey.get(key);
    if (!inputs) return;
    const editedInput = inputs.get(editedMode);
    if (!editedInput) return;
    const v = parseAnchorInputValue(editedMode, editedInput.value);

    // User modified targets — deselect loaded profile
    if (selectedProfileId) {
      selectedProfileId = "";
      profileSelect.value = "";
    }

    if (v == null) {
      // User cleared the field — clear all linked fields and anchor
      TARGET_MODES.forEach((m) => {
        if (m !== editedMode) {
          const inp = inputs.get(m);
          if (inp) inp.value = "";
        }
      });
      anchorByKey.delete(key);
      updateAnchorVisuals(key);
      updateDeviationCells(key, null);
      dirtyKeys.add(key);
      return;
    }

    anchorByKey.set(key, editedMode);
    dirtyKeys.add(key);

    const entry: RebalanceTargetEntry = { anchor: editedMode, value: v };
    const price = resolveQuoteLastPrice(key, latestPayload) ?? 0;
    const betaRaw = latestPayload.betaData?.get(key)?.[betaHorizon]?.beta;
    const beta =
      typeof betaRaw === "number" && Number.isFinite(betaRaw) ? betaRaw : 1;
    const acctVal = latestPayload.derived.portfolioAgg?.netMarketValue ?? 1;

    const linked = computeLinkedTargets(entry, price, beta, acctVal);

    // Fill other inputs with derived values (display-multiplied)
    TARGET_MODES.forEach((m) => {
      if (m === editedMode) return;
      const inp = inputs.get(m);
      if (inp) {
        const config = REBALANCE_MODES[m];
        const mul = getDisplayMultiplier(m);
        inp.value = formatTargetInputValue(linked[m] * mul, config.isPct);
      }
    });

    updateAnchorVisuals(key);
    updateDeviationCells(key, linked);
  }

  function updateAnchorVisuals(key: string): void {
    const anchor = anchorByKey.get(key);
    const inputs = inputsByKey.get(key);
    if (!inputs) return;
    TARGET_MODES.forEach((m) => {
      const inp = inputs.get(m);
      if (!inp) return;
      if (m === anchor) {
        inp.style.cssText =
          cellInputStyle +
          " border-color:var(--ios-blue); background:rgba(0,122,255,0.06);";
      } else {
        inp.style.cssText = cellInputStyle;
      }
    });
  }

  function updateDeviationCells(
    key: string,
    linked: LinkedTargetValues | null,
  ): void {
    DEVIATION_MODES.forEach((mode) => {
      const devEl = devRefs.get(`${mode}:${key}`);
      if (!devEl) return;
      if (!linked) {
        devEl.textContent = "-";
        devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
        return;
      }
      const curMap = extractModeCurrentValues(
        mode,
        latestPayload.derived,
        latestPayload.betaData,
        betaHorizon,
      );
      const cur = curMap.get(key) ?? 0;
      const tgt = linked[mode];
      const dev = cur - tgt;
      const mul = getDisplayMultiplier(mode);
      devEl.textContent =
        (dev >= 0 ? "+" : "") + REBALANCE_MODES[mode].formatValue(dev * mul);
      devEl.style.cssText = devSpanStyle(deviationColor(dev));
    });
  }

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
    tableContainer.innerHTML = "";
    curRefs.clear();
    tgtRefs.clear();
    devRefs.clear();
    priceRefs.clear();
    totalCurRefs.clear();
    totalTgtRefs.clear();
    totalDevRefs.clear();
    eqTotalCurRefs.clear();
    eqTotalTgtRefs.clear();
    eqTotalDevRefs.clear();
    etfTotalCurRefs.clear();
    etfTotalTgtRefs.clear();
    etfTotalDevRefs.clear();
    watchlistTotalCurRefs.clear();
    watchlistTotalTgtRefs.clear();
    watchlistTotalDevRefs.clear();

    const keys = getAllKeys(p);
    renderedKeyList = keys.join(",");
    lastTargetsHash = JSON.stringify(p.rebalanceTargets ?? {});

    // Compute current values for all display modes
    const curValues = new Map<RebalanceModeId, Map<string, number>>();
    CURRENT_MODES.forEach((m) =>
      curValues.set(
        m,
        extractModeCurrentValues(m, p.derived, p.betaData, betaHorizon),
      ),
    );

    // Resolve linked targets for all underlyings
    const linked = resolveAllLinkedTargets(p.rebalanceTargets, p, betaHorizon);

    // Populate anchor state from persisted targets
    anchorByKey.clear();
    if (p.rebalanceTargets) {
      for (const [key, entry] of Object.entries(p.rebalanceTargets)) {
        anchorByKey.set(key, entry.anchor);
      }
    }

    // Sort keys
    const sortedKeys = [...keys];
    if (sortKey) {
      const sk = sortKey;
      const dir = sortAsc ? 1 : -1;
      if (sk === "underlying") {
        sortedKeys.sort((a, b) => a.localeCompare(b) * dir);
      } else if (sk.startsWith("tgt:")) {
        const mode = sk.slice(4) as RebalanceAnchorMode;
        sortedKeys.sort(
          (a, b) =>
            ((linked.get(a)?.[mode] ?? 0) - (linked.get(b)?.[mode] ?? 0)) * dir,
        );
      } else if (sk.startsWith("dev:")) {
        const mode = sk.slice(4) as RebalanceAnchorMode;
        sortedKeys.sort((a, b) => {
          const curA = curValues.get(mode)?.get(a) ?? 0;
          const curB = curValues.get(mode)?.get(b) ?? 0;
          const devA = (linked.get(a)?.[mode] ?? curA) - curA;
          const devB = (linked.get(b)?.[mode] ?? curB) - curB;
          return (devA - devB) * dir;
        });
      } else if (sk === "_beta") {
        sortedKeys.sort((a, b) => {
          const bA = p.betaData?.get(a)?.[betaHorizon]?.beta ?? 0;
          const bB = p.betaData?.get(b)?.[betaHorizon]?.beta ?? 0;
          return (bA - bB) * dir;
        });
      } else {
        const vals = curValues.get(sk as RebalanceModeId);
        sortedKeys.sort(
          (a, b) => ((vals?.get(a) ?? 0) - (vals?.get(b) ?? 0)) * dir,
        );
      }
    }

    const table = document.createElement("table");
    table.style.cssText =
      tableStyle +
      " border-collapse:collapse; table-layout:auto; width:max-content; min-width:100%;";

    // ── thead ──
    const thead = document.createElement("thead");

    // ── Group header row (metric names) ──
    const visibleMetrics = getVisibleMetricGroups();
    const visibleGreeks = getVisibleGreekModes();

    const groupRow = document.createElement("tr");
    const emptyTh = document.createElement("th");
    emptyTh.colSpan = 2; // Ticker + Price
    emptyTh.style.cssText = thStyle + " padding:2px 4px;";
    groupRow.appendChild(emptyTh);

    visibleMetrics.forEach((m) => {
      const gh = document.createElement("th");
      gh.colSpan = 3; // Current, Target, Deviation
      gh.textContent = REBALANCE_MODES[m].shortLabel;
      gh.style.cssText =
        thStyle +
        " text-align:center; font-size:11px; padding:2px 4px; letter-spacing:0.5px;" +
        groupBorderStyle;
      groupRow.appendChild(gh);
    });

    const greekGroupTh = document.createElement("th");
    greekGroupTh.colSpan = visibleGreeks.length + 1; // +1 for β
    greekGroupTh.textContent = "Greeks";
    greekGroupTh.style.cssText =
      thStyle +
      " text-align:center; font-size:11px; padding:2px 4px; letter-spacing:0.5px;" +
      groupBorderStyle;
    groupRow.appendChild(greekGroupTh);

    thead.appendChild(groupRow);

    // ── Sub-header row (C/T/D labels + Greek labels) ──
    const lr = document.createElement("tr");
    // Ticker header
    const ulTh = document.createElement("th");
    const ulArrow =
      sortKey === "underlying" ? (sortAsc ? " \u25B2" : " \u25BC") : "";
    ulTh.textContent = "Ticker" + ulArrow;
    ulTh.style.cssText =
      thStyle +
      " width:60px; min-width:60px; font-size:11px; padding:3px 6px; cursor:pointer; user-select:none;";
    ulTh.addEventListener("click", () => handleSort("underlying"));
    lr.appendChild(ulTh);

    // Price header
    const priceTh = document.createElement("th");
    priceTh.textContent = "Price";
    priceTh.style.cssText =
      thStyle +
      " min-width:52px; font-size:11px; padding:3px 4px; text-align:right;";
    lr.appendChild(priceTh);

    // Per-metric sub-headers: current, target, dev (all sortable)
    const sortableThStyle =
      thStyle +
      " min-width:52px; font-size:11px; padding:3px 4px; text-align:right; cursor:pointer; user-select:none;";
    visibleMetrics.forEach((m) => {
      const cArrow = sortKey === m ? (sortAsc ? " \u25B2" : " \u25BC") : "";
      const cTh = document.createElement("th");
      cTh.textContent = "current" + cArrow;
      cTh.title = REBALANCE_MODES[m].label + " current (click to sort)";
      cTh.style.cssText = sortableThStyle + groupBorderStyle;
      cTh.addEventListener("click", () => handleSort(m));
      lr.appendChild(cTh);

      const tKey: SortKey = `tgt:${m}`;
      const tArrow = sortKey === tKey ? (sortAsc ? " \u25B2" : " \u25BC") : "";
      const tTh = document.createElement("th");
      tTh.textContent = "target" + tArrow;
      tTh.title = REBALANCE_MODES[m].label + " target (click to sort)";
      tTh.style.cssText = sortableThStyle;
      tTh.addEventListener("click", () => handleSort(tKey));
      lr.appendChild(tTh);

      const dKey: SortKey = `dev:${m}`;
      const dArrow = sortKey === dKey ? (sortAsc ? " \u25B2" : " \u25BC") : "";
      const dTh = document.createElement("th");
      dTh.textContent = "dev" + dArrow;
      dTh.title = REBALANCE_MODES[m].label + " deviation (click to sort)";
      dTh.style.cssText = sortableThStyle;
      dTh.addEventListener("click", () => handleSort(dKey));
      lr.appendChild(dTh);
    });

    // Beta (raw) header — first in Greeks group (sortable)
    const betaArrow =
      sortKey === "_beta" ? (sortAsc ? " \u25B2" : " \u25BC") : "";
    const betaTh = document.createElement("th");
    betaTh.textContent = "\u03B2" + betaArrow;
    betaTh.title = "Beta (click to sort)";
    betaTh.style.cssText =
      thStyle +
      " min-width:42px; font-size:11px; padding:3px 4px; text-align:right; cursor:pointer; user-select:none;" +
      groupBorderStyle;
    betaTh.addEventListener("click", () => handleSort("_beta"));
    lr.appendChild(betaTh);

    // Greek sub-headers (each sortable)
    visibleGreeks.forEach((m) => {
      const arrow = sortKey === m ? (sortAsc ? " \u25B2" : " \u25BC") : "";
      const th = document.createElement("th");
      th.textContent = REBALANCE_MODES[m].shortLabel + arrow;
      th.title = REBALANCE_MODES[m].label + " (click to sort)";
      th.style.cssText =
        thStyle +
        " min-width:48px; font-size:11px; padding:3px 4px; text-align:right; cursor:pointer; user-select:none;";
      th.addEventListener("click", () => handleSort(m));
      lr.appendChild(th);
    });

    thead.appendChild(lr);
    table.appendChild(thead);

    // ── tbody ──
    const tbody = document.createElement("tbody");
    const byU = p.derived.byUnderlying ?? {};

    // Partition into equity/ETF/watchlist groups
    const etfSet = p.etfUnderlyingKeys ?? new Set<string>();
    const holdingKeys = new Set<string>(Object.keys(byU));
    const equityKeys: string[] = [];
    const etfKeys: string[] = [];
    const watchlistKeys: string[] = [];
    for (const key of sortedKeys) {
      if (!holdingKeys.has(key)) {
        watchlistKeys.push(key);
      } else if (etfSet.has(key)) {
        etfKeys.push(key);
      } else {
        equityKeys.push(key);
      }
    }
    lastEquityKeys = equityKeys;
    lastEtfKeys = etfKeys;
    lastWatchlistKeys = watchlistKeys;
    const hasBothGroups = equityKeys.length > 0 && etfKeys.length > 0;
    const hasWatchlist = watchlistKeys.length > 0;

    function appendDataRow(key: string, zebraIdx: number) {
      const tr = document.createElement("tr");
      if (zebraIdx % 2 === 1) tr.style.background = "rgba(0,0,0,0.02)";

      // Ticker cell
      const tdSym = document.createElement("td");
      tdSym.textContent = key;
      tdSym.style.cssText =
        tdStyle +
        " width:60px; min-width:60px; font-weight:600; font-size:13px; padding:3px 6px; white-space:nowrap;";
      tr.appendChild(tdSym);

      // Price cell
      const priceVal = resolveQuoteLastPrice(key, p);
      const priceText =
        typeof priceVal === "number" && Number.isFinite(priceVal)
          ? "$" + priceVal.toFixed(2)
          : "-";
      const tdPrice = document.createElement("td");
      tdPrice.textContent = priceText;
      tdPrice.style.cssText =
        curCellStyle +
        " text-align:right; font-size:12px; color:var(--ios-text-secondary); font-variant-numeric:tabular-nums;";
      priceRefs.set(key, tdPrice);
      tr.appendChild(tdPrice);

      // Per-metric groups: Current, Target, Deviation for each visible metric
      const lt = linked.get(key);
      const hasTarget = !!lt;
      const keyInputs = new Map<RebalanceAnchorMode, HTMLInputElement>();

      visibleMetrics.forEach((mode) => {
        const config = REBALANCE_MODES[mode];
        const masked = isMetricMasked(mode);
        const mul = getDisplayMultiplier(mode);

        // Current value cell
        const cur = curValues.get(mode)?.get(key) ?? 0;
        const tdCur = document.createElement("td");
        tdCur.style.cssText =
          curCellStyle + " text-align:right;" + groupBorderStyle;
        const curEl = document.createElement("span");
        curEl.textContent = masked
          ? MASKED_TEXT
          : config.formatValue(cur * mul);
        curEl.style.cssText = curSpanStyle;
        curRefs.set(`${mode}:${key}`, curEl);
        tdCur.appendChild(curEl);
        tr.appendChild(tdCur);

        // Target input cell
        const tdTgt = document.createElement("td");
        tdTgt.style.cssText = tgtCellStyle;

        if (masked) {
          const maskedSpan = document.createElement("span");
          maskedSpan.textContent = MASKED_TEXT;
          maskedSpan.style.cssText =
            "font-size:12px; color:var(--ios-text-secondary);";
          tdTgt.appendChild(maskedSpan);
        } else {
          let input = inputsByKey.get(key)?.get(mode);
          if (!input) {
            input = document.createElement("input");
            input.type = "number";
            input.step = config.isPct ? "0.5" : "any";
            if (config.isPct) {
              input.min = "0";
              input.max = "100";
            }
            input.placeholder = "\u2014";

            const capturedMode = mode;
            const capturedKey = key;
            input.addEventListener("input", () => {
              handleTargetInput(capturedKey, capturedMode);
            });
            input.addEventListener("change", () => {
              saveUnderlyingTarget(capturedKey);
            });
          }

          if (hasTarget) {
            input.value = formatTargetInputValue(
              lt[mode] * mul,
              config.isPct,
            );
          } else {
            input.value = "";
          }
          input.style.cssText = cellInputStyle;
          keyInputs.set(mode, input);
          tdTgt.appendChild(input);
        }
        tr.appendChild(tdTgt);

        // Deviation cell
        const tdDev = document.createElement("td");
        tdDev.style.cssText = devCellStyle + " text-align:right;";
        const devEl = document.createElement("span");

        if (masked) {
          devEl.textContent = MASKED_TEXT;
          devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
        } else if (hasTarget) {
          const tgt = lt[mode];
          const dev = cur - tgt;
          devEl.textContent =
            (dev >= 0 ? "+" : "") + config.formatValue(dev * mul);
          devEl.style.cssText = devSpanStyle(deviationColor(dev));
        } else {
          devEl.textContent = "-";
          devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
        }
        devRefs.set(`${mode}:${key}`, devEl);
        tdDev.appendChild(devEl);
        tr.appendChild(tdDev);
      });
      inputsByKey.set(key, keyInputs);
      updateAnchorVisuals(key);

      // Beta (raw) cell — first in Greeks group
      const betaRaw = p.betaData?.get(key)?.[betaHorizon]?.beta;
      const betaVal =
        typeof betaRaw === "number" && Number.isFinite(betaRaw)
          ? betaRaw
          : null;
      const tdBeta = document.createElement("td");
      tdBeta.textContent = betaVal != null ? betaVal.toFixed(2) : "-";
      tdBeta.style.cssText =
        curCellStyle +
        " text-align:right; font-size:12px; color:var(--ios-text-secondary); font-variant-numeric:tabular-nums;" +
        groupBorderStyle;
      curRefs.set(`_beta:${key}`, tdBeta);
      tr.appendChild(tdBeta);

      // Greeks (current only, masked in privacy mode)
      visibleGreeks.forEach((mode) => {
        const config = REBALANCE_MODES[mode];
        const cur = curValues.get(mode)?.get(key) ?? 0;
        const td = document.createElement("td");
        td.style.cssText = curCellStyle + " text-align:right;";
        const curEl = document.createElement("span");
        curEl.textContent = isGreekMasked(mode)
          ? MASKED_TEXT
          : config.formatValue(cur * getDisplayMultiplier(mode));
        curEl.style.cssText = curSpanStyle;
        curRefs.set(`${mode}:${key}`, curEl);
        td.appendChild(curEl);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }

    if (hasBothGroups || hasWatchlist) {
      let hasRenderedSection = false;

      const appendGroupedSection = (
        sectionKeys: string[],
        summaryLabel: string,
        curRefMap: Map<RebalanceModeId, HTMLElement>,
        tgtRefMap: Map<RebalanceAnchorMode, HTMLElement>,
        devRefMap: Map<RebalanceAnchorMode, HTMLElement>,
      ) => {
        if (sectionKeys.length === 0) return;
        if (hasRenderedSection) {
          const [repeatGroupRow, repeatSubRow] = buildRepeatedHeaderRows(
            visibleMetrics,
            visibleGreeks,
          );
          tbody.appendChild(repeatGroupRow);
          tbody.appendChild(repeatSubRow);
        }
        sectionKeys.forEach((key, i) => appendDataRow(key, i));
        tbody.appendChild(
          buildSummaryRow(
            summaryLabel,
            sectionKeys,
            curValues,
            linked,
            "border-top:2px solid var(--ios-border); background:rgba(0,0,0,0.05); font-weight:700;",
            curRefMap,
            tgtRefMap,
            devRefMap,
            maskConfig,
            visibleMetrics,
            visibleGreeks,
          ),
        );
        hasRenderedSection = true;
      };

      if (equityKeys.length > 0) {
        appendGroupedSection(
          equityKeys,
          "Equities Summary",
          eqTotalCurRefs,
          eqTotalTgtRefs,
          eqTotalDevRefs,
        );
      }

      if (etfKeys.length > 0) {
        appendGroupedSection(
          etfKeys,
          "ETFs Summary",
          etfTotalCurRefs,
          etfTotalTgtRefs,
          etfTotalDevRefs,
        );
      }

      if (hasWatchlist) {
        appendGroupedSection(
          watchlistKeys,
          "Watchlist Summary",
          watchlistTotalCurRefs,
          watchlistTotalTgtRefs,
          watchlistTotalDevRefs,
        );
      }
    } else {
      sortedKeys.forEach((key, i) => appendDataRow(key, i));
    }

    table.appendChild(tbody);

    // ── tfoot — grand total row ──
    const tfoot = document.createElement("tfoot");
    const totalTr = buildSummaryRow(
      "Total",
      sortedKeys,
      curValues,
      linked,
      "border-top:2px solid var(--ios-border);",
      totalCurRefs,
      totalTgtRefs,
      totalDevRefs,
      maskConfig,
      visibleMetrics,
      visibleGreeks,
    );
    tfoot.appendChild(totalTr);
    table.appendChild(tfoot);
    tableContainer.appendChild(table);
  }

  // ── Incremental update (patches current, linked targets, deviations; preserves anchor inputs) ──
  function updateIncremental(p: Payload) {
    const curValues = new Map<RebalanceModeId, Map<string, number>>();
    CURRENT_MODES.forEach((m) =>
      curValues.set(
        m,
        extractModeCurrentValues(m, p.derived, p.betaData, betaHorizon),
      ),
    );

    const linked = resolveAllLinkedTargets(p.rebalanceTargets, p, betaHorizon);
    const keys = getAllKeys(p);

    keys.forEach((key) => {
      // Update price
      const priceEl = priceRefs.get(key);
      if (priceEl) {
        const priceVal = resolveQuoteLastPrice(key, p);
        priceEl.textContent =
          typeof priceVal === "number" && Number.isFinite(priceVal)
            ? "$" + priceVal.toFixed(2)
            : "-";
      }

      // Update current values
      CURRENT_MODES.forEach((mode) => {
        const cur = curValues.get(mode)?.get(key) ?? 0;
        const curEl = curRefs.get(`${mode}:${key}`);
        if (!curEl) return;
        const masked = PRIVACY_HIDDEN_METRICS.has(mode as RebalanceAnchorMode)
          ? isMetricMasked(mode as RebalanceAnchorMode)
          : PRIVACY_HIDDEN_GREEKS.has(mode)
            ? isGreekMasked(mode)
            : false;
        curEl.textContent = masked
          ? MASKED_TEXT
          : REBALANCE_MODES[mode].formatValue(
              cur * getDisplayMultiplier(mode),
            );
      });

      // Update beta cell
      const betaEl = curRefs.get(`_beta:${key}`);
      if (betaEl) {
        const betaRaw = p.betaData?.get(key)?.[betaHorizon]?.beta;
        betaEl.textContent =
          typeof betaRaw === "number" && Number.isFinite(betaRaw)
            ? betaRaw.toFixed(2)
            : "-";
      }

      // Update linked target displays and deviations
      const lt = linked.get(key);
      const anchor = anchorByKey.get(key);
      const inputs = inputsByKey.get(key);

      if (lt && inputs) {
        // Update non-anchor target inputs with recomputed values
        if (!dirtyKeys.has(key)) {
          TARGET_MODES.forEach((mode) => {
            if (mode === anchor) return;
            const inp = inputs.get(mode);
            if (inp) {
              const config = REBALANCE_MODES[mode];
              const mul = getDisplayMultiplier(mode);
              inp.value = formatTargetInputValue(
                lt[mode] * mul,
                config.isPct,
              );
            }
          });
        }
      }

      // Update deviations
      DEVIATION_MODES.forEach((mode) => {
        const devEl = devRefs.get(`${mode}:${key}`);
        if (!devEl) return;
        if (isMetricMasked(mode)) {
          devEl.textContent = MASKED_TEXT;
          devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
          return;
        }
        if (!lt) {
          devEl.textContent = "-";
          devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
          return;
        }
        const cur = curValues.get(mode)?.get(key) ?? 0;
        const tgt = lt[mode];
        const dev = cur - tgt;
        const mul = getDisplayMultiplier(mode);
        devEl.textContent =
          (dev >= 0 ? "+" : "") +
          REBALANCE_MODES[mode].formatValue(dev * mul);
        devEl.style.cssText = devSpanStyle(deviationColor(dev));
      });
    });

    // Update summary rows (sub-totals + grand total)
    if (lastEquityKeys.length > 0 && eqTotalCurRefs.size > 0) {
      updateSummaryRefs(
        lastEquityKeys,
        curValues,
        linked,
        eqTotalCurRefs,
        eqTotalTgtRefs,
        eqTotalDevRefs,
        maskConfig,
      );
    }
    if (lastEtfKeys.length > 0 && etfTotalCurRefs.size > 0) {
      updateSummaryRefs(
        lastEtfKeys,
        curValues,
        linked,
        etfTotalCurRefs,
        etfTotalTgtRefs,
        etfTotalDevRefs,
        maskConfig,
      );
    }
    if (lastWatchlistKeys.length > 0 && watchlistTotalCurRefs.size > 0) {
      updateSummaryRefs(
        lastWatchlistKeys,
        curValues,
        linked,
        watchlistTotalCurRefs,
        watchlistTotalTgtRefs,
        watchlistTotalDevRefs,
        maskConfig,
      );
    }
    updateSummaryRefs(
      keys,
      curValues,
      linked,
      totalCurRefs,
      totalTgtRefs,
      totalDevRefs,
      maskConfig,
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

  const getSelectedProfile = (): RebalanceProfile | null => {
    const selectedId = selectedProfileId || profileSelect.value;
    if (!selectedId) return null;
    const profiles = latestPayload.rebalanceProfiles ?? [];
    return profiles.find((profile) => profile.id === selectedId) ?? null;
  };

  const applyTargets = (nextTargets: RebalanceTargets): void => {
    dirtyKeys.clear();
    const cloned = cloneTargets(nextTargets);
    selfTriggeredUpdate = true;
    lastTargetsHash = JSON.stringify(cloned);
    const optimisticPayload: Payload = {
      ...latestPayload,
      rebalanceTargets: cloned,
    };
    latestPayload = optimisticPayload;
    latestPayload.onUpdateRebalanceTargets?.(cloned);
    renderAll(optimisticPayload);
  };

  profileSelect.addEventListener("change", () => {
    selectedProfileId = profileSelect.value || "";
    syncProfileControls(latestPayload);
  });

  saveProfileBtn.addEventListener("click", () => {
    const ts = Date.now();
    const nextTargets = collectCurrentTargets();
    applyTargets(nextTargets);

    const profile: RebalanceProfile = {
      id: `rp_${ts}_${Math.random().toString(36).slice(2, 8)}`,
      name: buildAutoProfileName(nextTargets, latestPayload, ts, betaHorizon),
      createdAt: ts,
      rebalanceTargets: cloneTargets(nextTargets),
    };
    const currentProfiles = listProfiles(latestPayload);
    const nextProfiles = [profile, ...currentProfiles].slice(
      0,
      MAX_REBALANCE_PROFILES,
    );
    selectedProfileId = profile.id;
    latestPayload.onUpdateRebalanceProfiles?.(nextProfiles);
    renderAll({ ...latestPayload, rebalanceProfiles: nextProfiles });
  });

  loadProfileBtn.addEventListener("click", () => {
    const selected = getSelectedProfile();
    if (!selected) return;
    selectedProfileId = selected.id;
    renderedKeyList = "";
    applyTargets(selected.rebalanceTargets);
  });

  deleteProfileBtn.addEventListener("click", () => {
    const selected = getSelectedProfile();
    if (!selected) return;
    const nextProfiles = listProfiles(latestPayload).filter(
      (profile) => profile.id !== selected.id,
    );
    selectedProfileId = nextProfiles[0]?.id ?? "";
    latestPayload.onUpdateRebalanceProfiles?.(nextProfiles);
    renderAll({ ...latestPayload, rebalanceProfiles: nextProfiles });
  });

  exportAllBtn.addEventListener("click", () => {
    downloadProfiles(listProfiles(latestPayload));
  });

  exportSelectedBtn.addEventListener("click", () => {
    const selected = getSelectedProfile();
    if (!selected) return;
    downloadProfiles([selected]);
  });

  importFileBtn.addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file || file.size > 2 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const validated = parseImportedProfiles(reader.result as string);
          if (validated.length === 0) return;
          // Merge with existing profiles (dedup by createdAt timestamp)
          const existing = listProfiles(latestPayload);
          const existingTimestamps = new Set(existing.map((p) => p.createdAt));
          const merged = [
            ...existing,
            ...validated.filter((p) => !existingTimestamps.has(p.createdAt)),
          ]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, MAX_REBALANCE_PROFILES);
          latestPayload.onUpdateRebalanceProfiles?.(merged);
          renderAll({ ...latestPayload, rebalanceProfiles: merged });
        } catch {
          /* ignore malformed JSON */
        }
      };
      reader.readAsText(file);
    });
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  });

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
