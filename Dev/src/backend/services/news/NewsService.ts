import { openAlexQuantDB } from "../../core/db/core/AlexQuantDB";
import { KVStore } from "../../core/db/core/KVStore";
import {
  DEFAULT_NEWS_REFRESH_INTERVALS,
  type NewsRefreshIntervals,
} from "../../../shared/settings/newsRefreshDefaults";
import { NewsMemoryStore } from "./NewsMemoryStore";
import {
  fetchYahooMacroNews,
  fetchYahooSymbolNews,
  fetchBarronsAllNews,
  fetchFinancialJuiceNews,
  fetchSchwabNews,
} from "./newsFetchers";
import { sortNewsItemsNewestFirst } from "./types";
import type { UnifiedNewsItem } from "./types";
import {
  areSymbolsEqual,
  areItemsEqual,
  normalizeNewsItemSymbols,
  mergeDuplicateNewsItems,
  normalizeSymbols,
} from "./newsItemHelpers";
import {
  fetchPerSymbol,
  resolveSourceItems,
  normalizeIntervalMs,
  formatInterval,
} from "./newsFetchHelpers";
import { summarizeNews } from "./NewsSummarizer";
import type { SummarizeMode } from "./NewsSummarizer";
import { tagNewsItems } from "./NewsTagging";
import type { TaggedNewsItem } from "./NewsTagging";
import type { AIProvidersConfig } from "../ai/config/types";
import { logService } from "shared/log/core/LogService";

export type NewsListener = (items: UnifiedNewsItem[]) => void;

export type NewsFetchSource =
  | "yahooMacro"
  | "yahooSymbol"
  | "barrons"
  | "financialJuice"
  | "schwab";

type NewsSourceHealthEntry = {
  lastSuccessAtUtcMs: number;
  lastError: string | null;
};

export type NewsSourceStateRow = {
  sourceType: NewsFetchSource;
  label: string;
  lastSuccessAtUtcMs: number;
  lastError: string | null;
};

export type { NewsRefreshIntervals };

const NEWS_FETCH_SOURCES: NewsFetchSource[] = [
  "yahooMacro",
  "yahooSymbol",
  "barrons",
  "financialJuice",
  "schwab",
];
const NEWS_GLOBAL_SOURCES: NewsFetchSource[] = [
  "financialJuice",
  "yahooMacro",
  "schwab",
];
const NEWS_SYMBOL_SOURCES: NewsFetchSource[] = ["yahooSymbol", "barrons"];

const NEWS_SOURCE_LABELS: Record<NewsFetchSource, string> = {
  yahooMacro: "Yahoo Macro",
  yahooSymbol: "Yahoo Symbol",
  barrons: "Barron's",
  financialJuice: "FinancialJuice",
  schwab: "Schwab",
};

const LOG_SYMBOL_SAMPLE_LIMIT = 10;

export { DEFAULT_NEWS_REFRESH_INTERVALS };

class NewsService {
  private items: UnifiedNewsItem[] = [];
  private symbols: string[] = [];
  private listeners = new Set<NewsListener>();
  private logger = logService.namespace("network");
  private sourceItems: Record<NewsFetchSource, UnifiedNewsItem[]> = {
    yahooMacro: [],
    yahooSymbol: [],
    barrons: [],
    financialJuice: [],
    schwab: [],
  };
  private sourceHealth: Record<NewsFetchSource, NewsSourceHealthEntry> = {
    yahooMacro: { lastSuccessAtUtcMs: 0, lastError: null },
    yahooSymbol: { lastSuccessAtUtcMs: 0, lastError: null },
    barrons: { lastSuccessAtUtcMs: 0, lastError: null },
    financialJuice: { lastSuccessAtUtcMs: 0, lastError: null },
    schwab: { lastSuccessAtUtcMs: 0, lastError: null },
  };
  private sourceTimers: Partial<
    Record<NewsFetchSource, ReturnType<typeof setInterval>>
  > = {};
  private pendingSources = new Set<NewsFetchSource>();
  private inFlightFetch: Promise<void> | null = null;
  private isFetching = false;
  private lastFetchedAt: string | null = null;
  private memory: NewsMemoryStore | null = null;
  private started = false;
  private refreshIntervals: NewsRefreshIntervals = {
    ...DEFAULT_NEWS_REFRESH_INTERVALS,
  };
  private providerResolver: (() => Promise<AIProvidersConfig>) | null = null;

