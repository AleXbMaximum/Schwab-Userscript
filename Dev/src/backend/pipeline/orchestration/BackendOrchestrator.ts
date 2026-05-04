import type{ HoldingsResponse } from "../../../shared/types/holdings";
import type{ DerivedState, HoldingsFrame } from "../../../shared/types/derived";
import type{ StreamerLike } from "../../../shared/types/streamer";
import type { Logger } from "../../../shared/log/Logger";
import { logService } from "../../../shared/log/core/LogService";

import {
  createEventBus,
  type TypedEventBus,
} from "../../../shared/utils/state/TypedEventBus";
import type { BackendEvents } from "./EventBus";
import { systemClock } from "../../../shared/utils/async/Clock";

import { HoldingsDataService } from "../HoldingsDataService";
import { SchwabNetworkSource } from "../../core/network/schwab/SchwabNetworkSource";
import { InMemoryStateRepository } from "../InMemoryStateRepository";
import { PipelineStatePersistor } from "../persistence/PipelineStatePersistor";
import type { RawDataState } from "../ingestion/DataIngestion";
import type { SymbolDelta } from "../ingestion/IngestionCoordinator";

import { PollingScheduler } from "./PollingScheduler";
import { BetaManager } from "../beta/BetaManager";
import { StreamerBridge } from "../bridges/StreamerBridge";
import { OvernightBridge } from "../bridges/OvernightBridge";
import { NewsLifecycleCoordinator } from "../../services/news/NewsLifecycleCoordinator";

import { BetaService } from "../beta/BetaService";
import {
  chartDataService,
  type ChartDataService,
} from "../../core/network/chart/ChartDataService";
import {
  fetchHoldings,
  fetchDualHoldings,
} from "../../core/network/schwab/endpoints/holdings";
import { PhaseManager, type PhaseSourceKey } from "./PhaseManager";
import type { OrchestratorPhase } from "../../../shared/utils/time";
import type { SchedulerOverride } from "../../../shared/types/core";

import {
  type BackendOrchestratorOptions,
  type BackendContext,
  type StorageLike,
  DEFAULT_BETA_RECALC_INTERVAL_MS,
} from "./backendOrchestratorTypes";
import { SourceOverrideManager } from "./sourceOverrideManager";
import { setupPolling as runSetupPolling } from "./pollingOrchestrator";
import { routeSettingsUpdate } from "./settingsRouter";

export type {
  BackendOrchestratorOptions,
  BackendContext,
} from "./backendOrchestratorTypes";

// ── BackendOrchestrator ──────────────────────────────────────────────────────

export class BackendOrchestrator {
  readonly eventBus: TypedEventBus<BackendEvents>;
  readonly holdingsDataService: HoldingsDataService;
  readonly betaManager: BetaManager;
  readonly scheduler: PollingScheduler;

  private readonly streamerBridge: StreamerBridge;
  private readonly overnightBridge: OvernightBridge;
  private readonly newsFeedBridge: NewsLifecycleCoordinator;
  private readonly logger: Logger;
  private readonly chartDataSvc: ChartDataService;
  private readonly ctx: BackendContext;
  private readonly persistor: PipelineStatePersistor;

  private readonly initialOptions: BackendOrchestratorOptions;
  private latestFrame: HoldingsFrame | null = null;
  private started = false;
  private unsubscribeHoldingsFrame: (() => void) | null = null;

  private fetchHoldingsTask: (() => Promise<any>) | null = null;
  private fetchBalancesTask: (() => Promise<any>) | null = null;
  private fetchQuotesTask: (() => Promise<any>) | null = null;
  private readonly phaseManager: PhaseManager;
  private readonly sourceOverrideManager: SourceOverrideManager;

