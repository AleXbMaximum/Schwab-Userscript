import type{ DerivedState } from "../../../shared/types/derived";
import type { Logger } from "../../../shared/log/Logger";
import {
  BETA_BENCHMARKS,
  type BetaBenchmarkSymbol,
  type TickerBetaBundle,
  type ThreeFactorBundle,
} from "../../computation/beta/types";
import { BetaService, type AllBenchmarkBetaData } from "./BetaService";
import { enrichDerivedStateWithBeta } from "../../computation/beta/betaEnrichment";
import type { TypedEventBus } from "../../../shared/utils/state/TypedEventBus";
import type { BackendEvents } from "../orchestration/EventBus";

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTickerSymbol(raw: unknown): string {
  return typeof raw === "string" ? raw.toUpperCase().trim() : "";
}

function normalizeExtraBetaTickers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const next: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const sym = normalizeTickerSymbol(item);
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    next.push(sym);
  }
  return next;
}

// ── BetaManager ──────────────────────────────────────────────────────────────

export type ExtraBetaTickersPersist = (tickers: string[]) => void;

export class BetaManager {
  private readonly betaService: BetaService;
  private readonly eventBus: TypedEventBus<BackendEvents>;
  private readonly logger: Logger;
  private readonly persistExtraTickers: ExtraBetaTickersPersist;

  private allBenchmarkBetaData: AllBenchmarkBetaData = new Map();
  private threeFactorData: Map<string, ThreeFactorBundle> = new Map();
  private currentBenchmark: BetaBenchmarkSymbol = "$SPX";
  private extraBetaTickers: string[];

  /** Guards against concurrent computeAll() calls — returns existing promise if in-flight. */
  private pendingCompute: Promise<{
    allResults: AllBenchmarkBetaData;
    threeFactorResults: Map<string, ThreeFactorBundle>;
  }> | null = null;

  constructor(
    betaService: BetaService,
    eventBus: TypedEventBus<BackendEvents>,
    logger: Logger,
    initialExtraTickers: string[],
    persistExtraTickers: ExtraBetaTickersPersist,
  ) {
    this.betaService = betaService;
    this.eventBus = eventBus;
    this.logger = logger;
    this.extraBetaTickers = normalizeExtraBetaTickers(initialExtraTickers);
    this.persistExtraTickers = persistExtraTickers;
  }

  // ── Benchmark management ─────────────────────────────────────────────────

  getCurrentBenchmark(): BetaBenchmarkSymbol {
    return this.currentBenchmark;
  }

  /**
   * Switch active benchmark. Swaps data from cache instantly
   * (no re-fetch or re-computation needed).
   */
  setBenchmark(symbol: string): void {
    if (this.currentBenchmark === symbol) return;
    this.currentBenchmark = symbol as BetaBenchmarkSymbol;

    const currentData =
      this.allBenchmarkBetaData.get(symbol) ??
      new Map<string, TickerBetaBundle>();
    this.eventBus.emit("beta:updated", currentData);
  }

  // ── Extra beta tickers ───────────────────────────────────────────────────

  getExtraBetaTickers(): string[] {
    return [...this.extraBetaTickers];
  }

  addExtraBetaTicker(
    symbol: string,
    hasHolding: (sym: string) => boolean,
  ): void {
    const sym = normalizeTickerSymbol(symbol);
    if (!sym || this.extraBetaTickers.includes(sym) || hasHolding(sym)) return;
    this.extraBetaTickers.push(sym);
    this.persistExtraTickers(this.extraBetaTickers);
  }

  removeExtraBetaTicker(symbol: string): void {
    const sym = normalizeTickerSymbol(symbol);
    const idx = this.extraBetaTickers.indexOf(sym);
    if (idx < 0) return;
    this.extraBetaTickers.splice(idx, 1);
    this.persistExtraTickers(this.extraBetaTickers);
    for (const [, dataMap] of this.allBenchmarkBetaData) dataMap.delete(sym);

    const currentData =
      this.allBenchmarkBetaData.get(this.currentBenchmark) ??
      new Map<string, TickerBetaBundle>();
    this.eventBus.emit("beta:updated", currentData);
  }

  // ── Computation ──────────────────────────────────────────────────────────

  /**
   * Compute beta for all symbols across all benchmarks in a single pass.
   * Emits events to all subscribers when done.
   */
  async computeAll(symbols: string[]): Promise<{
    allResults: AllBenchmarkBetaData;
    threeFactorResults: Map<string, ThreeFactorBundle>;
  }> {
    // Coalesce concurrent calls: if a computation is already in-flight, return it.
    if (this.pendingCompute) {
      this.logger.info("betaComputeCoalesced", {
        reason: "computation already in-flight",
      });
      return this.pendingCompute;
    }

    const allSymbols = [...new Set([...symbols, ...this.extraBetaTickers])];
    if (allSymbols.length === 0) {
      return {
        allResults: new Map() as AllBenchmarkBetaData,
        threeFactorResults: new Map<string, ThreeFactorBundle>(),
      };
    }

    this.pendingCompute = this.betaService
      .computeAllModelsForAll(allSymbols, BETA_BENCHMARKS, 3)
      .then(({ singleFactor, threeFactor }) => ({
        allResults: singleFactor,
        threeFactorResults: threeFactor,
      }))
      .finally(() => {
        this.pendingCompute = null;
      });

    return this.pendingCompute;
  }

