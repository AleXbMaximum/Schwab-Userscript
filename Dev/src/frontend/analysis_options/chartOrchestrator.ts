import type{ OptionsExpiration } from "shared/types/options";
import type { GreeksBasis, GexGammaSource, ExpectedMoveMode } from "backend/computation/options/types";
import type {
  SectionId,
  ScopeMode,
  LocalWindowMode,
  StrikeMode,
  LiquidityPreset,
  LiquidityAdvanced,
  ActiveFilterState,
  ResizableComponentRef,
  IVMetric,
  IVSlice,
} from "./types";
import type { OptionsSavedView } from "./savedView/savedViewTypes";
import type { OptionsStore } from "./store/OptionsViewStore";
import type { ViewControlsState } from "./controls/OptionsViewControls";
import { computeAllDerivatives } from "./computeDerivatives";

import { renderSectionLayout } from "./components/SectionLayout";
import { renderStateVector, renderActiveFilterTags } from "./components/panels/StateVector";
import { renderScopeLock } from "./controls/OptionsViewControls";
import { renderAlertPanel } from "./components/panels/AlertPanel";
import { renderIVPanelHeader } from "./components/IVPanelHeader";
import { renderIVSkew } from "./components/charts/IVSkew";
import { renderTermStructure } from "./components/charts/TermStructure";
import { renderEnhancedGex } from "./components/charts/EnhancedGex";
import { renderVolatilitySurface } from "./components/charts/VolatilitySurface";
import { renderExpectedMove } from "./components/charts/ExpectedMove";
import { renderOptionsWalls } from "./components/charts/OptionsWalls";
import { renderKeyLevelsCards } from "./components/charts/KeyLevelsCards";
import { renderGreeksExposure } from "./components/charts/GreeksExposure";
import { renderIVSmileOverlay } from "./components/charts/IVSmileOverlay";
import { renderCumulativeGex } from "./components/charts/CumulativeGex";
import { renderUnusualActivity } from "./components/charts/UnusualActivity";
import { renderBidAskSpread } from "./components/panels/BidAskSpread";
import { renderPricingAnalysis } from "./components/panels/PricingAnalysis";
import { renderTradingInsights } from "./components/panels/TradingInsights";
import { renderVolumeProfile } from "./components/panels/VolumeProfile";
import { renderEventDecomposition } from "./components/panels/EventDecomposition";
import { renderDataQuality } from "./components/panels/DataQuality";
import { deriveAlerts } from "./store/selectors";

export type ChartOrchestratorDeps = {
  store: OptionsStore;
  contentArea: HTMLElement;
  stateVectorPlaceholder: HTMLElement;
  scopeLockPlaceholder: HTMLElement;
  navBarPlaceholder: HTMLElement;
  symbolInputValue: string;
  cleanupComponents: () => void;
  scheduleLayoutRefresh: () => void;
  syncAllStickyTops: () => void;
  setComponents: (key: string, ref: ResizableComponentRef) => void;
  setLatestSavedView: (sv: OptionsSavedView) => void;
  renderCharts: () => void;
};

