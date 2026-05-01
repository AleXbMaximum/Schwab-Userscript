import { ui_createElement } from "../components/core/createElement";
import { DS_COLORS } from "../components/core/theme";
import { fetchOptionChains } from "../../backend/core/network/schwab/options";
import { logService } from "../../shared/log/core/LogService";
import { pruneLowOIExpirations } from "shared/utils/optionsChains";
import type{ OptionsChainsResponse } from "shared/types/options";
import type { MonitorController } from "../analysis_optionFlow/monitor/MonitorController";
import { DEFAULT_MONITOR_SETTINGS } from "../analysis_optionFlow/monitor/monitorSettings";
import { openAlexQuantDB } from "../../backend/core/db/core/AlexQuantDB";
import { KVStore } from "../../backend/core/db/core/KVStore";
import { ui_copyTextToClipboard } from "../components/core/clipboard";
import type { StatusDotState, ResizableComponentRef } from "./types";
import type {
  SavedViewState,
  OptionsSavedView,
  TimestampSavedView,
} from "./savedView/savedViewTypes";
import {
  normalizeScopeMode,
  decodeSavedView,
  compactChainsForCopy,
  summarizeExpirationForCopy,
  formatTimeLabel,
} from "./savedView/savedViewSerializer";
import {
  readTimestampSavedViews,
  writeTimestampSavedViews,
} from "./savedView/savedViewRepository";
import { createOptionsStore, type OptionsStore } from "./store/OptionsViewStore";
import { projectSavedViewState } from "./store/selectors";
import { clearFocusedStrike } from "./focus/focusStrike";
import { chartManager } from "frontend/charts/ChartManager";
import { orchestrateCharts } from "./chartOrchestrator";

const log = logService.namespace("options");