  /**
   * Store results and emit events. Called from the polling onUpdate callback.
   */
  applyComputationResults(result: {
    allResults: AllBenchmarkBetaData;
    threeFactorResults: Map<string, ThreeFactorBundle>;
  }): void {
    const { allResults, threeFactorResults } = result;
    this.allBenchmarkBetaData = allResults;
    this.threeFactorData = threeFactorResults;

    // Log three-factor computation diagnostics
    let tfWithData = 0;
    let tfTotal = 0;
    for (const [, bundle] of threeFactorResults) {
      tfTotal++;
      if (bundle.short || bundle.medium || bundle.long || bundle.ultraShort)
        tfWithData++;
    }
    this.logger.info("betaRecalcDone", {
      singleFactor: [...allResults.values()].reduce((s, m) => s + m.size, 0),
      threeFactor: tfTotal,
      threeFactorWithData: tfWithData,
    });

    // Emit events
    const currentData =
      allResults.get(this.currentBenchmark) ??
      new Map<string, TickerBetaBundle>();
    this.eventBus.emit("beta:updated", currentData);
    this.eventBus.emit("beta:allBenchmarks", allResults);
    this.eventBus.emit("threeFactor:updated", threeFactorResults);
  }

  // ── Enrichment ───────────────────────────────────────────────────────────

  /**
   * Enrich a DerivedState in-place with current benchmark's beta values.
   * Uses SPX for portfolio-level weighted beta.
   */
  enrichDerivedState(
    derived: DerivedState | null | undefined,
    touchedKeys?: string[] | null,
  ): void {
    enrichDerivedStateWithBeta(
      derived,
      this.latestBetaData,
      touchedKeys,
      this.spxBetaData,
    );
  }

  // ── Cache access ─────────────────────────────────────────────────────────

  get latestBetaData(): Map<string, TickerBetaBundle> | null {
    return this.allBenchmarkBetaData.get(this.currentBenchmark) ?? null;
  }

  get spxBetaData(): Map<string, TickerBetaBundle> | null {
    return this.allBenchmarkBetaData.get("$SPX") ?? null;
  }

  getAllBenchmarkBetaData(): AllBenchmarkBetaData {
    return this.allBenchmarkBetaData;
  }

  getThreeFactorData(): Map<string, ThreeFactorBundle> {
    return this.threeFactorData;
  }

  getBetaService(): BetaService {
    return this.betaService;
  }

  invalidateCache(): void {
    this.betaService.invalidate();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  /**
   * Hydrate from IndexedDB storage.
   * Supports both legacy (flat) and new (benchmark-keyed) formats.
   */
  hydrateFromStorage(stored: unknown): void {
    try {
      if (!stored || typeof stored !== "object") return;

      const firstValue = Object.values(stored as Record<string, unknown>)[0];
      const isLegacy =
        firstValue &&
        typeof firstValue === "object" &&
        "symbol" in (firstValue as Record<string, unknown>);

      if (isLegacy) {
        const map = new Map<string, TickerBetaBundle>();
        for (const [sym, bundle] of Object.entries(
          stored as Record<string, TickerBetaBundle>,
        )) {
          map.set(sym, bundle);
        }
        if (map.size === 0) return;
        const bm = (firstValue as TickerBetaBundle).benchmark || "$SPX";
        this.allBenchmarkBetaData.set(bm, map);
        this.logger.info("hydrateBetaFromStorage", {
          format: "legacy",
          benchmark: bm,
          symbols: map.size,
        });
      } else {
        for (const [bm, innerObj] of Object.entries(
          stored as Record<string, Record<string, TickerBetaBundle>>,
        )) {
          const map = new Map<string, TickerBetaBundle>();
          for (const [sym, bundle] of Object.entries(innerObj)) {
            map.set(sym, bundle);
          }
          if (map.size > 0) this.allBenchmarkBetaData.set(bm, map);
        }
        const totalSymbols = [...this.allBenchmarkBetaData.values()].reduce(
          (s, m) => s + m.size,
          0,
        );
        this.logger.info("hydrateBetaFromStorage", {
          format: "multi",
          benchmarks: [...this.allBenchmarkBetaData.keys()],
          totalSymbols,
        });
      }
    } catch (err) {
      this.logger.warn("hydrateBetaFromStorageFailed", {
        error: (err as Error)?.message ?? String(err),
      });
    }
  }

  /** Serialize for persistence to IndexedDB. */
  serializeForStorage(): Record<string, Record<string, TickerBetaBundle>> {
    const plain: Record<string, Record<string, TickerBetaBundle>> = {};
    for (const [bm, dataMap] of this.allBenchmarkBetaData) {
      const inner: Record<string, TickerBetaBundle> = {};
      for (const [sym, bundle] of dataMap) {
        inner[sym] = bundle;
      }
      plain[bm] = inner;
    }
    return plain;
  }
}