  /**
   * Inject externally-fetched items (e.g. from Rust native news polling).
   * Replaces the internal items array and notifies all subscribers.
   */
  injectItems(items: UnifiedNewsItem[]): void {
    this.items = items;
    this.lastFetchedAt = new Date().toISOString();
    this.emit();
  }

  subscribe(listener: NewsListener): () => void {
    this.listeners.add(listener);
    // Defer initial emit so callers finish initialization first
    if (this.items.length > 0) {
      const cached = this.items;
      queueMicrotask(() => {
        if (this.listeners.has(listener)) listener(cached);
      });
    }
    return () => this.listeners.delete(listener);
  }

  start(symbols: string[]): void {
    this.symbols = normalizeSymbols(symbols);
    this.logger.info("News symbols initialized", {
      symbolCount: this.symbols.length,
      symbolSample: this.getSymbolSample(),
    });
    if (!this.started) {
      this.started = true;
      // Pre-warm the memory store eagerly so rebuildFromSources/markRead
      // don't pay the async DB-open cost on their first call.
      void this.ensureMemory();
      this.startPolling();
      void this.refresh();
    }
  }

  stop(): void {
    this.stopPolling();
    this.pendingSources.clear();
    this.started = false;
  }

  updateSymbols(symbols: string[]): void {
    const normalized = normalizeSymbols(symbols);
    const changed = !areSymbolsEqual(this.symbols, normalized);
    if (!changed) return;

    this.symbols = normalized;
    this.logger.info("News symbols updated", {
      symbolCount: this.symbols.length,
      symbolSample: this.getSymbolSample(),
    });

    // Keep previous symbol-scoped cache until refreshed data arrives.
    // This prevents transient empty states during symbol-set transitions.
    if (this.started && normalized.length > 0) {
      void this.requestFetch(["yahooSymbol", "barrons"]);
      return;
    }

    // If symbols are empty, clear symbol-scoped feeds explicitly.
    const hadSymbolScopedItems =
      this.sourceItems.yahooSymbol.length > 0 ||
      this.sourceItems.barrons.length > 0;
    this.sourceItems.yahooSymbol = [];
    this.sourceItems.barrons = [];
    if (hadSymbolScopedItems) {
      void this.rebuildFromSources();
    }
  }

  // ── Accessors ───────────────────────────────────────────────────

  getItems(): UnifiedNewsItem[] {
    return this.items;
  }

  getLastFetchedAt(): string | null {
    return this.lastFetchedAt;
  }

  isBusy(): boolean {
    return this.isFetching;
  }

  getRefreshIntervals(): NewsRefreshIntervals {
    return { ...this.refreshIntervals };
  }

  getAutoRefreshLabel(): string {
    const i = this.refreshIntervals;
    return (
      `Auto-refresh: FJ ${formatInterval(i.financialJuiceMs)}` +
      ` · Yahoo Macro ${formatInterval(i.yahooMacroMs)}` +
      ` · Yahoo Symbol ${formatInterval(i.yahooSymbolMs)}` +
      ` · Barron's ${formatInterval(i.barronsMs)}` +
      ` · Schwab ${formatInterval(i.schwabMs)}`
    );
  }

