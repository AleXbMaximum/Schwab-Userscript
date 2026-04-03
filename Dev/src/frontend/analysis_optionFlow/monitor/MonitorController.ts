/**
 * Monitor controller — drives periodic options-chain fetching,
 * IndexedDB snapshots, and best-effort opening persistence.
 *
 * Data flow (per symbol, per refresh):
 *   1. Network fetch  (always first)
 *   2. Build OptionCapture from raw response  (synchronous, no DB)
 *   3. Write snapshot to IndexedDB monitor_openings store
 *   4. DB persist full opening  (fire-and-forget; errors are logged only)
 *   5. Broadcast update to UI listeners
 */

import { fetchOptionChains } from "../../../backend/core/network/schwab/options";
import { logService } from "../../../shared/log/core/LogService";
import { APP_TIMEZONE, isMarketClosedCT } from "shared/utils/time";
import { pruneLowOIExpirations } from "shared/utils/optionsChains";
import type{ OptionsChainsResponse } from "shared/types/options";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import { MonitorCaptureStore } from "backend/core/db/capture/MonitorCaptureStore";
import { CaptureSnapshotStore } from "backend/core/db/capture/CaptureSnapshotStore";
import { CaptureStrikeStore } from "backend/core/db/capture/CaptureStrikeStore";
import { CaptureStrikeAggregateStore } from "backend/core/db/capture/CaptureStrikeAggregateStore";
import { CaptureLabelStore } from "backend/core/db/capture/CaptureLabelStore";
import { TimestampCaptureStore } from "backend/core/db/capture/TimestampCaptureStore";
import type { ExpirySelectionContext } from "backend/computation/options/monitor/etl/ExpiryMetricsETL";

// ── Sibling modules ──────────────────────────────────────────────────────────
import {
  DEFAULT_MONITOR_TOP_N,
  DEFAULT_MONITOR_SETTINGS,
  cloneMonitorSettings,
  loadMonitorSettings,
  saveMonitorSettings,
  normalizeTopNValue,
  normalizeTopNBySymbol,
  describeUniverseMode,
  type MonitorSettings,
  type MonitorUniverseMode,
  type MonitorSelectedExpiry,
} from "./monitorSettings";

import {
  toCtDateKey,
  buildUniverseItems,
  filterResponseByUniverse,
  buildSelectionContext,
  type SymbolUniverseCacheEntry,
  type SymbolRefreshContext,
} from "./monitorUniverse";

import {
  SYMBOL_REFRESH_TIMEOUT_MS,
  buildOptionCapture,
  readOptionCaptures,
  writeOptionCaptures,
  mergeAndCompact,
  compactCapturesByRetention,
  openCaptureStores,
  persistCaptureToIndexedDb,
  withTimeout,
} from "./monitorCapture";


const log = logService.namespace("compute");

// ---------------------------------------------------------------------------
// Public types for cross-page linkage
// ---------------------------------------------------------------------------

export type MonitorStatusCallback = (text: string, color?: string) => void;
export type MonitorSymbolUpdate = {
  symbol: string;
  capturedAt: string;
  dataTimestamp: string;
  localStored: boolean;
  /** True when a fresh (non-duplicate) snapshot was written to IndexedDB. */
  dbPersisted: boolean;
};
export type MonitorSymbolUpdateCallback = (update: MonitorSymbolUpdate) => void;

// ---------------------------------------------------------------------------
// MonitorController
// ---------------------------------------------------------------------------

export class MonitorController {
  private enabled = false;
  private running = false;
  private timer: number | null = null;
  private authToken: string | null = null;
  private settings: MonitorSettings;
  private statusListeners = new Set<MonitorStatusCallback>();
  private symbolUpdateListeners = new Set<MonitorSymbolUpdateCallback>();
  private responseCache = new Map<
    string,
    { response: OptionsChainsResponse; capturedAt: string }
  >();
  private universeBySymbol = new Map<string, SymbolUniverseCacheEntry>();

  /**
   * Symbols currently being written to IndexedDB.
   * Prevents a second concurrent DB write for the same symbol (which would
   * cause a ConstraintError on the unique [symbol, dataTimestamp] index).
   */
  private dbWriteInProgress = new Set<string>();

  constructor() {
    this.settings = cloneMonitorSettings(DEFAULT_MONITOR_SETTINGS);
  }

  /** Load persisted settings from IndexedDB. Call before start(). */
  async init(): Promise<void> {
    this.settings = cloneMonitorSettings(await loadMonitorSettings());
  }

  // ---- public API --------------------------------------------------------

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getSymbols(): readonly string[] {
    return this.settings.symbols;
  }

