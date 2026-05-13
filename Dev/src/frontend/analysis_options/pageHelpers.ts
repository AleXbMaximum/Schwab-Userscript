import { DS_COLORS } from "../components/core/styles/theme";
import type { OptionsChainsResponse } from "shared/types/options";
import type { OptionsStore } from "./store/OptionsViewStore";
import type { SavedViewState } from "./savedView/savedViewTypes";
import type { MonitorController } from "../analysis_optionFlow/monitor/MonitorController";
import { DEFAULT_MONITOR_SETTINGS } from "../analysis_optionFlow/monitor/monitorSettings";
import { normalizeScopeMode } from "./savedView/savedViewSerializer";

/** Apply a SavedViewState onto the OptionsStore, clamping invalid indexes. */
export function applySavedViewState(
  store: OptionsStore,
  view: SavedViewState,
  response: OptionsChainsResponse,
): void {
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
}

/** Set the Copy-Out button visual state without touching its text. */
export function setCopyOutBtnAppearance(
  btn: HTMLButtonElement,
  state: "default" | "success" | "error",
): void {
  if (state === "success") {
    btn.style.borderColor = "var(--ax-green)";
    btn.style.color = "var(--ax-green)";
    return;
  }
  if (state === "error") {
    btn.style.borderColor = DS_COLORS.negative;
    btn.style.color = DS_COLORS.negative;
    return;
  }
  btn.style.borderColor = "var(--ios-border)";
  btn.style.color = "var(--ios-text-primary)";
}

/** Resolve the monitored ticker list for the page's <select>. */
export function getTickerList(ctx: any): string[] {
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
}

/** Repopulate the ticker <select> with the current monitor universe. */
export function renderTickerSelect(
  tickerSelect: HTMLSelectElement,
  symbolInput: HTMLInputElement,
  ctx: any,
  symbolOverride?: string,
): void {
  const list = getTickerList(ctx);
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
}