export function orchestrateCharts(deps: ChartOrchestratorDeps): void {
  const {
    store,
    contentArea,
    stateVectorPlaceholder,
    scopeLockPlaceholder,
    navBarPlaceholder,
  } = deps;
  const state = store.getState();
  if (!state.response) return;

  const exp = getSelectedExpiration(store);
  if (!exp) return;

  // ── Compute all derived data ──
  const d = computeAllDerivatives({
    response: state.response,
    exp,
    filteredChains: state.filteredChains,
    greeksBasis: state.greeksBasis,
    gammaSource: state.gammaSource,
    localWindowMode: state.localWindowMode,
    localWindowPct: state.localWindowPct,
    localWindowDeltaRange: state.localWindowDeltaRange,
    liquidityThreshold: state.liquidityThreshold,
  });

  // ── Reset UI ──
  deps.cleanupComponents();
  contentArea.innerHTML = "";
  contentArea.style.display = "block";

  // ── StateVector (sticky top) ──
  stateVectorPlaceholder.innerHTML = "";
  stateVectorPlaceholder.style.display = "block";
  const stateVectorEl = renderStateVector(d.stateVectorData, d.metrics);
  deps.setComponents("stateVector", stateVectorEl);
  stateVectorPlaceholder.appendChild(stateVectorEl);

  // ── ScopeLock controls ──
  scopeLockPlaceholder.innerHTML = "";
  scopeLockPlaceholder.style.display = "block";
  const scopeLockEl = renderScopeLock(
    buildViewControlsState(store),
    state.response.expirations,
    buildControlCallbacks(deps, store),
  );
  deps.setComponents("scopeLock", scopeLockEl);
  scopeLockPlaceholder.appendChild(scopeLockEl);

  // ── Section layout ──
  const sectionLayout = renderSectionLayout(
    (id: SectionId, expanded: boolean) => {
      const secs = new Set(store.getState().expandedSections);
      if (expanded) secs.add(id);
      else secs.delete(id);
      store.setState({ expandedSections: secs });
      deps.scheduleLayoutRefresh();
    },
  );
  deps.setComponents("sectionLayout", sectionLayout);
  contentArea.appendChild(sectionLayout);

  const navBarEl = sectionLayout.getNavBar();
  navBarPlaceholder.innerHTML = "";
  navBarPlaceholder.appendChild(navBarEl);
  navBarPlaceholder.style.display = "block";
  navBarEl.style.zIndex = "var(--z-sticky-nav, 100)";
  deps.syncAllStickyTops();

  const navInfo = sectionLayout.getNavInfoChips();
  navInfo.innerHTML = "";
  navInfo.appendChild(
    renderActiveFilterTags(
      buildActiveFilters(store),
      {
        onResetScope: () => { store.setState({ scopeMode: "single" }); deps.renderCharts(); },
        onResetLocalWindow: () => { store.setState({ localWindowMode: "all" }); deps.renderCharts(); },
        onResetLiquidity: () => { store.setState({ liquidityPreset: "normal" }); deps.renderCharts(); },
        onResetGreeks: () => { store.setState({ greeksBasis: "mid", gammaSource: "schwab" }); deps.renderCharts(); },
        onResetStrikes: () => { store.setState({ strikeMode: "count", selectedStrikeCount: 48 }); deps.renderCharts(); },
      },
      "inline",
    ),
  );

  // ── Signal section ──
  const underlyingPrice = state.response.underlyingPrice;

  const insightsEl = renderTradingInsights(d.insightsData);
  deps.setComponents("insights", insightsEl);
  sectionLayout.getCardSlot("signal", "insights", 1, "text").appendChild(insightsEl);

  const keyLevelsScopeLabel = `${exp.daysUntil}d`;
  const keyLevelsSourceNote =
    `Source expiry rule: selected expiry (${exp.label}, ${exp.daysUntil}d). ` +
    `Gamma/GEX basis: ${state.greeksBasis.toUpperCase()}, ` +
    `source: ${state.gammaSource === "bs" ? "BS Model" : "Market"}.`;
  const keyLevelsCardsEl = renderKeyLevelsCards(d.wallData, d.ladderData, keyLevelsScopeLabel, keyLevelsSourceNote);
  deps.setComponents("keyLevelsCards", keyLevelsCardsEl);
  sectionLayout.getCardSlot("signal", "keyLevelsCards", 1, "text").appendChild(keyLevelsCardsEl);

  const wallsEl = renderOptionsWalls(d.wallData);
  deps.setComponents("walls", wallsEl);
  sectionLayout.getCardSlot("signal", "walls", 1, "chart").appendChild(wallsEl);

  const cumGexEl = renderCumulativeGex(d.cumGexData, underlyingPrice);
  deps.setComponents("cumGex", cumGexEl);
  sectionLayout.getCardSlot("signal", "cumGex", 1, "chart").appendChild(cumGexEl);

  const enhGexEl = renderEnhancedGex(
    d.gexAnalytics, underlyingPrice, state.greeksBasis,
    state.response.currentDateTime, d.ladderData,
  );
  deps.setComponents("enhGex", enhGexEl);
  sectionLayout.getCardSlot("signal", "enhGex", 1, "chart").appendChild(enhGexEl);

  const greeksEl = renderGreeksExposure(d.greeksData, underlyingPrice);
  deps.setComponents("greeks", greeksEl);
  sectionLayout.getCardSlot("signal", "greeks", 1, "chart").appendChild(greeksEl);

  const volProfileEl = renderVolumeProfile(d.volProfileData);
  deps.setComponents("volProfile", volProfileEl);
  sectionLayout.getCardSlot("signal", "volProfile", 1, "chart").appendChild(volProfileEl);

  const unusualEl = renderUnusualActivity(d.actSurfData, underlyingPrice);
  deps.setComponents("unusual", unusualEl);
  sectionLayout.getCardSlot("signal", "unusual", 1, "chart").appendChild(unusualEl);

  const emEl = renderExpectedMove(
    d.emData, d.rndData, d.straddleConeData, d.rndConeData,
    state.expectedMoveMode, underlyingPrice,
    (mode: ExpectedMoveMode) => { store.setState({ expectedMoveMode: mode }); deps.renderCharts(); },
  );
  deps.setComponents("expectedMove", emEl);
  sectionLayout.getCardSlot("signal", "expectedMove", 1, "chart").appendChild(emEl);

  // ── IV section ──
  const ivHeaderEl = renderIVPanelHeader(state.ivMetric, state.ivSlice, {
    onMetricChange: (m: IVMetric) => { store.setState({ ivMetric: m }); deps.renderCharts(); },
    onSliceChange: (s: IVSlice) => { store.setState({ ivSlice: s }); deps.renderCharts(); },
  });
  deps.setComponents("ivHeader", ivHeaderEl);
  sectionLayout.getSectionInfoChips("iv").appendChild(ivHeaderEl);

  const eventDecompEl = renderEventDecomposition(d.termData);
  deps.setComponents("eventDecomp", eventDecompEl);
  sectionLayout.getCardSlot("iv", "eventDecomp", 1, "text").appendChild(eventDecompEl);

  const termEl = renderTermStructure(d.termData, d.stateVectorData.eventFlags);
  deps.setComponents("term", termEl);
  sectionLayout.getCardSlot("iv", "term", 1, "chart").appendChild(termEl);

  const ivEl = renderIVSkew(d.skewData, underlyingPrice);
  deps.setComponents("iv", ivEl);
  sectionLayout.getCardSlot("iv", "skew", 1, "chart").appendChild(ivEl);

  const smileEl = renderIVSmileOverlay(d.smileData, underlyingPrice);
  deps.setComponents("smile", smileEl);
  sectionLayout.getCardSlot("iv", "smile", 1, "chart").appendChild(smileEl);

  const volSurfEl = renderVolatilitySurface(d.volSurfData, underlyingPrice);
  deps.setComponents("volSurf", volSurfEl);
  sectionLayout.getCardSlot("iv", "volSurf", 2, "chart", 2).appendChild(volSurfEl);

  // ── Diagnostics section ──
  const dataQualEl = renderDataQuality(d.qualityData, d.volDiagData, d.liquidityData);
  deps.setComponents("dataQuality", dataQualEl);
  sectionLayout.getCardSlot("diagnostics", "dataQuality", 1, "text").appendChild(dataQualEl);

  const spreadEl = renderBidAskSpread(d.spreadData, underlyingPrice);
  deps.setComponents("spread", spreadEl);
  sectionLayout.getCardSlot("diagnostics", "spread", 1, "chart").appendChild(spreadEl);

  const pricingEl = renderPricingAnalysis(d.pricingData, underlyingPrice, {
    maxSpreadPct: state.liquidityThreshold > 0 ? state.liquidityThreshold / 100 : 0.20,
    minActivity: 25,
    qualityScore: d.qualityData.qualityScore,
  });
  deps.setComponents("pricing", pricingEl);
  sectionLayout.getCardSlot("diagnostics", "pricing", 1, "chart").appendChild(pricingEl);

  // ── Alerts ──
  const alertPanel = renderAlertPanel(
    (sectionId: SectionId, cardId: string) => {
      sectionLayout.setExpanded(sectionId, true);
      sectionLayout.scrollToCard(cardId);
      sectionLayout.highlightCard(cardId);
    },
  );
  deps.setComponents("alertPanel", alertPanel);
  const alerts = deriveAlerts(d.qualityData, d.volDiagData, d.liquidityData, d.stateVectorData);
  if (alertPanel.update) alertPanel.update(alerts);

  // ── Persist latest saved view ──
  deps.setLatestSavedView({
    version: 1,
    createdAt: new Date().toISOString(),
    ticker: deps.symbolInputValue.trim().toUpperCase(),
    selectedExpirationIdx: state.selectedExpirationIdx,
    selectedStrikeCount: state.selectedStrikeCount,
    customExpirationIdxs: state.customExpirationIdxs,
    scopeMode: state.scopeMode,
    greeksBasis: state.greeksBasis,
    gammaSource: state.gammaSource,
    liquidityThreshold: state.liquidityThreshold,
    localWindowMode: state.localWindowMode,
    localWindowPct: state.localWindowPct,
    localWindowDeltaRange: state.localWindowDeltaRange,
    strikeMode: state.strikeMode,
    strikeDollarWidth: state.strikeDollarWidth,
    liquidityPreset: state.liquidityPreset,
    liquidityAdvanced: state.liquidityAdvanced,
    expectedMoveMode: state.expectedMoveMode,
    ivMetric: state.ivMetric,
    ivSlice: state.ivSlice,
    timestamp: state.response.currentDateTime,
    keyLevels: {
      putWall: d.ladderData.entries.find((e) => e.id === "putWall")?.value ?? null,
      flip: d.ladderData.entries.find((e) => e.id === "flip")?.value ?? null,
      maxPain: d.ladderData.entries.find((e) => e.id === "maxPain")?.value ?? null,
      callWall: d.ladderData.entries.find((e) => e.id === "callWall")?.value ?? null,
    },
    quality: {
      score: d.qualityData.qualityScore,
      grade: d.qualityData.qualityGrade,
    },
  });

  deps.scheduleLayoutRefresh();
}

