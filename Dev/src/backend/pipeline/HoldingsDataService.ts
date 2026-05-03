import type { NetworkDataSource, StreamerUpdate } from "../core/network/types";
import type { StateRepository } from "../../shared/utils/state/StateRepository";
import type { Logger } from "../../shared/log/Logger";
import type { Clock } from "../../shared/utils/async/Clock";

import type{ HoldingsResponse, QuotesResponse } from "../../shared/types/holdings";
import type{ ChangeToken, DerivedState, HoldingsFrame } from "../../shared/types/derived";
import type {
  RawDataState,
  StreamerIngestionMode,
} from "./ingestion/DataIngestion";
import type { OvernightPriceUpdate } from "../core/network/yahoo/overnightStreamer";

import { HoldingsIndexBuilder } from "./ingestion/HoldingsIndexBuilder";
import { DerivedStatePipeline } from "./orchestration/DerivedStatePipeline";
import type { HoldingsIndex } from "./ingestion/HoldingsIndexBuilder";
import { IngestionCoordinator } from "./ingestion/IngestionCoordinator";
import { HoldingsFrameEmitter } from "./HoldingsFrameEmitter";
import { evaluateWarningsFromJson } from "../computation/holdings/rendering/warningsEngine";

export interface HoldingsDataServiceOptions {
  refreshIntervalMs?: number;
  enablePolling?: boolean;
}

export class HoldingsDataService {
  private ingestion: IngestionCoordinator;
  private emitter: HoldingsFrameEmitter;
  private indexBuilder: HoldingsIndexBuilder;
  private pipeline: DerivedStatePipeline;

  private dataSource: NetworkDataSource;
  private stateRepo: StateRepository<RawDataState, DerivedState>;
  private logger: Logger;
  private clock: Clock;
  private warningRulesJson: string | null = null;
  private lastChangeToken: ChangeToken | null = null;
  private cachedHoldingsIndex: HoldingsIndex | null = null;


  constructor(
    dataSource: NetworkDataSource,
    stateRepo: StateRepository<RawDataState, DerivedState>,
    logger: Logger,
    clock: Clock,
    options: HoldingsDataServiceOptions = {},
  ) {
    this.dataSource = dataSource;
    this.stateRepo = stateRepo;
    this.logger = logger;
    this.clock = clock;

    this.indexBuilder = new HoldingsIndexBuilder();
    this.pipeline = new DerivedStatePipeline();

    this.ingestion = new IngestionCoordinator(
      stateRepo,
      this.indexBuilder,
      logger,
      clock,
    );

    this.emitter = new HoldingsFrameEmitter(
      clock,
      logger,
      options.refreshIntervalMs ?? 500,
    );
  }

  subscribe(callback: (frame: HoldingsFrame) => void): () => void {
    return this.emitter.subscribe(callback);
  }

  getLatestFrame(): HoldingsFrame | null {
    return this.emitter.getLatestFrame();
  }

  setWarningRulesJson(json: string | null | undefined): void {
    const normalized = typeof json === "string" ? json : null;
    if (normalized !== this.warningRulesJson) {
      this.warningRulesJson = normalized;
      this.ingestion.forceFullRebuild();
    }
  }

  setRefreshInterval(ms: number): void {
    this.emitter.setRefreshInterval(ms);
  }

  async start(): Promise<void> {
    this.logger.info("HoldingsDataService starting");
    await this.loadPersistedState();
    this.emitter.start(
      () => this.ingestion.peekIsDirty(),
      () => this.buildHoldingsFrame(),
      (onDirty) => this.ingestion.onDirty(onDirty),
    );

    this.logger.info("HoldingsDataService started");
  }

  stop(): void {
    this.emitter.stop();

    this.logger.info("HoldingsDataService stopped");
  }

  ingestHoldings(holdings: HoldingsResponse): void {
    this.ingestion.ingestHoldings(holdings);
  }

  ingestQuotes(quotes: QuotesResponse): void {
    this.ingestion.ingestQuotes(quotes);
  }

  ingestStreamerUpdates(updates: StreamerUpdate[]): void {
    this.ingestion.ingestStreamerUpdates(updates);
  }

  setStreamerIngestionMode(mode: StreamerIngestionMode): void {
    this.ingestion.setStreamerIngestionMode(mode);
  }

  ingestOvernightUpdates(updates: OvernightPriceUpdate[]): void {
    this.ingestion.ingestOvernightUpdates(updates);
  }

  getTrackedSymbols(): string[] {
    return this.ingestion.getTrackedSymbols();
  }

  getLatestSymbolDelta(): {
    added: string[];
    removed: string[];
    all: string[];
  } {
    return this.ingestion.getLatestSymbolDelta();
  }

  async fetchHoldings(): Promise<void> {
    try {
      this.logger.debug("Fetching holdings");
      const holdings = await this.dataSource.fetchHoldings();
      this.ingestHoldings(holdings);
    } catch (error) {
      this.logger.error("Failed to fetch holdings:", error);
      throw error;
    }
  }

  async fetchQuotes(symbols: string[]): Promise<void> {
    try {
      this.logger.debug(`Fetching quotes for ${symbols.length} symbols`);
      const quotes = await this.dataSource.fetchQuotes(symbols);
      this.ingestQuotes(quotes);
    } catch (error) {
      this.logger.error("Failed to fetch quotes:", error);
      throw error;
    }
  }