  getSettings(): Readonly<MonitorSettings> {
    return this.settings;
  }

  getUniverseMode(): MonitorUniverseMode {
    return this.settings.universeMode;
  }

  getDefaultTopN(): number {
    return this.settings.defaultTopN;
  }

  getTopNForSymbol(symbol: string): number {
    const sym = symbol.trim().toUpperCase();
    return this.settings.topNBySymbol[sym] ?? this.settings.defaultTopN;
  }

  getSelectedExpiries(symbol: string): MonitorSelectedExpiry[] {
    const sym = symbol.trim().toUpperCase();
    if (!sym || this.settings.universeMode === "all") return [];
    const cached = this.universeBySymbol.get(sym);
    if (!cached || cached.mode !== this.settings.universeMode) return [];
    const todayCt = toCtDateKey(new Date());
    if (cached.ctDate !== todayCt) return [];
    return cached.items.map((item) => ({
      requestDate: item.requestDate,
      isoDate: item.isoDate,
      expiryLabel: item.expiryLabel,
      dte: item.dte,
      slot: item.slot,
      rank: item.rank,
    }));
  }

  getLatestResponse(symbol: string): OptionsChainsResponse | null {
    return (
      this.responseCache.get(symbol.trim().toUpperCase())?.response ?? null
    );
  }

  getLatestCapturedAt(symbol: string): string | null {
    return (
      this.responseCache.get(symbol.trim().toUpperCase())?.capturedAt ?? null
    );
  }

  updateSettings(patch: Partial<MonitorSettings>): void {
    let shouldResetUniverse = false;
    if (patch.symbols !== undefined) {
      const nextSymbols = patch.symbols
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
      const removed = this.settings.symbols.filter(
        (s) => !nextSymbols.includes(s),
      );
      this.settings.symbols = nextSymbols;
      for (const sym of removed) {
        delete this.settings.topNBySymbol[sym];
        this.universeBySymbol.delete(sym);
      }
    }
    if (patch.intervalMinutes !== undefined) {
      this.settings.intervalMinutes = Math.max(
        1,
        Math.min(60, patch.intervalMinutes),
      );
    }
    if (patch.concurrency !== undefined) {
      this.settings.concurrency = Math.max(1, Math.min(10, patch.concurrency));
    }
    if (patch.enabled !== undefined) {
      this.settings.enabled = patch.enabled;
    }
    if (patch.universeMode !== undefined) {
      const nextMode: MonitorUniverseMode =
        patch.universeMode === "top_n" || patch.universeMode === "fixed_slots"
          ? patch.universeMode
          : "all";
      if (nextMode !== this.settings.universeMode) shouldResetUniverse = true;
      this.settings.universeMode = nextMode;
    }
    if (patch.defaultTopN !== undefined) {
      const nextDefaultTopN = normalizeTopNValue(
        patch.defaultTopN,
        this.settings.defaultTopN,
      );
      if (nextDefaultTopN !== this.settings.defaultTopN)
        shouldResetUniverse = true;
      this.settings.defaultTopN = nextDefaultTopN;
    }
    if (patch.topNBySymbol !== undefined) {
      const normalized = normalizeTopNBySymbol(patch.topNBySymbol);
      const filtered: Record<string, number> = {};
      for (const sym of this.settings.symbols) {
        if (normalized[sym] != null) filtered[sym] = normalized[sym];
      }
      this.settings.topNBySymbol = filtered;
      shouldResetUniverse = true;
    }
    // Keep a stable global default to reduce mode-side complexity in UI.
    if (this.settings.defaultTopN !== DEFAULT_MONITOR_TOP_N) {
      this.settings.defaultTopN = DEFAULT_MONITOR_TOP_N;
      shouldResetUniverse = true;
    }

    if (shouldResetUniverse) this.universeBySymbol.clear();

    saveMonitorSettings(cloneMonitorSettings(this.settings));
    if (this.enabled) this.scheduleNext();
    this.broadcast(
      `Settings updated (${this.settings.symbols.length} tickers, ${this.settings.intervalMinutes}m, ${describeUniverseMode(this.settings.universeMode)}).`,
    );
  }

  subscribe(listener: MonitorStatusCallback): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  subscribeSymbolUpdates(listener: MonitorSymbolUpdateCallback): () => void {
    this.symbolUpdateListeners.add(listener);
    return () => {
      this.symbolUpdateListeners.delete(listener);
    };
  }

