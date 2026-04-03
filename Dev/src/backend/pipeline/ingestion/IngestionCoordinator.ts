import type { StateRepository } from "../../../shared/utils/StateRepository";
import type { Logger } from "../../../shared/log/Logger";
import type { Clock } from "../../../shared/utils/Clock";
import type{ HoldingsResponse, HoldingsRow, QuotesResponse } from "../../../shared/types/holdings";
import type { RawDataState } from "./DataIngestion";
import type { StreamerUpdate } from "backend/core/network/types";

import {
  applyHoldings,
  applyQuotes,
  applyStreamerUpdates,
  applyOvernightUpdates,
  mergeQuotesIntoHoldingsRows,
  createEmptyRawState,
} from "./DataIngestion";
import type { StreamerIngestionMode } from "./DataIngestion";
import type { OvernightPriceUpdate } from "backend/core/network/yahoo/overnightStreamer";
import { normalizeHoldings } from "./SentinelNormalizer";
import type {
  HoldingsIndexBuilder,
  HoldingsIndex,
  SymbolMap,
} from "./HoldingsIndexBuilder";
import type{ DerivedState } from "../../../shared/types/derived";
import { logService } from "../../../shared/log/core/LogService";
import { clearOptMetaCache } from "../../computation/holdings/derivedMetrics";

const streamerFlow = logService.namespace("flow:strm");

export type SymbolDelta = {
  added: string[];
  removed: string[];
  all: string[];
};

export type DirtyState = {
  isDirty: boolean;
  needsFullRebuild: boolean;
  touchedHoldingsKeys: Set<string>;
  touchedUnderlyingKeys: Set<string>;
};

export class IngestionCoordinator {
  private stateRepo: StateRepository<RawDataState, DerivedState>;
  private indexBuilder: HoldingsIndexBuilder;
  private logger: Logger;
  private clock: Clock;

  private isDirty = false;
  private needsFullRebuild = true;
  private touchedHoldingsKeys = new Set<string>();
  private touchedUnderlyingKeys = new Set<string>();

  private cachedSymbolMap: SymbolMap | null = null;
  private cachedHoldingsIndex: HoldingsIndex | null = null;
  private streamerIngestionMode: StreamerIngestionMode = "full";

  private lastTrackedSymbols = new Set<string>();
  private lastSymbolDelta: {
    added: Set<string>;
    removed: Set<string>;
    all: Set<string>;
  } = {
    added: new Set(),
    removed: new Set(),
    all: new Set(),
  };
  private dirtyListeners = new Set<() => void>();

  constructor(
    stateRepo: StateRepository<RawDataState, DerivedState>,
    indexBuilder: HoldingsIndexBuilder,
    logger: Logger,
    clock: Clock,
  ) {
    this.stateRepo = stateRepo;
    this.indexBuilder = indexBuilder;
    this.logger = logger;
    this.clock = clock;
  }

  ingestHoldings(holdings: HoldingsResponse): void {
    // Clear cached option contract meta on new holdings (handles daily DTE refresh)
    clearOptMetaCache();

    const currentVersionedState = this.stateRepo.getRawState();
    const currentState = currentVersionedState?.data || createEmptyRawState();

    // Reuse cached old symbols instead of rebuilding from scratch
    const oldSymbols = this.cachedSymbolMap
      ? new Set(this.cachedSymbolMap.keys())
      : this.computeSymbolSetFromHoldings(currentState.holdings);

    const sanitizedHoldings = normalizeHoldings(
      holdings,
      currentState.holdings,
      (h) => this.indexBuilder.buildHoldingsIndex(h),
    );

    // Single-pass construction of both index and symbol map
    const { index: newIndex, symbolMap: newSymbolMap } =
      this.indexBuilder.buildIndexAndSymbolMap(sanitizedHoldings);
    this.cachedSymbolMap = newSymbolMap;
    this.cachedHoldingsIndex = newIndex;
    const newSymbols = new Set(newSymbolMap.keys());

    this.lastSymbolDelta = this.computeSymbolDelta(oldSymbols, newSymbols);
    if (
      this.lastSymbolDelta.added.size > 0 ||
      this.lastSymbolDelta.removed.size > 0
    ) {
      this.logger.info(
        `[Holdings] Symbol delta - added: ${this.lastSymbolDelta.added.size}, removed: ${this.lastSymbolDelta.removed.size}`,
      );
    }
    this.lastTrackedSymbols = newSymbols;

    const newState = applyHoldings(currentState, sanitizedHoldings);

    mergeQuotesIntoHoldingsRows(newState);

    const version = this.stateRepo.nextVersion();
    this.stateRepo.saveRawState({
      data: newState,
      version,
      asOfTs: this.clock.now(),
      source: "holdings",
    });

    this.needsFullRebuild = true;
    this.markDirty();
    this.logger.info(`Ingested holdings, version ${version}`);
  }