  updateRefreshIntervals(patch: Partial<NewsRefreshIntervals>): void {
    const next: NewsRefreshIntervals = { ...this.refreshIntervals };

    if (patch.yahooMacroMs !== undefined) {
      next.yahooMacroMs = normalizeIntervalMs(
        patch.yahooMacroMs,
        next.yahooMacroMs,
      );
    }
    if (patch.yahooSymbolMs !== undefined) {
      next.yahooSymbolMs = normalizeIntervalMs(
        patch.yahooSymbolMs,
        next.yahooSymbolMs,
      );
    }
    if (patch.barronsMs !== undefined) {
      next.barronsMs = normalizeIntervalMs(
        patch.barronsMs,
        next.barronsMs,
      );
    }
    if (patch.financialJuiceMs !== undefined) {
      next.financialJuiceMs = normalizeIntervalMs(
        patch.financialJuiceMs,
        next.financialJuiceMs,
      );
    }
    if (patch.schwabMs !== undefined) {
      next.schwabMs = normalizeIntervalMs(patch.schwabMs, next.schwabMs);
    }

    const changed =
      next.yahooMacroMs !== this.refreshIntervals.yahooMacroMs ||
      next.yahooSymbolMs !== this.refreshIntervals.yahooSymbolMs ||
      next.barronsMs !== this.refreshIntervals.barronsMs ||
      next.financialJuiceMs !== this.refreshIntervals.financialJuiceMs ||
      next.schwabMs !== this.refreshIntervals.schwabMs;
    if (!changed) return;

    this.refreshIntervals = next;
    if (this.started) {
      this.stopPolling();
      this.startPolling();
    }
  }

  // ── Mark-as-read API ───────────────────────────────────────────