// ── Helpers ──

function getSelectedExpiration(store: OptionsStore): OptionsExpiration | null {
  const state = store.getState();
  if (!state.response || state.response.expirations.length === 0) return null;
  return (
    state.response.expirations[state.selectedExpirationIdx] ??
    state.response.expirations[0]
  );
}

function buildActiveFilters(store: OptionsStore): ActiveFilterState {
  const state = store.getState();
  return {
    scopeMode: state.scopeMode,
    localWindowMode: state.localWindowMode,
    localWindowPct: state.localWindowPct,
    localWindowDeltaRange: state.localWindowDeltaRange,
    liquidityPreset: state.liquidityPreset,
    greeksBasis: state.greeksBasis,
    gammaSource: state.gammaSource,
    strikeMode: state.strikeMode,
    selectedStrikeCount: state.selectedStrikeCount,
    strikeDollarWidth: state.strikeDollarWidth,
  };
}

function buildViewControlsState(store: OptionsStore): ViewControlsState {
  const state = store.getState();
  return {
    selectedExpirationIdx: state.selectedExpirationIdx,
    customExpirationIdxs: state.customExpirationIdxs,
    scopeMode: state.scopeMode,
    greeksBasis: state.greeksBasis,
    gammaSource: state.gammaSource,
    localWindowMode: state.localWindowMode,
    localWindowPct: state.localWindowPct,
    localWindowDeltaRange: state.localWindowDeltaRange,
    strikeMode: state.strikeMode,
    selectedStrikeCount: state.selectedStrikeCount,
    strikeDollarWidth: state.strikeDollarWidth,
    liquidityPreset: state.liquidityPreset,
    liquidityAdvanced: state.liquidityAdvanced,
  };
}