  ingestQuotes(quotes: QuotesResponse): void {
    const currentVersionedState = this.stateRepo.getRawState();
    const currentState = currentVersionedState?.data || createEmptyRawState();

    const newState = applyQuotes(currentState, quotes);

    const quoteTouchedKeys = mergeQuotesIntoHoldingsRows(newState);

    const version = this.stateRepo.nextVersion();
    this.stateRepo.saveRawState({
      data: newState,
      version,
      asOfTs: this.clock.now(),
      source: "quotes",
    });

    // Quotes only update values (bid/ask/lastPrice) on existing rows — no structural change.
    // Use incremental dirty tracking instead of forcing a full rebuild.
    if (quoteTouchedKeys.size > 0) {
      for (const pk of quoteTouchedKeys) {
        this.touchedHoldingsKeys.add(pk);
      }
      // Resolve underlying keys for touched holdings
      const holdingsIndex =
        this.cachedHoldingsIndex ??
        (newState.holdings
          ? this.indexBuilder.buildHoldingsIndex(newState.holdings)
          : null);
      if (holdingsIndex) {
        for (const pk of quoteTouchedKeys) {
          const meta = holdingsIndex.get(pk);
          if (meta?.underlyingKey) {
            this.touchedUnderlyingKeys.add(meta.underlyingKey);
          }
        }
      }
    } else if (!this.stateRepo.getDerivedState()) {
      // No derived state yet — need a full rebuild to bootstrap
      this.needsFullRebuild = true;
    }
    this.markDirty();
    this.logger.debug(
      `Ingested quotes, version ${version}, touched ${quoteTouchedKeys.size} keys`,
    );
  }

  ingestStreamerUpdates(updates: StreamerUpdate[]): void {
    if (updates.length === 0) return;

    const strmDebug = streamerFlow.levelEnabled("debug");
    if (strmDebug) {
      streamerFlow.debug("ingest", () => ({
        mode: this.streamerIngestionMode,
        updateCount: updates.length,
        updates: updates.slice(0, 5).map((u) => {
          const o: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(u)) {
            if (v !== undefined) o[k] = v;
          }
          return o;
        }),
      }));
    }

    const currentVersionedState = this.stateRepo.getRawState();
    const currentState = currentVersionedState?.data || createEmptyRawState();

    if (!this.cachedSymbolMap && currentState.holdings) {
      this.cachedSymbolMap = this.indexBuilder.buildSymbolMap(currentState.holdings);
    }
    const symbolMap = this.cachedSymbolMap ?? new Map<string, HoldingsRow>();

    const result = applyStreamerUpdates(
      currentState,
      updates,
      symbolMap,
      this.streamerIngestionMode,
    );

    if (result.touchedHoldingsKeys.size === 0) {
      return;
    }

    const version = this.stateRepo.nextVersion();
    this.stateRepo.saveRawState({
      data: result.newState,
      version,
      asOfTs: this.clock.now(),
      source: "streamer",
    });

    for (const pk of result.touchedHoldingsKeys) {
      this.touchedHoldingsKeys.add(pk);
    }

    const holdingsIndex =
      this.cachedHoldingsIndex ??
      (result.newState.holdings
        ? this.indexBuilder.buildHoldingsIndex(result.newState.holdings)
        : null);
    if (holdingsIndex) {
      for (const pk of result.touchedHoldingsKeys) {
        const meta = holdingsIndex.get(pk);
        if (meta?.underlyingKey) {
          this.touchedUnderlyingKeys.add(meta.underlyingKey);
        }
      }
    }

