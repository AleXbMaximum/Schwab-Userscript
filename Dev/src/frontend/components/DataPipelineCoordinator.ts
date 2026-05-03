import {
  BackendOrchestrator,
  type BackendOrchestratorOptions,
} from "../../backend/pipeline/orchestration/BackendOrchestrator";
import { HeaderRenderer } from "./header/HeaderRenderer";
import type{ HoldingsFrame } from "../../shared/types/derived";
import { logService } from "shared/log/core/LogService";
import { onShareModeChange } from "shared/utils/domain/globalShareMode";
import { computeAccountOverviewMetrics } from "../../backend/computation/holdings/metrics/accountOverviewMetrics";
import type { AccountOverviewMetrics } from "../../backend/computation/holdings/metrics/accountOverviewMetrics";
import { applyBalancesOverlay } from "../../backend/computation/holdings/rendering/balancesOverlay";

const log = logService.namespace("pipeline");
import type {
  TickerBetaBundle,
  ThreeFactorBundle,
} from "../../backend/computation/beta/types";
import type {
  BetaService,
  AllBenchmarkBetaData,
} from "../../backend/pipeline/beta/BetaService";
import type { ChartDataService } from "../../backend/core/network/chart/ChartDataService";
import type { BalancesSnapshot } from "../../backend/core/network/schwab/endpoints/balances";
import type { OrchestratorPhase } from "../../shared/utils/time";
import type { SchedulerOverride } from "../../shared/types/core";
import type { PhaseSourceKey } from "../../backend/pipeline/orchestration/PhaseManager";

export class DataPipelineCoordinator {
  private backend: BackendOrchestrator;
  private renderer: HeaderRenderer;
  private ctx: any;
  private unsubscribes: (() => void)[] = [];
  private started = false;
  private latestOverview: AccountOverviewMetrics | null = null;
  private latestBalances: BalancesSnapshot | null = null;
  private lastFrameData: any = null;

  constructor(ctx: any, uiElements: any) {
    this.ctx = ctx;
    const settings = ctx.settings || {};

    const options: BackendOrchestratorOptions = {
      refreshIntervalMs: settings.refreshInterval || 500,
      holdingsRefreshInterval: settings.holdingsRefreshInterval,
      quotesRefreshInterval: settings.quotesRefreshInterval,
      balancesRefreshInterval: settings.balancesRefreshInterval,
      betaRefreshIntervalMs: settings.betaRefreshIntervalMs,
      enableStreamer: settings.enableStreamer,
      enableOvernightPrice: settings.enableOvernightPrice,
      warningRulesJson: settings.warningRulesJson ?? null,
    };

    this.backend = new BackendOrchestrator(ctx, options);
    this.renderer = new HeaderRenderer(
      uiElements,
      this.backend.getChartDataService(),
    );
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;

    log.info("coordinator.start");
    this.backend.start();
    this.renderer.start();

    // Forward holdings frame events to the header renderer (with centralized overview)
    this.unsubscribes.push(
      this.backend.eventBus.on("holdings:frame", (frame) => {
        this.lastFrameData = frame;
        this.recomputeOverview();
        this.renderer.queueRender(frame);
      }),
    );

    // Forward balances events to the header renderer (same source as snapshot)
    this.unsubscribes.push(
      this.backend.eventBus.on("balances", (snapshot) => {
        this.latestBalances = snapshot;
        this.recomputeOverview();
        this.renderer.setBalances(snapshot);
      }),
    );

    // Re-emit holdings frame when share mode changes so all pages re-render
    this.unsubscribes.push(
      onShareModeChange(() => {
        const frame = this.backend.getLatestFrame();
        if (frame) this.backend.eventBus.emit("holdings:frame", frame);
      }),
    );
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    log.info("coordinator.stop");
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
    this.backend.stop();
    this.renderer.stop();
  }

  // ── Streamer ─────────────────────────────────────────────────────────────

  connectStreamer(streamer: any): void {
    this.backend.connectStreamer(streamer);
  }

  // ── Subscriptions (page listeners) ───────────────────────────────────────

  subscribe(cb: (data: any) => void): () => void {
    return this.backend.eventBus.on("holdings:frame", cb, { replay: true });
  }

  subscribeToBeta(
    cb: (data: Map<string, TickerBetaBundle>) => void,
  ): () => void {
    return this.backend.eventBus.on("beta:updated", cb, { replay: true });
  }

  subscribeToBalances(cb: (data: BalancesSnapshot) => void): () => void {
    return this.backend.eventBus.on("balances", cb, { replay: true });
  }

