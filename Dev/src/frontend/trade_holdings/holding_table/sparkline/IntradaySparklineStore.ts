import type { ChartDataService } from "backend/core/network/chart/ChartDataService";
import { getMarketSessionCT } from "shared/utils/time";

export interface IntradaySparklineData {
  prices: number[];
  timestamps: number[];
  previousClose: number | null;
  fetchedAt: number;
}

const MAX_CONCURRENT = 3;
const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutes
const FAIL_BACKOFF_MS = 15 * 60 * 1000; // 15 minutes before retrying a failed symbol

type Listener = (symbol: string) => void;

export class IntradaySparklineStore {
  private chartService: ChartDataService;
  private cache = new Map<string, IntradaySparklineData>();
  private failedAt = new Map<string, number>(); // symbol → timestamp of last failure
  private pending = new Set<string>();
  private queue: string[] = [];
  private active = 0;
  private listeners = new Set<Listener>();
  private disposed = false;
  private staleMs = DEFAULT_STALE_MS;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private lastRequestedSymbols: string[] = [];
  private lastRequestedSymbolSet: Set<string> | null = null;

  constructor(chartService: ChartDataService) {
    this.chartService = chartService;
  }

  get(symbol: string): IntradaySparklineData | null {
    return this.cache.get(symbol) ?? null;
  }

  setPreviousClose(symbol: string, previousClose: number): void {
    const entry = this.cache.get(symbol);
    if (entry && previousClose > 0) {
      entry.previousClose = previousClose;
    }
  }

  onUpdate(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  requestSymbols(symbols: string[]): void {
    if (this.disposed) return;

    // Short-circuit: if the symbol set is identical and no entry is stale, skip iteration.
    if (
      this.lastRequestedSymbolSet !== null &&
      symbols.length === this.lastRequestedSymbolSet.size
    ) {
      let same = true;
      for (const s of symbols) {
        if (!this.lastRequestedSymbolSet.has(s)) {
          same = false;
          break;
        }
      }
      if (same && this.queue.length === 0 && this.pending.size === 0) {
        const now = Date.now();
        let allFresh = true;
        for (const s of symbols) {
          const e = this.cache.get(s);
          if (!e || now - e.fetchedAt >= this.staleMs) {
            allFresh = false;
            break;
          }
        }
        if (allFresh) {
          this.lastRequestedSymbols = symbols;
          return;
        }
      }
    }

    this.lastRequestedSymbols = symbols;
    this.lastRequestedSymbolSet = new Set(symbols);
    const now = Date.now();

    for (const sym of symbols) {
      if (this.pending.has(sym)) continue;

      const existing = this.cache.get(sym);
      if (existing && now - existing.fetchedAt < this.staleMs) continue;

      // Skip symbols that recently failed (e.g. non-tradeable like FCash, FMktV)
      const lastFail = this.failedAt.get(sym);
      if (lastFail && now - lastFail < FAIL_BACKOFF_MS) continue;

      this.pending.add(sym);
      this.queue.push(sym);
    }

    this.drain();
  }

  setRefreshInterval(intervalMs: number): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.staleMs = intervalMs > 0 ? intervalMs : DEFAULT_STALE_MS;
    if (intervalMs > 0 && !this.disposed) {
      this.refreshTimer = setInterval(() => {
        // Only auto-refresh during regular market hours.
        // Pre-market / after-hours / overnight get a single fetch on page load only.
        if (getMarketSessionCT() !== "Open") return;
        if (this.lastRequestedSymbols.length > 0) {
          this.requestSymbols(this.lastRequestedSymbols);
        }
      }, intervalMs);
    }
  }

  getRefreshInterval(): number {
    return this.refreshTimer !== null ? this.staleMs : 0;
  }

  refreshAll(): void {
    const syms = [...this.cache.keys()];
    for (const sym of syms) {
      this.cache.delete(sym);
    }
    this.failedAt.clear();
    this.requestSymbols(syms);
  }

  dispose(): void {
    this.disposed = true;
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.queue.length = 0;
    this.pending.clear();
    this.cache.clear();
    this.failedAt.clear();
    this.listeners.clear();
  }

  private drain(): void {
    while (this.active < MAX_CONCURRENT && this.queue.length > 0) {
      const sym = this.queue.shift()!;
      this.active++;
      void this.fetchOne(sym);
    }
  }

  private async fetchOne(symbol: string): Promise<void> {
    try {
      const result = await this.chartService.fetch({
        symbol,
        interval: "1m",
        window: { kind: "range", range: "1d" },
        includePrePost: false,
      });

      const bars = result.bars;
      if (bars.length < 2) return;

      const prices = bars.map((b) => b.close);
      const timestamps = bars.map((b) => new Date(b.date).getTime());

      // Derive previousClose: prefer meta.previousClose, fall back to
      // computing from lastPrice + changePercent (Schwab may return 0 for indices).
      let prevClose = result.meta?.previousClose ?? null;
      if (!prevClose || prevClose <= 0) {
        const lastPrice = prices[prices.length - 1];
        const chgPct = result.meta?.changePercent;
        if (lastPrice > 0 && typeof chgPct === "number" && chgPct !== 0) {
          prevClose = lastPrice / (1 + chgPct / 100);
        }
      }

      const data: IntradaySparklineData = {
        prices,
        timestamps,
        previousClose: prevClose,
        fetchedAt: Date.now(),
      };

      if (!this.disposed) {
        this.cache.set(symbol, data);
        this.failedAt.delete(symbol);
        for (const fn of this.listeners) {
          try {
            fn(symbol);
          } catch {
            /* listener errors must not break the queue */
          }
        }
      }
    } catch {
      // Network or parse error — back off before retrying.
      this.failedAt.set(symbol, Date.now());
    } finally {
      this.pending.delete(symbol);
      this.active--;
      if (!this.disposed) this.drain();
    }
  }
}