    this.markDirty();
    this.logger.debug(
      `Ingested streamer updates, version ${version}, touched ${result.touchedHoldingsKeys.size} holdings`,
    );
  }

  setStreamerIngestionMode(mode: StreamerIngestionMode): void {
    const prev = this.streamerIngestionMode;
    this.streamerIngestionMode = mode;
    streamerFlow.debug("modeChange", { from: prev, to: mode });
  }

  ingestOvernightUpdates(updates: OvernightPriceUpdate[]): void {
    if (updates.length === 0) return;

    const currentVersionedState = this.stateRepo.getRawState();
    const currentState = currentVersionedState?.data || createEmptyRawState();

    const result = applyOvernightUpdates(currentState, updates);
    if (!result.hasChanges) return;

    const version = this.stateRepo.nextVersion();
    this.stateRepo.saveRawState({
      data: result.newState,
      version,
      asOfTs: this.clock.now(),
      source: "overnight",
    });

    for (const sym of result.touchedSymbols) {
      this.touchedUnderlyingKeys.add(sym);
    }

    this.markDirty();
    this.logger.debug(
      `Ingested overnight updates, version ${version}, touched ${result.touchedSymbols.size} symbols`,
    );
  }

  consumeDirtyState(): DirtyState {
    // Swap references: hand off current Sets, allocate fresh empties (cheaper than copying)
    const state: DirtyState = {
      isDirty: this.isDirty,
      needsFullRebuild: this.needsFullRebuild,
      touchedHoldingsKeys: this.touchedHoldingsKeys,
      touchedUnderlyingKeys: this.touchedUnderlyingKeys,
    };

    this.isDirty = false;
    this.needsFullRebuild = false;
    this.touchedHoldingsKeys = new Set<string>();
    this.touchedUnderlyingKeys = new Set<string>();

    return state;
  }

  peekIsDirty(): boolean {
    return this.isDirty;
  }

  onDirty(callback: () => void): () => void {
    this.dirtyListeners.add(callback);
    return () => this.dirtyListeners.delete(callback);
  }

  forceFullRebuild(): void {
    this.needsFullRebuild = true;
    this.markDirty();
  }

  getCachedHoldingsIndex(): HoldingsIndex | null {
    return this.cachedHoldingsIndex;
  }

  getTrackedSymbols(): string[] {
    const rawState = this.stateRepo.getRawState();
    if (!rawState?.data.holdings) {
      return Array.from(this.lastTrackedSymbols);
    }
    if (this.cachedSymbolMap) return Array.from(this.cachedSymbolMap.keys());
    const symbolMap = this.indexBuilder.buildSymbolMap(rawState.data.holdings);
    return Array.from(symbolMap.keys());
  }

  getLatestSymbolDelta(): SymbolDelta {
    return {
      added: Array.from(this.lastSymbolDelta.added),
      removed: Array.from(this.lastSymbolDelta.removed),
      all: Array.from(this.lastSymbolDelta.all),
    };
  }

  private markDirty(): void {
    const wasDirty = this.isDirty;
    this.isDirty = true;
    if (!wasDirty && this.dirtyListeners.size > 0) {
      for (const listener of this.dirtyListeners) {
        try {
          listener();
        } catch (error) {
          this.logger.warn("Dirty listener error", error);
        }
      }
    }
  }

  private computeSymbolSetFromHoldings(
    holdings: HoldingsResponse | null,
  ): Set<string> {
    if (!holdings) return new Set();
    const map = this.indexBuilder.buildSymbolMap(holdings);
    return new Set(map.keys());
  }

  private computeSymbolDelta(
    oldSet: Set<string>,
    newSet: Set<string>,
  ): { added: Set<string>; removed: Set<string>; all: Set<string> } {
    const added = new Set<string>();
    const removed = new Set<string>();
    for (const s of newSet) {
      if (!oldSet.has(s)) added.add(s);
    }
    for (const s of oldSet) {
      if (!newSet.has(s)) removed.add(s);
    }
    return { added, removed, all: newSet };
  }

}