  async start(runNow: boolean): Promise<void> {
    if (this.enabled) return;
    this.enabled = true;
    this.settings.enabled = true;
    saveMonitorSettings(cloneMonitorSettings(this.settings));

    if (runNow) {
      const elapsed = await this.minutesSinceLastCycle();
      if (elapsed === null || elapsed >= this.settings.intervalMinutes) {
        this.broadcast(
          `Monitor started (${this.settings.symbols.length} tickers, ${this.settings.intervalMinutes}m) — fetching now.`,
        );
        void this.runCycle("startup");
      } else {
        const remaining = Math.ceil(this.settings.intervalMinutes - elapsed);
        this.broadcast(
          `Monitor started (${this.settings.symbols.length} tickers, ${this.settings.intervalMinutes}m) — last fetch ${elapsed.toFixed(0)}m ago, next in ~${remaining}m.`,
        );
      }
    } else {
      this.broadcast(
        `Monitor started (${this.settings.symbols.length} tickers, ${this.settings.intervalMinutes}m).`,
      );
    }

    this.scheduleNext();
  }

  stop(): void {
    this.enabled = false;
    this.settings.enabled = false;
    saveMonitorSettings(cloneMonitorSettings(this.settings));
    this.clearTimer();
    this.broadcast("Monitor paused.");
  }

  async runCycle(
    reason: "startup" | "manual" | "scheduled" = "scheduled",
  ): Promise<void> {
    if (this.running) {
      this.broadcast("Monitor sync already in progress.", "#c97100");
      return;
    }
    // Skip automated cycles during market-closed hours (nights + weekends).
    // Manual cycles are always allowed.
    if (reason !== "manual" && isMarketClosedCT(Date.now())) {
      this.broadcast(
        "Monitor skipped — market closed.",
        "var(--ios-text-secondary)",
      );
      this.scheduleNext();
      return;
    }
    this.running = true;
    try {
      if (!this.authToken) {
        this.broadcast("Monitor waiting for auth token.", "#c97100");
        return;
      }

      const symbols = Array.from(
        new Set(
          this.settings.symbols
            .map((s) => s.trim().toUpperCase())
            .filter((s) => s.length > 0),
        ),
      );
      if (symbols.length === 0) {
        this.broadcast("Monitor has no tickers configured.", "#c97100");
        return;
      }

      const startedAt = new Date();
      this.broadcast(`Monitor syncing (${reason})...`);

      let updated = 0;
      let failed = 0;
      let keptTotal = 0;

      const processSymbol = async (symbol: string): Promise<void> => {
        try {
          const response = await withTimeout(
            this.refreshSymbol(symbol),
            SYMBOL_REFRESH_TIMEOUT_MS,
            `refreshSymbol(${symbol})`,
          );
          if (response) {
            updated += 1;
            keptTotal += (await readOptionCaptures(symbol)).length;
          } else {
            failed += 1;
          }
        } catch (error) {
          log.warn("monitor.cycle.error", {
            symbol,
            error: (error as Error)?.message ?? String(error),
          });
          failed += 1;
        }
      };

      const concurrency = this.settings.concurrency;
      for (let i = 0; i < symbols.length; i += concurrency) {
        await Promise.all(symbols.slice(i, i + concurrency).map(processSymbol));
      }

      await this.saveLastCycleTimestamp();

      const hhmm = startedAt.toLocaleTimeString("en-US", {
        timeZone: APP_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
      const color = failed > 0 ? "#c97100" : "var(--ios-text-secondary)";
      this.broadcast(
        `Monitor ${hhmm}: ${updated}/${symbols.length} updated, ${failed} failed, kept ${keptTotal} (${elapsed}s).`,
        color,
      );
    } catch (error) {
      log.error("monitor.cycle.fail", {
        reason,
        error: (error as Error)?.message ?? String(error),
      });
      this.broadcast(`Monitor sync failed (${reason}).`, "#c97100");
    } finally {
      this.running = false;
    }
  }

  /**
   * Fetch one symbol and persist its snapshot to IndexedDB.
   *
   * The monitor_openings snapshot is always written on success.
   * The full opening DB persist runs fire-and-forget in the background.
   */
  async refreshSymbol(symbol: string): Promise<OptionsChainsResponse | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) return null;
    if (!this.authToken) {
      log.warn("monitor.refresh.noAuth", { symbol: normalizedSymbol });
      return null;
    }

    const capturedAtUtc = new Date().toISOString();

    try {
      // ── 1. Network fetch + selection scope ────────────────────────────
      const refreshContext = await this.loadRefreshContext(
        normalizedSymbol,
        capturedAtUtc,
      );
      if (!refreshContext || refreshContext.response.expirations.length === 0) {
        log.warn("monitor.refresh.noExpirations", { symbol: normalizedSymbol });
        return null;
      }
      const { response, selectionContext } = refreshContext;

      this.responseCache.set(normalizedSymbol, {
        response,
        capturedAt: capturedAtUtc,
      });

      // ── 2. Build OptionCapture (async ETL via ComputeWorker) ─────────
      const opening = await buildOptionCapture(
        normalizedSymbol,
        response,
        capturedAtUtc,
        selectionContext,
      );

      // ── 3. Write snapshot to IndexedDB monitor_openings store ─────────
      let stored = false;
      if (opening) {
        try {
          const now = new Date();
          const existing = await readOptionCaptures(normalizedSymbol);
          const compacted = mergeAndCompact(existing, opening, now);
          await writeOptionCaptures(normalizedSymbol, compacted);
          stored = true;
        } catch (storageErr) {
          log.warn("monitor.refresh.storageError", {
            symbol: normalizedSymbol,
            error: (storageErr as Error)?.message ?? String(storageErr),
          });
        }
      }

      // ── 4. DB persist full opening — fire-and-forget ──────────────────
      this.fireAndForgetDbPersist(
        normalizedSymbol,
        response,
        capturedAtUtc,
        selectionContext,
      );

      // ── 5. Broadcast for UI refresh ───────────────────────────────────
      this.broadcastSymbolUpdate({
        symbol: normalizedSymbol,
        capturedAt: capturedAtUtc,
        dataTimestamp: response.currentDateTime || capturedAtUtc,
        localStored: stored,
        dbPersisted: stored,
      });

      return response;
    } catch (error) {
      log.warn("monitor.refresh.fail", {
        symbol: normalizedSymbol,
        error: (error as Error)?.message ?? String(error),
      });
      return null;
    }
  }