  /** Mark specific items as read (persists, updates in-memory items, no emit) */
  async markRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.ensureMemory();
    await this.memory!.markRead(ids);
    const idSet = new Set(ids);
    for (let i = 0; i < this.items.length; i++) {
      if (idSet.has(this.items[i].id) && this.items[i].isNew) {
        this.items[i] = { ...this.items[i], isNew: false };
      }
    }
  }

  /** Mark all current items as read (persists, emits to re-render all views) */
  async markAllRead(): Promise<void> {
    const allIds = this.items.map((i) => i.id);
    await this.markRead(allIds);
    this.emit();
  }

  // ── Manual refresh ──────────────────────────────────────────────

  async refresh(): Promise<void> {
    // Stagger: global sources first (fast, ~200ms), then per-symbol
    // sources (heavy, up to 19 symbols × concurrency 6). This gives the
    // user visible news within ~200ms instead of waiting for the slowest
    // per-symbol source.
    await this.requestFetch(NEWS_GLOBAL_SOURCES);
    if (this.symbols.length > 0) {
      await this.requestFetch(NEWS_SYMBOL_SOURCES);
    }
  }

  // ── Internal ────────────────────────────────────────────────────

  /**
   * Eagerly initialize the NewsMemoryStore if not yet created.
   * Uses a deduped promise so multiple callers share one init path.
   */
  private _memoryInitPromise: Promise<void> | null = null;
  private async ensureMemory(): Promise<void> {
    if (this.memory) return;
    if (this._memoryInitPromise) return this._memoryInitPromise;
    this._memoryInitPromise = (async () => {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      this.memory = new NewsMemoryStore(kv);
    })();
    await this._memoryInitPromise;
  }

  private requestFetch(sources: NewsFetchSource[]): Promise<void> {
    for (const source of sources) {
      this.pendingSources.add(source);
    }

    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }

    this.inFlightFetch = this.drainFetchQueue().finally(() => {
      this.inFlightFetch = null;
      if (this.pendingSources.size > 0) {
        void this.requestFetch([]);
      }
    });

    return this.inFlightFetch;
  }

  private async drainFetchQueue(): Promise<void> {
    this.isFetching = true;

    try {
      while (this.pendingSources.size > 0) {
        const batch = Array.from(this.pendingSources);
        this.pendingSources.clear();

        const results = await Promise.allSettled(
          batch.map((source) => this.fetchSource(source)),
        );

        let hasCacheChange = false;
        let hasSuccessfulFetch = false;
        for (let i = 0; i < batch.length; i++) {
          const source = batch[i];
          const result = results[i];
          if (result.status !== "fulfilled") continue;
          hasSuccessfulFetch = true;

          const previous = this.sourceItems[source];
          const next = this.resolveSourceItems(source, result.value);
          if (!areItemsEqual(previous, next)) {
            this.sourceItems[source] = next;
            hasCacheChange = true;
          }
        }

        if (hasCacheChange) {
          await this.rebuildFromSources();
        } else if (hasSuccessfulFetch) {
          this.lastFetchedAt = new Date().toISOString();
          this.emit();
        }
      }
    } catch {
      // Silent failure — news is non-critical
    } finally {
      this.isFetching = false;
    }
  }

  private async fetchSource(
    source: NewsFetchSource,
  ): Promise<UnifiedNewsItem[]> {
    const sourceLabel = NEWS_SOURCE_LABELS[source];
    const startedAt = Date.now();
    const isSymbolScoped = source === "yahooSymbol" || source === "barrons";

    try {
      if (isSymbolScoped && this.symbols.length === 0) {
        this.logger.info("News source refresh skipped", {
          source: sourceLabel,
          sourceKey: source,
          reason: "no_symbols",
          symbolCount: this.symbols.length,
          symbolSample: this.getSymbolSample(),
        });
        return [];
      }

      let items: UnifiedNewsItem[];
      if (source === "yahooMacro") {
        items = this.sortNewestFirst(await fetchYahooMacroNews());
      } else if (source === "financialJuice") {
        items = this.sortNewestFirst(await fetchFinancialJuiceNews());
      } else if (source === "schwab") {
        items = this.sortNewestFirst(await fetchSchwabNews());
      } else if (source === "yahooSymbol") {
        items = this.sortNewestFirst(
          await this.fetchPerSymbol(fetchYahooSymbolNews),
        );
      } else {
        items = this.sortNewestFirst(
          await this.fetchPerSymbol(fetchBarronsAllNews),
        );
      }

      this.logger.info("News Fetched", {
        source: sourceLabel,
        sourceKey: source,
        itemCount: items.length,
        symbolCount: isSymbolScoped ? this.symbols.length : undefined,
        symbolSample: isSymbolScoped ? this.getSymbolSample() : undefined,
        durationMs: Date.now() - startedAt,
      });
      this.sourceHealth[source] = {
        lastSuccessAtUtcMs: Date.now(),
        lastError: null,
      };
      return items;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn("News source refresh failed", {
        source: sourceLabel,
        sourceKey: source,
        symbolCount: isSymbolScoped ? this.symbols.length : undefined,
        symbolSample: isSymbolScoped ? this.getSymbolSample() : undefined,
        durationMs: Date.now() - startedAt,
        error: errMsg,
      });
      this.sourceHealth[source] = {
        ...this.sourceHealth[source],
        lastError: errMsg,
      };
      throw error;
    }
  }

  /**
   * Per-source health snapshot for the SourceStatusIndicator UI.
   * Returns one row per known fetch source. Sources that have not yet
   * succeeded report `lastSuccessAtUtcMs: 0`; transient errors retain a
   * non-null `lastError` even after a successful retry — but the UI
   * dot mapping treats "recent success" as authoritative.
   */
  getSourceHealth(): NewsSourceStateRow[] {
    return NEWS_FETCH_SOURCES.map((source) => ({
      sourceType: source,
      label: NEWS_SOURCE_LABELS[source],
      lastSuccessAtUtcMs: this.sourceHealth[source].lastSuccessAtUtcMs,
      lastError: this.sourceHealth[source].lastError,
    }));
  }

  private fetchPerSymbol(
    fetcher: (symbol: string) => Promise<UnifiedNewsItem[]>,
  ): Promise<UnifiedNewsItem[]> {
    return fetchPerSymbol(this.symbols, fetcher);
  }

  private resolveSourceItems(
    source: NewsFetchSource,
    fetched: UnifiedNewsItem[],
  ): UnifiedNewsItem[] {
    return resolveSourceItems(
      source,
      fetched,
      this.sourceItems[source],
      this.symbols.length > 0,
    );
  }

  private async rebuildFromSources(): Promise<void> {
    const raw = [
      ...this.sourceItems.yahooMacro,
      ...this.sourceItems.yahooSymbol,
      ...this.sourceItems.barrons,
      ...this.sourceItems.financialJuice,
      ...this.sourceItems.schwab,
    ];

    const dedupedById = new Map<string, UnifiedNewsItem>();
    for (const rawItem of raw) {
      const item = normalizeNewsItemSymbols(rawItem);
      const existing = dedupedById.get(item.id);
      if (!existing) {
        dedupedById.set(item.id, item);
        continue;
      }
      dedupedById.set(item.id, mergeDuplicateNewsItems(existing, item));
    }
    const sorted = this.sortNewestFirst(Array.from(dedupedById.values()));

    await this.ensureMemory();

    this.items = await this.memory!.markAndPersist(sorted);
    this.lastFetchedAt = new Date().toISOString();
    this.emit();
  }

  private emit(): void {
    for (const cb of this.listeners) {
      try {
        cb(this.items);
      } catch {
        /* swallow listener errors */
      }
    }
  }

  private startPolling(): void {
    if (Object.keys(this.sourceTimers).length > 0) return;
    this.startSourcePolling("yahooMacro", this.refreshIntervals.yahooMacroMs);
    this.startSourcePolling("yahooSymbol", this.refreshIntervals.yahooSymbolMs);
    this.startSourcePolling("barrons", this.refreshIntervals.barronsMs);
    this.startSourcePolling(
      "financialJuice",
      this.refreshIntervals.financialJuiceMs,
    );
    this.startSourcePolling("schwab", this.refreshIntervals.schwabMs);
  }

  private stopPolling(): void {
    for (const source of NEWS_FETCH_SOURCES) {
      const timer = this.sourceTimers[source];
      if (!timer) continue;
      clearInterval(timer);
      delete this.sourceTimers[source];
    }
  }

  private startSourcePolling(
    source: NewsFetchSource,
    intervalMs: number,
  ): void {
    if (this.sourceTimers[source]) return;
    if (intervalMs <= 0) return;
    this.sourceTimers[source] = setInterval(
      () => void this.requestFetch([source]),
      intervalMs,
    );
  }

  private sortNewestFirst(items: UnifiedNewsItem[]): UnifiedNewsItem[] {
    return sortNewsItemsNewestFirst(items);
  }


  private getSymbolSample(limit = LOG_SYMBOL_SAMPLE_LIMIT): string[] {
    if (limit <= 0) return [];
    return this.symbols.slice(0, limit);
  }

  // ── AI orchestration ──────────────────────────────────────────────

  /** Inject a resolver so NewsService can load AI config without importing ai/ directly. */
  setProviderResolver(resolver: () => Promise<AIProvidersConfig>): void {
    this.providerResolver = resolver;
  }

  /**
   * Summarize news items using AI.
   * Requires a provider resolver to be set via setProviderResolver().
   */
  async summarizeItems(
    items: UnifiedNewsItem[],
    mode: SummarizeMode,
  ): Promise<string> {
    if (!this.providerResolver)
      throw new Error("NewsService: AI provider resolver not set");
    const providers = await this.providerResolver();
    return summarizeNews(items, mode, providers);
  }

  /**
   * Tag news items using AI classification.
   * Requires a provider resolver to be set via setProviderResolver().
   */
  async tagItems(items: UnifiedNewsItem[]): Promise<TaggedNewsItem[]> {
    if (!this.providerResolver)
      throw new Error("NewsService: AI provider resolver not set");
    const providers = await this.providerResolver();
    return tagNewsItems(items, providers);
  }
}

export const newsService = new NewsService();