  private async buildHoldingsFrame(): Promise<HoldingsFrame | null> {
    const dirty = this.ingestion.consumeDirtyState();
    await this.recomputeDerivedState(dirty);

    const rawState = this.stateRepo.getRawState();
    const derivedState = this.stateRepo.getDerivedState();
    if (!rawState || !derivedState) return null;

    let warningsState = null;
    try {
      warningsState = evaluateWarningsFromJson(
        this.warningRulesJson,
        derivedState.data,
      );
    } catch (error) {
      this.logger.warn("Failed to evaluate warnings:", error);
    }

    let hierarchy = null;
    if (rawState.data.holdings) {
      try {
        const holdingsIndex =
          this.cachedHoldingsIndex ??
          this.ingestion.getCachedHoldingsIndex() ??
          this.indexBuilder.buildHoldingsIndex(rawState.data.holdings);
        hierarchy = this.pipeline.buildHierarchicalHoldings(
          rawState.data.holdings,
          holdingsIndex,
          derivedState.data,
          warningsState,
        );
      } catch (error) {
        this.logger.warn("Failed to build hierarchy:", error);
      }
    }

    const frame: HoldingsFrame = {
      holdings: rawState.data.holdings,
      quotesBySymbol: rawState.data.quotesBySymbol,
      derived: derivedState.data,
      warnings: warningsState,
      hierarchy,
      changeToken: this.lastChangeToken ?? null,
      timestamp: this.clock.now(),
    };

    return frame;
  }

  private async recomputeDerivedState(dirty: {
    needsFullRebuild: boolean;
    touchedHoldingsKeys: Set<string>;
    touchedUnderlyingKeys: Set<string>;
  }): Promise<void> {
    const rawState = this.stateRepo.getRawState();
    if (!rawState?.data.holdings) return;

    let derivedVersion: number | null = null;

    if (dirty.needsFullRebuild) {
      derivedVersion = await this.performFullRebuild(rawState.data);
    } else if (
      dirty.touchedHoldingsKeys.size > 0 ||
      dirty.touchedUnderlyingKeys.size > 0
    ) {
      derivedVersion = await this.performIncrementalUpdate(
        rawState.data,
        dirty.touchedHoldingsKeys,
        dirty.touchedUnderlyingKeys,
      );
    }

    const rawVersion = this.stateRepo.getRawState()?.version ?? 0;
    if (derivedVersion != null) {
      this.lastChangeToken = {
        rawVersion,
        derivedVersion,
        touchedHoldingsKeys: dirty.needsFullRebuild
          ? []
          : Array.from(dirty.touchedHoldingsKeys),
        touchedUnderlyingKeys: dirty.needsFullRebuild
          ? []
          : Array.from(dirty.touchedUnderlyingKeys),
        fullRebuild: dirty.needsFullRebuild,
      };
    }
  }

  private async performFullRebuild(rawState: RawDataState): Promise<number> {
    this.logger.info("Performing full rebuild");

    const holdingsIndex =
      this.ingestion.getCachedHoldingsIndex() ??
      (rawState.holdings
        ? this.indexBuilder.buildHoldingsIndex(rawState.holdings)
        : new Map());
    this.cachedHoldingsIndex = holdingsIndex;
    const derivedState = this.pipeline.computeFullDerivedState(holdingsIndex);

    const version = this.stateRepo.nextVersion();
    await this.stateRepo.saveDerivedState({
      data: derivedState,
      version,
      asOfTs: this.clock.now(),
    });

    this.logger.info(`Full rebuild complete, version ${version}`);
    return version;
  }

  private async performIncrementalUpdate(
    rawState: RawDataState,
    touchedHoldingsKeys: Set<string>,
    touchedUnderlyingKeys: Set<string>,
  ): Promise<number> {
    this.logger.debug(
      `Performing incremental update, ${touchedHoldingsKeys.size} holdings touched`,
    );

    const holdingsIndex =
      this.ingestion.getCachedHoldingsIndex() ??
      (rawState.holdings
        ? this.indexBuilder.buildHoldingsIndex(rawState.holdings)
        : new Map());
    this.cachedHoldingsIndex = holdingsIndex;
    const currentDerived = this.stateRepo.getDerivedState();

    if (!currentDerived) {
      return await this.performFullRebuild(rawState);
    }

    // Mutate in-place: computeIncrementalDerivedState already writes directly
    // into the passed object's sub-dicts, so shallow copies are unnecessary.
    const existingDerived = currentDerived.data;

    this.pipeline.computeIncrementalDerivedState(
      holdingsIndex,
      existingDerived,
      touchedHoldingsKeys,
      touchedUnderlyingKeys,
    );

    const version = this.stateRepo.nextVersion();
    await this.stateRepo.saveDerivedState({
      data: existingDerived,
      version,
      asOfTs: this.clock.now(),
    });

    this.logger.debug(`Incremental update complete, version ${version}`);
    return version;
  }

  private async loadPersistedState(): Promise<void> {
    try {
      const rawState = await this.stateRepo.loadRawState();
      const derivedState = await this.stateRepo.loadDerivedState();

      if (rawState) {
        this.logger.info(
          `Loaded persisted raw state, version ${rawState.version}`,
        );
      }
      if (derivedState) {
        this.logger.info(
          `Loaded persisted derived state, version ${derivedState.version}`,
        );
      }

      if (rawState && !derivedState) {
        this.ingestion.forceFullRebuild();
      }
    } catch (error) {
      this.logger.error("Failed to load persisted state:", error);
    }
  }

}