  constructor(ctx: BackendContext, options: BackendOrchestratorOptions = {}) {
    this.ctx = ctx;
    this.initialOptions = options;
    this.logger = logService.namespace("pipeline");

    // Core infrastructure
    this.eventBus = createEventBus<BackendEvents>();
    this.persistor = new PipelineStatePersistor(
      logService.namespace("storage"),
      () => this.ctx.storage,
    );
    const clock = systemClock;

    // Holdings data pipeline
    const dataSource = new SchwabNetworkSource();
    const stateRepo = new InMemoryStateRepository<RawDataState, DerivedState>(
      logService.namespace("pipeline"),
      clock,
    );
    this.holdingsDataService = new HoldingsDataService(
      dataSource,
      stateRepo,
      logService.namespace("pipeline"),
      clock,
      { refreshIntervalMs: options.refreshIntervalMs ?? 500 },
    );
    if (options.warningRulesJson !== undefined) {
      this.holdingsDataService.setWarningRulesJson(
        options.warningRulesJson ?? null,
      );
    }

    // Polling
    this.scheduler = new PollingScheduler(
      {},
      clock,
      logService.namespace("pipeline"),
    );

    // Beta
    this.chartDataSvc = chartDataService;
    const betaService = new BetaService(this.chartDataSvc);
    const initialExtraTickers: string[] =
      (ctx.settings as Record<string, any>)?.extraBetaTickers ?? [];
    this.betaManager = new BetaManager(
      betaService,
      this.eventBus,
      logService.namespace("compute"),
      initialExtraTickers,
      (tickers: string[]) => {
        const storage: StorageLike | undefined = this.ctx.storage;
        if (storage && typeof storage.set === "function") {
          const updated = { ...this.ctx.settings, extraBetaTickers: tickers };
          this.ctx.settings = updated;
          storage.set("settings", updated, { silent: true });
        }
      },
    );

    // Streamer
    this.streamerBridge = new StreamerBridge(
      this.holdingsDataService,
      logService.namespace("streamer"),
      options.enableStreamer !== false,
    );

    // Overnight (Yahoo WS) — enabled later in start() after polling sources exist
    this.overnightBridge = new OvernightBridge(
      this.holdingsDataService,
      logService.namespace("streamer"),
    );
    this.overnightBridge.onActiveChange((active) =>
      this.handleOvernightTransition(active),
    );

    // News feed lifecycle (source polling + symbol scope), decoupled from page rendering.
    this.newsFeedBridge = new NewsLifecycleCoordinator(
      logService.namespace("news"),
    );

    // Phase management
    this.phaseManager = new PhaseManager(this.logger, {
      onStreamerEnable: () => {
        this.holdingsDataService.setStreamerIngestionMode("full");
        this.streamerBridge.setEnabled(true);
        this.streamerBridge.reconnect(
          this.ctx.authToken,
          this.ctx.customerId ?? null,
        );
      },
      onStreamerDisable: () => {
        this.holdingsDataService.setStreamerIngestionMode("disabled");
        this.streamerBridge.setEnabled(false);
        this.streamerBridge.disconnect();
      },
      onFetchTaskSwitch: (dualFetch: boolean) => {
        if (dualFetch) {
          const includeStreamer = this.phaseManager.usesStreamer();
          this.fetchHoldingsTask = () => {
            return fetchDualHoldings(
              this.ctx.authToken,
              this.ctx.accountId!,
            ).then((data: any) => {
              this.ingestHoldingsAndDispatchSymbols(data, { includeStreamer });
              return data;
            });
          };
        } else {
          this.fetchHoldingsTask = () => {
            return fetchHoldings(this.ctx.authToken, this.ctx.accountId!).then(
              (data: any) => {
                this.ingestHoldingsAndDispatchSymbols(data);
                return data;
              },
            );
          };
        }
      },
      onPollingResume: () => {
        this.reregisterHoldings();
        this.reregisterQuotes();
        this.reregisterBalances();
      },
      onPollingPauseForOvernight: () => {
        this.scheduler.pauseSource("holdings");
        this.scheduler.pauseSource("quotes");
        this.scheduler.pauseSource("balances");
        this.warmupForOvernight();
      },
      onPollingPauseForClosed: () => {
        this.scheduler.pauseSource("holdings");
        this.scheduler.pauseSource("quotes");
        this.scheduler.pauseSource("balances");
      },
      onPhaseChange: (phase: OrchestratorPhase) => {
        // Re-apply any active source overrides after phase config settles
        this.applySourceOverrides(phase);
        this.eventBus.emit("phaseChange", phase);
      },
    });

    this.sourceOverrideManager = new SourceOverrideManager({
      scheduler: this.scheduler,
      streamerBridge: this.streamerBridge,
      overnightBridge: this.overnightBridge,
      getAuthToken: () => this.ctx.authToken,
      getCustomerId: () => this.ctx.customerId ?? null,
      reregisterHoldings: () => this.reregisterHoldings(),
      reregisterQuotes: () => this.reregisterQuotes(),
      reregisterBalances: () => this.reregisterBalances(),
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    if (this.started) {
      this.logger.debug(
        "BackendOrchestrator already started, skipping duplicate start",
      );
      return;
    }
    this.started = true;
    this.logger.info("BackendOrchestrator starting");

    // Subscribe before service start to avoid missing the first emitted frame.
    this.unsubscribeHoldingsFrame = this.holdingsDataService.subscribe(
      (data: HoldingsFrame) => {
        const ct = data?.changeToken;
        const touchedKeys =
          ct && !ct.fullRebuild ? ct.touchedUnderlyingKeys : null;
        this.betaManager.enrichDerivedState(data?.derived, touchedKeys);

        const frame = this.withLatestBeta(data);
        this.latestFrame = frame;
        this.eventBus.emit("holdings:frame", frame);
      },
    );

    // Start the data pipeline
    void this.holdingsDataService.start();

    // Hydrate from cached data
    if (this.ctx.rawHoldings) {
      try {
        this.holdingsDataService.ingestHoldings(this.ctx.rawHoldings);
      } catch (err) {
        this.logger.error("hydrateFromStorageFailed", {
          error: (err as Error)?.message ?? String(err),
        });
      }
    }
    if (this.ctx.betaData) {
      this.betaManager.hydrateFromStorage(this.ctx.betaData);
    }

    this.newsFeedBridge.start(this.holdingsDataService.getTrackedSymbols());

    // Resolve the initial orchestrator phase BEFORE setupPolling so the
    // initial fetch task (dual vs single) and streamer state are correct.
    this.phaseManager.init(/* skipScheduler */ true);
    this.phaseManager.startPeriodicCheck();

    // Setup polling sources (uses this.currentPhase set above)
    this.setupPolling();
    this.scheduler.start();

    // Enable overnight after polling sources exist, so onActiveChange
    // can correctly apply streamer ingestion mode on first load.
    // Use ctx.settings as fallback: initialOptions may be undefined when
    // storage hydration (Phase 2) races ahead of the constructor call (Phase 3).
    const enableOvernight =
      this.initialOptions.enableOvernightPrice ??
      (this.ctx.settings as Record<string, unknown>)?.enableOvernightPrice;
    this.logger.info("overnightEnable", {
      fromOptions: this.initialOptions.enableOvernightPrice,
      fromSettings: (this.ctx.settings as Record<string, unknown>)
        ?.enableOvernightPrice,
      resolved: enableOvernight,
    });
    if (enableOvernight) {
      this.overnightBridge.setEnabled(true);
    }

    this.logger.info("BackendOrchestrator started");
  }

  stop(): void {
    if (!this.started) {
      this.logger.debug(
        "BackendOrchestrator already stopped, skipping duplicate stop",
      );
      return;
    }
    this.started = false;

    this.phaseManager.stopPeriodicCheck();

    if (this.unsubscribeHoldingsFrame) {
      this.unsubscribeHoldingsFrame();
      this.unsubscribeHoldingsFrame = null;
    }

    this.persistor.dispose();

    this.scheduler.stop();
    this.streamerBridge.teardown();
    this.overnightBridge.setEnabled(false);
    this.newsFeedBridge.stop();
    this.holdingsDataService.stop();
    this.latestFrame = null;
    this.eventBus.clear();
    this.logger.info("BackendOrchestrator stopped");
  }

  // ── Streamer ─────────────────────────────────────────────────────────────

  connectStreamer(streamer: StreamerLike): void {
    this.streamerBridge.connect(streamer);
    // If the current phase doesn't use the streamer, disconnect the raw
    // WebSocket immediately.  The bridge retains the reference so
    // `reconnect()` can re-establish it on the next market-phase entry.
    if (!this.phaseManager.usesStreamer()) {
      this.streamerBridge.disconnect();
    }
  }

  // ── Data injection (warm-start) ──────────────────────────────────────────

  injectCachedHoldings(holdings: HoldingsResponse): void {
    this.ingestHoldingsAndDispatchSymbols(holdings, { persist: false });
  }

  injectCachedBeta(stored: unknown): void {
    this.betaManager.hydrateFromStorage(stored);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  updateSettings(newSettings: Record<string, any>): void {
    routeSettingsUpdate(
      {
        ctx: this.ctx,
        holdingsDataService: this.holdingsDataService,
        scheduler: this.scheduler,
        streamerBridge: this.streamerBridge,
        overnightBridge: this.overnightBridge,
        phaseManager: this.phaseManager,
        logger: this.logger,
        reregisterHoldings: () => this.reregisterHoldings(),
        reregisterQuotes: () => this.reregisterQuotes(),
        reregisterBalances: () => this.reregisterBalances(),
      },
      newSettings,
    );
  }

  // ── Convenience getters ──────────────────────────────────────────────────

  getLatestFrame(): HoldingsFrame | null {
    return this.latestFrame;
  }

  getBetaService(): BetaService {
    return this.betaManager.getBetaService();
  }

  getChartDataService(): ChartDataService {
    return this.chartDataSvc;
  }

  getBetaCalcStatus(): { isFetching: boolean; error: unknown | null } {
    return this.scheduler.getStatus("beta-recalc");
  }

  getStreamerBridge(): StreamerBridge {
    return this.streamerBridge;
  }

  // ── Phase override API (in-memory only, not persisted) ──────────────────

  setSourceOverride(key: PhaseSourceKey, state: SchedulerOverride): void {
    this.sourceOverrideManager.setOverride(key, state);
    this.sourceOverrideManager.applySourceOverrides(this.phaseManager.getPhase());
  }

  getSourceOverride(key: PhaseSourceKey): SchedulerOverride {
    return this.sourceOverrideManager.getOverride(key);
  }

  getSourceOverrides(): ReadonlyMap<PhaseSourceKey, SchedulerOverride> {
    return this.sourceOverrideManager.getAll();
  }

  getCurrentPhase(): OrchestratorPhase {
    return this.phaseManager.getPhase();
  }

  private applySourceOverrides(phase: OrchestratorPhase): void {
    this.sourceOverrideManager.applySourceOverrides(phase);
  }

  // ── Manual triggers ──────────────────────────────────────────────────────

  triggerRebalanceRecalc(): void {
    this.triggerQuotesRefreshNow();
    this.triggerBetaRecalc();
  }

  triggerBetaRecalc(): void {
    this.betaManager.invalidateCache();
    const settings = this.ctx.settings || {};
    const interval =
      settings.betaRefreshIntervalMs || DEFAULT_BETA_RECALC_INTERVAL_MS;
    this.scheduler.updateInterval("beta-recalc", interval);
  }

  // ── Overnight transition (Yahoo WS lifecycle) ─────────────────────────

  /**
   * Called by OvernightBridge when the Yahoo overnight WS connects/disconnects.
   * Phase-level orchestration (warmup, polling pause, streamer mode) is
   * handled by `transitionToPhase`; this callback only logs the event.
   */
  private handleOvernightTransition(active: boolean): void {
    this.logger.debug("overnight:transition", {
      active,
      phase: this.phaseManager.getPhase(),
    });
    if (active) {
      this.logger.info("OvernightBridge active — Yahoo WS connected");
    } else {
      this.logger.info("OvernightBridge inactive — Yahoo WS disconnected");
    }
  }

  // ── Internal: polling setup ──────────────────────────────────────────────

  private setupPolling(): void {
    runSetupPolling({
      ctx: this.ctx,
      scheduler: this.scheduler,
      phaseManager: this.phaseManager,
      betaManager: this.betaManager,
      holdingsDataService: this.holdingsDataService,
      eventBus: this.eventBus,
      persistor: this.persistor,
      logger: this.logger,
      fetchHoldingsTask: this.fetchHoldingsTask,
      setFetchQuotesTask: (task) => {
        this.fetchQuotesTask = task;
      },
      setFetchBalancesTask: (task) => {
        this.fetchBalancesTask = task;
      },
      getLatestFrame: () => this.latestFrame,
      setLatestFrame: (frame) => {
        this.latestFrame = frame;
      },
      warmupForOvernight: () => this.warmupForOvernight(),
      withLatestBeta: (data) => this.withLatestBeta(data),
    });
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private withLatestBeta(data: HoldingsFrame): HoldingsFrame {
    if (!data || !this.betaManager.latestBetaData) return data;
    return { ...data, beta: this.betaManager.latestBetaData } as any;
  }

  private ingestHoldingsAndDispatchSymbols(
    holdings: HoldingsResponse,
    options: { persist?: boolean; includeStreamer?: boolean } = {},
  ): void {
    if (options.persist !== false) {
      // Persist BEFORE updating ctx.rawHoldings so that storage.set()
      // sees the old reference and isEqual() does not short-circuit on
      // identity (a === b), which would silently skip the IDB write.
      this.persistor.persistRawHoldings(holdings);
      this.ctx.rawHoldings = holdings;
    }
    this.holdingsDataService.ingestHoldings(holdings);
    const delta = this.holdingsDataService.getLatestSymbolDelta();
    this.dispatchSymbolDelta(delta, {
      includeStreamer: options.includeStreamer,
    });
  }

  private dispatchSymbolDelta(
    delta: SymbolDelta,
    options: { includeStreamer?: boolean } = {},
  ): void {
    this.eventBus.emit("symbols:changed", delta);
    if (options.includeStreamer !== false) {
      this.streamerBridge.handleSymbolDelta(delta);
    }
    this.overnightBridge.handleSymbolDelta(delta);
    this.newsFeedBridge.handleSymbolDelta(delta);
  }

  /**
   * One-shot dual holdings fetch + quotes so state is populated
   * before Yahoo overnight updates start arriving.
   * Called once when entering the overnight phase; polling is already
   * paused at this point so no scheduler interaction is needed.
   */
  private warmupForOvernight(): void {
    this.logger.info("overnightWarmup:start");
    const run = async () => {
      try {
        // Explicit dual fetch (extended + regular) regardless of fetchHoldingsTask
        const holdings = await fetchDualHoldings(
          this.ctx.authToken,
          this.ctx.accountId!,
        );
        this.ingestHoldingsAndDispatchSymbols(holdings, {
          includeStreamer: false,
        });
        this.logger.debug("overnightWarmup:holdingsDone", {
          trackedSymbols: this.holdingsDataService.getTrackedSymbols().length,
        });

        if (this.fetchQuotesTask) {
          await this.fetchQuotesTask();
        }
        this.logger.info("overnightWarmup:done");
      } catch (err) {
        this.logger.error("overnightWarmupFailed", {
          error: (err as Error)?.message ?? String(err),
        });
      }
    };
    void run();
  }

  private triggerQuotesRefreshNow(): void {
    if (!this.fetchQuotesTask) return;
    const quotesStatus = this.scheduler.getStatus("quotes");
    if (quotesStatus.isFetching) return;
    void this.fetchQuotesTask().catch((err: unknown) => {
      this.logger.error("manualQuotesRefreshFailed", {
        error: (err as Error)?.message ?? String(err),
      });
    });
  }

  private reregisterHoldings(): void {
    if (!this.fetchHoldingsTask) return;
    const settings = this.ctx.settings || {};
    const interval = settings.holdingsRefreshInterval || 10000;
    this.scheduler.register({
      key: "holdings",
      intervalMs: interval,
      fetcher: this.fetchHoldingsTask,
    });
  }

  private reregisterQuotes(): void {
    if (!this.fetchQuotesTask) return;
    const settings = this.ctx.settings || {};
    const interval = settings.quotesRefreshInterval || 15000;
    this.scheduler.register({
      key: "quotes",
      intervalMs: interval,
      fetcher: this.fetchQuotesTask,
    });
  }

  private reregisterBalances(): void {
    if (!this.fetchBalancesTask) return;
    const settings = this.ctx.settings || {};
    const interval = settings.balancesRefreshInterval || 1000;
    this.scheduler.register({
      key: "balances",
      intervalMs: interval,
      fetcher: this.fetchBalancesTask,
    });
  }
}