  async cleanData(): Promise<{
    before: number;
    after: number;
    touchedSymbols: number;
  }> {
    let before = 0;
    let after = 0;
    let touchedSymbols = 0;
    const now = new Date();
    for (const symbol of this.settings.symbols) {
      const existing = await readOptionCaptures(symbol);
      if (existing.length === 0) continue;
      before += existing.length;
      const compacted = compactCapturesByRetention(existing, now);
      after += compacted.length;
      if (compacted.length !== existing.length) touchedSymbols += 1;
      await writeOptionCaptures(symbol, compacted);
    }
    return { before, after, touchedSymbols };
  }

  async purgeAllData(): Promise<{ purgedSymbols: number }> {
    const symbols = [...this.settings.symbols];
    for (const symbol of symbols) {
      await this.purgeSymbol(symbol);
    }
    log.info("monitor.purge.all", { purgedSymbols: symbols.length });
    return { purgedSymbols: symbols.length };
  }

  async purgeSymbol(symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    const db = await openAlexQuantDB();

    // 1. Get all openingIds for this symbol from snapshot store
    const snapshotStore = new CaptureSnapshotStore(db);
    const snapshots = await snapshotStore.getBySymbol(sym);
    const openingIds = snapshots.map((s) => s.openingId);

    // 2. Delete child records by openingId
    const strikeStore = new CaptureStrikeStore(db);
    const aggregateStore = new CaptureStrikeAggregateStore(db);
    const labelStore = new CaptureLabelStore(db);

    await Promise.all(
      openingIds.map(async (id) => {
        await strikeStore.deleteByOpeningId(id);
        await aggregateStore.deleteByOpeningId(id);
        await labelStore.deleteByOpeningId(id);
        await snapshotStore.delete(id);
      }),
    );

    // 3. Delete monitor & timestamp snapshots
    const monitorStore = new MonitorCaptureStore(db);
    await monitorStore.deleteBySymbol(sym);

    const tsStore = new TimestampCaptureStore(db);
    await tsStore.deleteBySymbol(sym);

    // 4. Clear local cache
    this.responseCache.delete(sym);
    this.universeBySymbol.delete(sym);

    log.info("monitor.purge.symbol", { symbol: sym, openingsPurged: openingIds.length });
  }

  destroy(): void {
    this.enabled = false;
    this.clearTimer();
    this.statusListeners.clear();
    this.responseCache.clear();
    this.universeBySymbol.clear();
    this.dbWriteInProgress.clear();
  }

  // ---- private -----------------------------------------------------------