export function options_renderPage(
  ctx: any,
): HTMLElement & { cleanup?: () => void } {
  const wrapper = ui_createElement("div", {
    styleString: "padding: 0;",
  }) as HTMLElement & { cleanup?: () => void };

  const store: OptionsStore = createOptionsStore();

  const inputBar = ui_createElement("div", {
    styleString:
      "display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 20px;",
  });

  const symbolInput = document.createElement("input");
  symbolInput.type = "text";
  symbolInput.placeholder = "Enter symbol (e.g. NVDA)";
  symbolInput.value = "";
  symbolInput.style.cssText =
    "padding: 8px 14px; font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold); border: 1px solid var(--ax-border);" +
    " border-radius: var(--ax-radius-lg); outline: none; width: 180px; font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-input); transition: border-color 0.2s;";
  symbolInput.addEventListener("focus", () => {
    symbolInput.style.borderColor = "var(--ios-blue)";
  });
  symbolInput.addEventListener("blur", () => {
    symbolInput.style.borderColor = "var(--ios-border)";
  });

  const tickerSelect = document.createElement("select");
  tickerSelect.style.cssText =
    "padding: 8px 12px; font-size: var(--ax-fs-lg); font-weight: var(--ax-fw-semibold); border: 1px solid var(--ax-border);" +
    " border-radius: var(--ax-radius-lg); outline: none; min-width: 130px; font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-input); color: var(--ax-fg);";

  const loadBtn = ui_createElement("button", {
    text: "Load",
    styleString:
      "padding: 8px 20px; font-size: var(--ax-fs-lg); font-weight: var(--ax-fw-bold); border: none; border-radius: var(--ax-radius-lg);" +
      " background: var(--ax-blue); color: #fff; cursor: pointer; font-family: var(--ax-font-body);" +
      " transition: opacity 0.2s;",
  });

  const statusLabel = ui_createElement("span", {
    styleString: "font-size: 12px; color: var(--ios-text-secondary);",
  });

  let _latestSavedView: OptionsSavedView | null = null;
  let pendingSavedView: OptionsSavedView | null = null;
  let copyOutResetTimer: number | null = null;

  const getTickerList = (): string[] => {
    const mc = (ctx as any)?.monitorController as MonitorController | undefined;
    const monitored = mc?.getSymbols?.() ?? [];
    const source =
      monitored.length > 0 ? monitored : DEFAULT_MONITOR_SETTINGS.symbols;
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of source) {
      const symbol = String(raw ?? "")
        .trim()
        .toUpperCase();
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      unique.push(symbol);
    }
    return unique;
  };

  const renderTickerSelect = (symbolOverride?: string): void => {
    const list = getTickerList();
    const current = (symbolOverride ?? symbolInput.value).trim().toUpperCase();
    tickerSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Ticker List";
    placeholder.selected = !current;
    tickerSelect.appendChild(placeholder);

    let matched = false;
    for (const ticker of list) {
      const opt = document.createElement("option");
      opt.value = ticker;
      opt.textContent = ticker;
      if (ticker === current) {
        opt.selected = true;
        matched = true;
      }
      tickerSelect.appendChild(opt);
    }

    if (current && !matched) {
      const customOpt = document.createElement("option");
      customOpt.value = current;
      customOpt.textContent = `${current} (Manual)`;
      customOpt.selected = true;
      tickerSelect.appendChild(customOpt);
    }
  };

  const buttonStyle =
    "padding: 7px 12px; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-bold); border-radius: var(--ax-radius-lg); cursor: pointer;" +
    " border: 1px solid var(--ax-border); background: var(--ax-bg-input); color: var(--ax-fg);" +
    " font-family: var(--ax-font-body);";

  const getCurrentSymbol = (): string =>
    symbolInput.value.trim().toUpperCase() ||
    store.getState().response?.underlying.symbol?.toUpperCase() ||
    "";

  const optionsStatusDot = ((ctx as any)?.optionsStatus ??
    null) as HTMLElement | null;
  const updateStatusDot = (
    dot: HTMLElement | null,
    status: StatusDotState,
  ): void => {
    if (!dot) return;
    if (status === "active") dot.style.background = "#00aa00";
    else if (status === "refreshing") dot.style.background = "#ffcc00";
    else if (status === "error") dot.style.background = "#cc0000";
    else dot.style.background = "var(--ios-gray)";
  };
  const updateOptionsStatus = (status: StatusDotState): void => {
    updateStatusDot(optionsStatusDot, status);
  };
  updateOptionsStatus("inactive");

  const setLoadingUi = (isLoading: boolean): void => {
    loadBtn.style.opacity = isLoading ? "0.5" : "1";
    loadBtn.style.pointerEvents = isLoading ? "none" : "auto";
    refreshBtn.style.opacity = isLoading ? "0.5" : "1";
    refreshBtn.style.pointerEvents = isLoading ? "none" : "auto";
  };

  const buildSavedViewState = (): SavedViewState =>
    projectSavedViewState(store.getState());

  const applySavedViewState = (
    view: SavedViewState,
    response: OptionsChainsResponse,
  ): void => {
    const safeExpIdx = Math.max(
      0,
      Math.min(response.expirations.length - 1, view.selectedExpirationIdx),
    );
    const safeCustom = view.customExpirationIdxs
      .filter((i) => i >= 0 && i < response.expirations.length)
      .sort((a, b) => a - b);
    store.setState({
      selectedExpirationIdx: safeExpIdx,
      selectedStrikeCount: view.selectedStrikeCount,
      customExpirationIdxs: safeCustom,
      scopeMode: normalizeScopeMode((view as any).scopeMode),
      greeksBasis: view.greeksBasis,
      gammaSource: (view as any).gammaSource ?? "schwab",
      liquidityThreshold: view.liquidityThreshold,
      localWindowMode: view.localWindowMode,
      localWindowPct: view.localWindowPct ?? 10,
      localWindowDeltaRange: view.localWindowDeltaRange ?? [0.25, 0.75],
      strikeMode: view.strikeMode ?? "count",
      strikeDollarWidth: view.strikeDollarWidth ?? 50,
      liquidityPreset: view.liquidityPreset ?? "normal",
      liquidityAdvanced: view.liquidityAdvanced ?? {
        spreadPct: 0.25,
        minVol: 0,
        minOI: 0,
        excludeStale: false,
      },
      expectedMoveMode: view.expectedMoveMode ?? "straddle",
      ivMetric: view.ivMetric ?? "iv",
      ivSlice: view.ivSlice ?? "atm",
    });
  };

  const setCopyOutBtnAppearance = (
    btn: HTMLButtonElement,
    state: "default" | "success" | "error",
  ): void => {
    if (state === "success") {
      btn.style.borderColor = "#169c35";
      btn.style.color = "#0c7a28";
      return;
    }
    if (state === "error") {
      btn.style.borderColor = DS_COLORS.negative;
      btn.style.color = DS_COLORS.negative;
      return;
    }
    btn.style.borderColor = "var(--ios-border)";
    btn.style.color = "var(--ios-text-primary)";
  };

  const buildCopyOutText = (): string => {
    const state = store.getState();
    const response = state.response;
    const selectedExpiration =
      response?.expirations[state.selectedExpirationIdx] ?? null;
    const payload = {
      source: "AlexQuant Options Analysis",
      generatedAt: new Date().toISOString(),
      symbol: getCurrentSymbol(),
      viewState: buildSavedViewState(),
      snapshot: {
        selectedExpirationIdx: state.selectedExpirationIdx,
        selectedExpirationLabel: selectedExpiration?.label ?? null,
        selectedExpirationDte: selectedExpiration?.daysUntil ?? null,
        filteredStrikeCount: state.filteredChains.length,
        timestamp: response?.currentDateTime ?? state.timestamp,
        isDelayed: response?.isDelayed ?? null,
      },
      underlying: response
        ? {
            data: response.underlying,
            underlyingPrice: response.underlyingPrice,
            interestRate: response.interestRate,
            dividendYield: response.dividendYield,
            contractMultiplier: response.contractMultiplier,
          }
        : null,
      expirationSummary:
        response?.expirations.map((exp) => summarizeExpirationForCopy(exp)) ??
        [],
      selectedExpiration: selectedExpiration
        ? {
            label: selectedExpiration.label,
            daysUntil: selectedExpiration.daysUntil,
            expirationType: selectedExpiration.expirationType,
            chains: compactChainsForCopy(selectedExpiration.chains),
          }
        : null,
      filteredChains: compactChainsForCopy(state.filteredChains),
      latestSavedView: _latestSavedView,
    };
    return `AlexQuant Options Copy Out\n\n${JSON.stringify(payload, null, 2)}`;
  };

  const refreshBtn = ui_createElement("button", {
    text: "Refresh",
    styleString: buttonStyle,
  });

  const copyOutBtn = ui_createElement("button", {
    text: "Copy Out",
    styleString: buttonStyle,
  }) as HTMLButtonElement;

  const saveTimestampBtn = ui_createElement("button", {
    text: "Save Timestamp",
    styleString: buttonStyle,
    events: {
      click: async () => {
        const state = store.getState();
        if (!state.response) {
          statusLabel.textContent = "Load data first before saving timestamp.";
          statusLabel.style.color = DS_COLORS.negative;
          return;
        }

        const symbol = (state.response.underlying.symbol || getCurrentSymbol())
          .trim()
          .toUpperCase();
        if (!symbol) {
          statusLabel.textContent =
            "Missing symbol; cannot save timestamp view.";
          statusLabel.style.color = DS_COLORS.negative;
          return;
        }

        const savedView: TimestampSavedView = {
          version: 1,
          symbol,
          savedAt: new Date().toISOString(),
          dataTimestamp:
            state.response.currentDateTime ||
            state.timestamp ||
            new Date().toISOString(),
          response: state.response,
          view: buildSavedViewState(),
        };

        try {
          const existing = await readTimestampSavedViews(symbol);
          const merged = [
            savedView,
            ...existing.filter(
              (s) => s.dataTimestamp !== savedView.dataTimestamp,
            ),
          ];
          await writeTimestampSavedViews(symbol, merged);
          statusLabel.textContent = `Saved timestamp ${formatTimeLabel(savedView.dataTimestamp)} (${symbol}).`;
          statusLabel.style.color = "var(--ios-text-secondary)";
        } catch (err) {
          statusLabel.textContent = `Save timestamp failed: ${(err as Error)?.message ?? "unknown error"}`;
          statusLabel.style.color = DS_COLORS.negative;
        }
      },
    },
  });

  const loadTimestampBtn = ui_createElement("button", {
    text: "Load Timestamp",
    styleString: buttonStyle,
    events: {
      click: async () => {
        const symbol = getCurrentSymbol();
        if (!symbol) {
          statusLabel.textContent = "Enter/load a symbol first.";
          statusLabel.style.color = DS_COLORS.negative;
          return;
        }

        const savedViews = await readTimestampSavedViews(symbol);
        if (savedViews.length === 0) {
          statusLabel.textContent = `No saved timestamps for ${symbol}.`;
          statusLabel.style.color = DS_COLORS.negative;
          return;
        }

        const maxChoices = Math.min(12, savedViews.length);
        const options = savedViews
          .slice(0, maxChoices)
          .map(
            (s, i) =>
              `${i + 1}. data=${formatTimeLabel(s.dataTimestamp)} | saved=${formatTimeLabel(s.savedAt)}`,
          )
          .join("\n");
        const choice = window.prompt(
          `Load saved timestamp for ${symbol}:\n${options}\nEnter 1-${maxChoices}`,
          "1",
        );
        if (choice == null) return;
        const index = Number(choice) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= maxChoices) {
          statusLabel.textContent = "Invalid timestamp selection.";
          statusLabel.style.color = DS_COLORS.negative;
          return;
        }

        const selected = savedViews[index];
        try {
          clearFocusedStrike();
          symbolInput.value = symbol;
          renderTickerSelect(symbol);
          store.setState({
            response: selected.response,
            timestamp: selected.dataTimestamp || new Date().toISOString(),
          });
          applySavedViewState(selected.view, selected.response);
          renderCharts();
          statusLabel.textContent = `Loaded timestamp ${formatTimeLabel(selected.dataTimestamp)} (${symbol}).`;
          statusLabel.style.color = "var(--ios-text-secondary)";
        } catch (err) {
          statusLabel.textContent = `Load timestamp failed: ${(err as Error)?.message ?? "unknown error"}`;
          statusLabel.style.color = DS_COLORS.negative;
        }
      },
    },
  });

  inputBar.appendChild(tickerSelect);
  inputBar.appendChild(symbolInput);
  inputBar.appendChild(loadBtn);
  inputBar.appendChild(refreshBtn);
  inputBar.appendChild(copyOutBtn);
  inputBar.appendChild(statusLabel);
  inputBar.appendChild(saveTimestampBtn);
  inputBar.appendChild(loadTimestampBtn);
  wrapper.appendChild(inputBar);

  const scopeLockPlaceholder = ui_createElement("div", {
    styleString: "display: none;",
  });
  wrapper.appendChild(scopeLockPlaceholder);

  const stateVectorPlaceholder = ui_createElement("div", {
    styleString: "display: none;",
  });
  wrapper.appendChild(stateVectorPlaceholder);

  // Placeholder for the section nav bar (extracted from sectionLayout, pinned below stateVector)
  const navBarPlaceholder = ui_createElement("div", {
    styleString: "display: none;",
  });
  wrapper.appendChild(navBarPlaceholder);

  const contentArea = ui_createElement("div", {
    styleString: "display: none; padding: 0 12px 16px; min-width: 0;",
  });
  wrapper.appendChild(contentArea);

  const getStateVectorStickyHeight = (): number => {
    const h =
      stateVectorPlaceholder.getBoundingClientRect().height ||
      stateVectorPlaceholder.offsetHeight ||
      0;
    return Math.max(0, Math.round(h));
  };

  /** Sync all sticky top offsets: stateVector → navBar (top-down stacking). */
  const syncAllStickyTops = (): void => {
    const svEl = stateVectorPlaceholder.firstElementChild as HTMLElement | null;
    if (svEl) svEl.style.top = "0px";

    const svH = getStateVectorStickyHeight();
    const navBarEl = navBarPlaceholder.firstElementChild as HTMLElement | null;
    if (navBarEl) navBarEl.style.top = `${svH}px`;
  };

  let components: Record<string, ResizableComponentRef> = {};
  const pendingLayoutRefreshTimers = new Set<number>();

  const clearPendingLayoutRefresh = () => {
    for (const timer of pendingLayoutRefreshTimers) {
      window.clearTimeout(timer);
    }
    pendingLayoutRefreshTimers.clear();
  };

  const flushLayoutRefresh = () => {
    window.dispatchEvent(new Event("resize"));
    chartManager.resizeAll();
    Object.values(components).forEach((c) => {
      if (!c.resize) return;
      try {
        c.resize();
      } catch (e) {
        log.warn("component.resize.fail", { error: (e as Error)?.message });
      }
    });
  };

  const scheduleLayoutRefresh = () => {
    const delays = [0, 120, 280];
    delays.forEach((delay) => {
      const timer = window.setTimeout(() => {
        pendingLayoutRefreshTimers.delete(timer);
        flushLayoutRefresh();
      }, delay);
      pendingLayoutRefreshTimers.add(timer);
    });
  };

  const cleanupComponents = () => {
    clearPendingLayoutRefresh();
    Object.values(components).forEach((c) => {
      if (c.cleanup) {
        try {
          c.cleanup();
        } catch (e) {
          log.warn("component.cleanup.fail", { error: (e as Error)?.message });
        }
      }
    });
    components = {};
    navBarPlaceholder.innerHTML = "";
  };

  const renderCharts = () => {
    orchestrateCharts({
      store,
      contentArea,
      stateVectorPlaceholder,
      scopeLockPlaceholder,
      navBarPlaceholder,
      symbolInputValue: symbolInput.value,
      cleanupComponents,
      scheduleLayoutRefresh,
      syncAllStickyTops,
      setComponents: (key, ref) => {
        components[key] = ref;
      },
      setLatestSavedView: (sv) => {
        _latestSavedView = sv;
      },
      renderCharts,
    });
  };

  const loadSymbol = async (
    symbolOverride?: string,
    options: { ignorePendingSavedView?: boolean; isRefresh?: boolean } = {},
  ) => {
    const symbol = (symbolOverride ?? symbolInput.value).trim().toUpperCase();
    if (!symbol) {
      statusLabel.textContent = "Please enter a symbol.";
      statusLabel.style.color = DS_COLORS.negative;
      updateOptionsStatus("error");
      return;
    }

    symbolInput.value = symbol;
    renderTickerSelect(symbol);
    if (store.getState().isLoading) return;
    store.setState({ isLoading: true });
    setLoadingUi(true);
    statusLabel.textContent = `${options.isRefresh ? "Refreshing" : "Loading"} ${symbol}...`;
    statusLabel.style.color = "var(--ios-text-secondary)";
    updateOptionsStatus("refreshing");

    try {
      clearFocusedStrike();
      const authToken = (ctx as any)?.authToken as string | undefined;
      if (!authToken) {
        statusLabel.textContent = "Options page is waiting for auth token.";
        statusLabel.style.color = "#c97100";
        updateOptionsStatus("inactive");
        store.setState({ response: null });
        return;
      }
      const response = await fetchOptionChains(symbol, authToken);
      pruneLowOIExpirations(response);
      if (!response) {
        statusLabel.textContent = `No options data found for ${symbol}.`;
        statusLabel.style.color = DS_COLORS.negative;
        contentArea.style.display = "none";
        stateVectorPlaceholder.style.display = "none";
        scopeLockPlaceholder.style.display = "none";
        store.setState({ response: null });
        updateOptionsStatus("error");
        return;
      }

      if (response.expirations.length === 0) {
        statusLabel.textContent = `No options data found for ${symbol}.`;
        statusLabel.style.color = DS_COLORS.negative;
        contentArea.style.display = "none";
        stateVectorPlaceholder.style.display = "none";
        scopeLockPlaceholder.style.display = "none";
        store.setState({ response: null });
        updateOptionsStatus("error");
        return;
      }

      store.setState({
        response,
        selectedExpirationIdx: 0,
        timestamp: new Date().toISOString(),
      });

      if (
        !options.ignorePendingSavedView &&
        pendingSavedView &&
        pendingSavedView.ticker === symbol
      ) {
        applySavedViewState(
          {
            selectedExpirationIdx: pendingSavedView.selectedExpirationIdx,
            selectedStrikeCount: pendingSavedView.selectedStrikeCount,
            customExpirationIdxs: pendingSavedView.customExpirationIdxs,
            scopeMode: pendingSavedView.scopeMode,
            greeksBasis: pendingSavedView.greeksBasis,
            gammaSource: (pendingSavedView as any).gammaSource ?? "schwab",
            liquidityThreshold: pendingSavedView.liquidityThreshold,
            localWindowMode: pendingSavedView.localWindowMode,
            localWindowPct: pendingSavedView.localWindowPct,
            localWindowDeltaRange: pendingSavedView.localWindowDeltaRange,
            strikeMode: pendingSavedView.strikeMode,
            strikeDollarWidth: pendingSavedView.strikeDollarWidth,
            liquidityPreset: pendingSavedView.liquidityPreset,
            liquidityAdvanced: pendingSavedView.liquidityAdvanced,
            expectedMoveMode: pendingSavedView.expectedMoveMode,
            ivMetric: pendingSavedView.ivMetric,
            ivSlice: pendingSavedView.ivSlice,
          },
          response,
        );
        pendingSavedView = null;
      }

      statusLabel.textContent = `${response.underlying.description || symbol} \u2014 ${response.expirations.length} expirations`;
      statusLabel.style.color = "var(--ios-text-secondary)";
      updateOptionsStatus("active");

      renderCharts();

      log.info("options.load.done", {
        symbol,
        expirations: response.expirations.length,
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      statusLabel.textContent = `Error: ${msg}`;
      statusLabel.style.color = DS_COLORS.negative;
      updateOptionsStatus("error");
      log.error("options.load.fail", { symbol, error: msg });
    } finally {
      store.setState({ isLoading: false });
      setLoadingUi(false);
    }
  };

  const tryHydrateSavedViewFromHash = async () => {
    const rawHash = window.location.hash.replace(/^#/, "").trim();
    if (!rawHash) return;
    const params = new URLSearchParams(rawHash);
    const encoded = params.get("optSnapData");
    const id = params.get("optSnap");

    let snap: OptionsSavedView | null = null;
    if (encoded) {
      snap = decodeSavedView(encoded);
    } else if (id) {
      try {
        const db = await openAlexQuantDB();
        const kv = new KVStore(db);
        const raw = await kv.get(`options.opening.${id}`);
        if (raw) snap = raw as OptionsSavedView;
      } catch {
        snap = null;
      }
    }

    if (!snap) return;
    pendingSavedView = snap;
    symbolInput.value = snap.ticker;
    renderTickerSelect(snap.ticker);
    statusLabel.textContent = `Loading saved view for ${snap.ticker}...`;
    statusLabel.style.color = "var(--ios-text-secondary)";
    void loadSymbol();
  };

  loadBtn.addEventListener("click", () => {
    void loadSymbol();
  });
  tickerSelect.addEventListener("change", () => {
    const symbol = tickerSelect.value.trim().toUpperCase();
    if (!symbol) return;
    pendingSavedView = null;
    symbolInput.value = symbol;
    renderTickerSelect(symbol);
    void loadSymbol(symbol, { ignorePendingSavedView: true });
  });
  refreshBtn.addEventListener("click", () => {
    const symbol = getCurrentSymbol();
    if (!symbol) {
      statusLabel.textContent = "Enter/load a symbol first.";
      statusLabel.style.color = DS_COLORS.negative;
      return;
    }
    pendingSavedView = null;
    void loadSymbol(symbol, { ignorePendingSavedView: true, isRefresh: true });
  });
  copyOutBtn.addEventListener("click", () => {
    void (async () => {
      const ok = await ui_copyTextToClipboard(buildCopyOutText());
      copyOutBtn.textContent = ok ? "Copied" : "Copy Failed";
      setCopyOutBtnAppearance(copyOutBtn, ok ? "success" : "error");
      statusLabel.textContent = ok
        ? "Copy out payload copied to clipboard."
        : "Copy failed. Browser clipboard permission may be blocked.";
      statusLabel.style.color = ok
        ? "var(--ios-text-secondary)"
        : DS_COLORS.negative;
      if (copyOutResetTimer != null) window.clearTimeout(copyOutResetTimer);
      copyOutResetTimer = window.setTimeout(() => {
        copyOutResetTimer = null;
        copyOutBtn.textContent = "Copy Out";
        setCopyOutBtnAppearance(copyOutBtn, "default");
      }, 1800);
    })();
  });
  symbolInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void loadSymbol();
  });
  symbolInput.addEventListener("change", () => {
    renderTickerSelect(symbolInput.value);
  });
  const handleResize = () => {
    syncAllStickyTops();
  };
  window.addEventListener("resize", handleResize);

  renderTickerSelect();

  void tryHydrateSavedViewFromHash();

  // Options page intentionally avoids monitor cache hydration.
  // Always load through full OptionChains request to preserve all expiries.

  wrapper.cleanup = () => {
    updateOptionsStatus("inactive");
    if (copyOutResetTimer != null) {
      window.clearTimeout(copyOutResetTimer);
      copyOutResetTimer = null;
    }
    cleanupComponents();
    clearPendingLayoutRefresh();
    window.removeEventListener("resize", handleResize);
  };

  return wrapper;
}