  subscribeToThreeFactor(
    cb: (data: Map<string, ThreeFactorBundle>) => void,
  ): () => void {
    return this.backend.eventBus.on("threeFactor:updated", cb, {
      replay: true,
    });
  }

  // ── Centralized overview ─────────────────────────────────────────────────

  private recomputeOverview(): void {
    const data = this.lastFrameData;
    if (!data) return;
    const holdings = data.holdings;
    if (!holdings) return;
    const account = holdings.accounts?.[0];
    const perAccountTotals = account?.totals;
    const accountTotals = (holdings as any).accountTotals;
    if (!(accountTotals || perAccountTotals) || !account) return;
    const base = computeAccountOverviewMetrics(
      accountTotals,
      data.derived,
      account,
      perAccountTotals,
    );
    this.latestOverview = applyBalancesOverlay(base, this.latestBalances);
    data.overview = this.latestOverview;
  }

  getLatestOverview(): AccountOverviewMetrics | null {
    return this.latestOverview;
  }

  // ── Getters (delegates) ──────────────────────────────────────────────────

  getLatestFrame(): HoldingsFrame | null {
    return this.backend.getLatestFrame();
  }

  getHoldingsDataService() {
    return this.backend.holdingsDataService;
  }

  getBetaService(): BetaService {
    return this.backend.getBetaService();
  }

  getChartDataService(): ChartDataService {
    return this.backend.getChartDataService();
  }

  getIndexSparklineStore() {
    return this.renderer.indexSparklineStore;
  }

  getAllBenchmarkBetaData(): AllBenchmarkBetaData {
    return this.backend.betaManager.getAllBenchmarkBetaData();
  }

  getThreeFactorData(): Map<string, ThreeFactorBundle> {
    return this.backend.betaManager.getThreeFactorData();
  }

  getCurrentBenchmark(): string {
    return this.backend.betaManager.getCurrentBenchmark();
  }

  setBenchmark(symbol: string): void {
    this.backend.betaManager.setBenchmark(symbol);
    // Re-emit holdings frame with new benchmark data
    const frame = this.backend.getLatestFrame();
    if (frame) {
      this.backend.betaManager.enrichDerivedState(frame.derived, null);
      this.backend.eventBus.emit("holdings:frame", frame);
    }
  }

  getExtraBetaTickers(): string[] {
    return this.backend.betaManager.getExtraBetaTickers();
  }

  addExtraBetaTicker(symbol: string): void {
    this.backend.betaManager.addExtraBetaTicker(symbol, (sym) =>
      this.hasHoldingTickerSymbol(sym),
    );
    this.backend.triggerRebalanceRecalc();
  }

  removeExtraBetaTicker(symbol: string): void {
    this.backend.betaManager.removeExtraBetaTicker(symbol);
  }

  triggerRebalanceRecalc(): void {
    this.backend.triggerRebalanceRecalc();
  }

  triggerBetaRecalc(): void {
    this.backend.triggerBetaRecalc();
  }

  getBetaCalcStatus(): { isFetching: boolean; error: unknown | null } {
    return this.backend.getBetaCalcStatus();
  }

  // ── Phase & override API (for settings panel) ──────────────────────────

  getCurrentPhase(): OrchestratorPhase {
    return this.backend.getCurrentPhase();
  }

  getSchedulerStatus(key: string): {
    isFetching: boolean;
    error: unknown | null;
    isPaused: boolean;
  } {
    return this.backend.scheduler.getStatus(key);
  }

  setSourceOverride(key: PhaseSourceKey, state: SchedulerOverride): void {
    this.backend.setSourceOverride(key, state);
  }

  getSourceOverride(key: PhaseSourceKey): SchedulerOverride {
    return this.backend.getSourceOverride(key);
  }

  subscribeToPhaseChange(cb: (phase: OrchestratorPhase) => void): () => void {
    return this.backend.eventBus.on("phaseChange", cb);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  updateSettings(newSettings: any): void {
    this.backend.updateSettings(newSettings);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private hasHoldingTickerSymbol(symbol: string): boolean {
    const byUnderlying =
      this.backend.getLatestFrame()?.derived?.byUnderlying ?? null;
    if (!byUnderlying || typeof byUnderlying !== "object") return false;
    const sym = symbol.toUpperCase().trim();
    if (Object.prototype.hasOwnProperty.call(byUnderlying, sym)) return true;
    for (const rawKey of Object.keys(byUnderlying)) {
      if (rawKey.toUpperCase().trim() === sym) return true;
    }
    return false;
  }
}