  private async loadRefreshContext(
    symbol: string,
    capturedAtUtc: string,
  ): Promise<SymbolRefreshContext | null> {
    const authToken = this.authToken;
    if (!authToken) return null;

    const mode = this.settings.universeMode;
    const topN = this.getTopNForSymbol(symbol);
    const ctDate = toCtDateKey(new Date(capturedAtUtc));

    const loadFullAndBuildUniverse =
      async (): Promise<SymbolRefreshContext | null> => {
        const full = await fetchOptionChains(symbol, authToken);
        pruneLowOIExpirations(full);
        if (full.expirations.length === 0) return null;

        if (mode === "all") {
          this.universeBySymbol.delete(symbol);
          return { response: full, selectionContext: { mode: "all" } };
        }

        const items = buildUniverseItems(full, mode, topN, capturedAtUtc);
        if (items.length === 0) {
          this.universeBySymbol.delete(symbol);
          return { response: full, selectionContext: { mode: "all" } };
        }

        const filtered = filterResponseByUniverse(full, items);
        if (filtered.expirations.length === 0) {
          this.universeBySymbol.delete(symbol);
          return { response: full, selectionContext: { mode: "all" } };
        }

        this.universeBySymbol.set(symbol, { ctDate, mode, topN, items });
        return {
          response: filtered,
          selectionContext: buildSelectionContext(mode, items),
        };
      };

    if (mode === "all") {
      return loadFullAndBuildUniverse();
    }

    const cached = this.universeBySymbol.get(symbol);
    const shouldRebuild =
      !cached ||
      cached.ctDate !== ctDate ||
      cached.mode !== mode ||
      cached.topN !== topN ||
      cached.items.length === 0;

    if (shouldRebuild) {
      return loadFullAndBuildUniverse();
    }

    try {
      const targeted = await fetchOptionChains(symbol, authToken, {
        expirationDates: cached.items.map((item) => item.requestDate),
      });
      if (targeted.expirations.length === 0) {
        return loadFullAndBuildUniverse();
      }
      const filtered = filterResponseByUniverse(targeted, cached.items);
      if (filtered.expirations.length === 0) {
        return loadFullAndBuildUniverse();
      }
      return {
        response: filtered,
        selectionContext: buildSelectionContext(mode, cached.items),
      };
    } catch (err) {
      log.warn("monitor.fetch.fallbackFull", {
        symbol,
        mode,
        error: (err as Error)?.message ?? String(err),
      });
      return loadFullAndBuildUniverse();
    }
  }

  /**
   * Persist to IndexedDB without blocking the caller.
   * Skips if a write for the same symbol is already in progress (prevents the
   * ConstraintError race on the unique [symbol, dataTimestamp] index).
   */
  private fireAndForgetDbPersist(
    symbol: string,
    response: OptionsChainsResponse,
    capturedAtUtc: string,
    selectionContext: ExpirySelectionContext,
  ): void {
    if (this.dbWriteInProgress.has(symbol)) {
      log.debug("monitor.persist.skippedBusy", { symbol });
      return;
    }

    this.dbWriteInProgress.add(symbol);
    void (async () => {
      try {
        const stores = await openCaptureStores();
        const status = await persistCaptureToIndexedDb(
          symbol,
          response,
          capturedAtUtc,
          selectionContext,
          stores,
        );
        log.debug("monitor.persist.done", { symbol, status });
      } catch (error) {
        log.warn("monitor.persist.fail", {
          symbol,
          error: (error as Error)?.message ?? String(error),
        });
      } finally {
        this.dbWriteInProgress.delete(symbol);
      }
    })();
  }

  private async minutesSinceLastCycle(): Promise<number | null> {
    try {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      const ts = await kv.get("monitor.lastCycleAt");
      if (typeof ts !== "number" || ts <= 0) return null;
      return (Date.now() - ts) / 60_000;
    } catch {
      return null;
    }
  }

  private async saveLastCycleTimestamp(): Promise<void> {
    try {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      await kv.set("monitor.lastCycleAt", Date.now());
    } catch {}
  }

  private broadcast(text: string, color?: string): void {
    for (const listener of this.statusListeners) {
      try {
        listener(text, color);
      } catch {
        /* ignore */
      }
    }
  }

  private broadcastSymbolUpdate(update: MonitorSymbolUpdate): void {
    for (const listener of this.symbolUpdateListeners) {
      try {
        listener(update);
      } catch {
        /* ignore */
      }
    }
  }

  private clearTimer(): void {
    if (this.timer != null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    this.clearTimer();
    if (!this.enabled) return;

    const intervalMs = this.settings.intervalMinutes * 60 * 1000;
    const now = Date.now();
    const remainder = now % intervalMs;
    const delay = (remainder === 0 ? intervalMs : intervalMs - remainder) + 250;

    this.timer = window.setTimeout(async () => {
      this.timer = null;
      if (!this.enabled) return;
      await this.runCycle("scheduled");
      this.scheduleNext();
    }, delay);
  }
}