function buildControlCallbacks(
  deps: ChartOrchestratorDeps,
  store: OptionsStore,
) {
  return {
    onExpirationChange: (idx: number, customIdxs?: number[]) => {
      const patch: Record<string, unknown> = { selectedExpirationIdx: idx };
      if (customIdxs) patch.customExpirationIdxs = customIdxs;
      store.setState(patch);
      deps.renderCharts();
    },
    onScopeChange: (mode: ScopeMode) => {
      store.setState({ scopeMode: mode });
      deps.renderCharts();
    },
    onLocalWindowChange: (
      mode: LocalWindowMode,
      pct: number,
      deltaRange: [number, number],
    ) => {
      store.setState({
        localWindowMode: mode,
        localWindowPct: pct,
        localWindowDeltaRange: deltaRange,
      });
      deps.renderCharts();
    },
    onStrikeChange: (
      mode: StrikeMode,
      count: number,
      dollarWidth: number,
    ) => {
      store.setState({
        strikeMode: mode,
        selectedStrikeCount: count,
        strikeDollarWidth: dollarWidth,
      });
      deps.renderCharts();
    },
    onLiquidityChange: (
      preset: LiquidityPreset,
      advanced: LiquidityAdvanced,
    ) => {
      store.setState({
        liquidityPreset: preset,
        liquidityAdvanced: advanced,
      });
      deps.renderCharts();
    },
    onBasisChange: (basis: GreeksBasis) => {
      store.setState({ greeksBasis: basis });
      deps.renderCharts();
    },
    onGammaSourceChange: (source: GexGammaSource) => {
      store.setState({ gammaSource: source });
      deps.renderCharts();
    },
  };
}
