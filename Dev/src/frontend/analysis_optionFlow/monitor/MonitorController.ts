/**
 * Monitor controller — thin coordinator around the scheduler + fetch pipeline.
 *
 * Cycle / timing logic lives in `monitorScheduler.ts`.
 * Fetch + persist logic lives in `monitorFetchPipeline.ts`.
 * This class owns lifecycle, settings, listeners, and the IndexedDB
 * caches (response, universe, dbWriteInProgress).
 *
 * Data flow (per symbol, per refresh):
 *   1. Network fetch
 *   2. Build OptionCapture from raw response
 *   3. Write snapshot to IndexedDB monitor_openings store
 *   4. DB persist full opening (fire-and-forget)
 *   5. Broadcast update to UI listeners
 */

import { logService } from "../../../shared/log/core/LogService";
import type { OptionsChainsResponse } from "shared/types/options";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { MonitorCaptureStore } from "backend/core/db/capture/MonitorCaptureStore";
import { CaptureSnapshotStore } from "backend/core/db/capture/CaptureSnapshotStore";
import { CaptureStrikeStore } from "backend/core/db/capture/CaptureStrikeStore";
import { CaptureStrikeAggregateStore } from "backend/core/db/capture/CaptureStrikeAggregateStore";
import { CaptureLabelStore } from "backend/core/db/capture/CaptureLabelStore";
import { TimestampCaptureStore } from "backend/core/db/capture/TimestampCaptureStore";

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
  type SymbolUniverseCacheEntry,
} from "./monitorUniverse";

import {
  readOptionCaptures,
  writeOptionCaptures,
  compactCapturesByRetention,
} from "./monitorCapture";

import type {
  MonitorRuntime,
  MonitorResponseCacheEntry,
  MonitorSymbolUpdate,
} from "./monitorRuntime";
import {
  createCycleScheduler,
  getMinutesSinceLastCycle,
  runMonitorCycle,
  type CycleScheduler,
  type MonitorCycleReason,
} from "./monitorScheduler";
import { refreshSymbol as refreshSymbolImpl } from "./monitorFetchPipeline";

const log = logService.namespace("compute");

export type MonitorStatusCallback = (text: string, color?: string) => void;
export type MonitorSymbolUpdateCallback = (update: MonitorSymbolUpdate) => void;
export type { MonitorSymbolUpdate } from "./monitorRuntime";

export class MonitorController implements MonitorRuntime {
  private enabled = false;
  private running = false;
  private _authToken: string | null = null;
  private _settings: MonitorSettings;
  private statusListeners = new Set<MonitorStatusCallback>();
  private symbolUpdateListeners = new Set<MonitorSymbolUpdateCallback>();
  private scheduler: CycleScheduler;

  readonly responseCache = new Map<string, MonitorResponseCacheEntry>();
  readonly universeBySymbol = new Map<string, SymbolUniverseCacheEntry>();
  /** Symbols currently being written to IndexedDB. */
  readonly dbWriteInProgress = new Set<string>();

  constructor() {
    this._settings = cloneMonitorSettings(DEFAULT_MONITOR_SETTINGS);
    this.scheduler = createCycleScheduler({
      isEnabled: () => this.enabled,
      getIntervalMinutes: () => this._settings.intervalMinutes,
      onTick: () => this.runCycle("scheduled"),
    });
  }

  // ── MonitorRuntime surface ───────────────────────────────────────────────

  get authToken(): string | null {
    return this._authToken;
  }

  get settings(): Readonly<MonitorSettings> {
    return this._settings;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isRunning(): boolean {
    return this.running;
  }

  setRunning(value: boolean): void {
    this.running = value;
  }

  scheduleNext(): void {
    this.scheduler.schedule();
  }

  broadcast(text: string, color?: string): void {
    for (const listener of this.statusListeners) {
      try {
        listener(text, color);
      } catch {
        /* ignore */
      }
    }
  }

  broadcastSymbolUpdate(update: MonitorSymbolUpdate): void {
    for (const listener of this.symbolUpdateListeners) {
      try {
        listener(update);
      } catch {
        /* ignore */
      }
    }
  }

  // ── Init + lifecycle ─────────────────────────────────────────────────────

  /** Load persisted settings from IndexedDB. Call before start(). */
  async init(): Promise<void> {
    this._settings = cloneMonitorSettings(await loadMonitorSettings());
  }

  setAuthToken(token: string | null): void {
    this._authToken = token;
  }

  // ── Settings + universe getters (used by UI panels) ──────────────────────

  getSymbols(): readonly string[] {
    return this._settings.symbols;
  }

  getSettings(): Readonly<MonitorSettings> {
    return this._settings;
  }

  getUniverseMode(): MonitorUniverseMode {
    return this._settings.universeMode;
  }

  getDefaultTopN(): number {
    return this._settings.defaultTopN;
  }

  getTopNForSymbol(symbol: string): number {
    const sym = symbol.trim().toUpperCase();
    return this._settings.topNBySymbol[sym] ?? this._settings.defaultTopN;
  }

  getSelectedExpiries(symbol: string): MonitorSelectedExpiry[] {
    const sym = symbol.trim().toUpperCase();
    if (!sym || this._settings.universeMode === "all") return [];
    const cached = this.universeBySymbol.get(sym);
    if (!cached || cached.mode !== this._settings.universeMode) return [];
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
      const removed = this._settings.symbols.filter(
        (s) => !nextSymbols.includes(s),
      );
      this._settings.symbols = nextSymbols;
      for (const sym of removed) {
        delete this._settings.topNBySymbol[sym];
        this.universeBySymbol.delete(sym);
      }
    }
    if (patch.intervalMinutes !== undefined) {
      this._settings.intervalMinutes = Math.max(
        1,
        Math.min(60, patch.intervalMinutes),
      );
    }
    if (patch.concurrency !== undefined) {
      this._settings.concurrency = Math.max(
        1,
        Math.min(10, patch.concurrency),
      );
    }
    if (patch.enabled !== undefined) {
      this._settings.enabled = patch.enabled;
    }
    if (patch.universeMode !== undefined) {
      const nextMode: MonitorUniverseMode =
        patch.universeMode === "top_n" || patch.universeMode === "fixed_slots"
          ? patch.universeMode
          : "all";
      if (nextMode !== this._settings.universeMode) shouldResetUniverse = true;
      this._settings.universeMode = nextMode;
    }
    if (patch.defaultTopN !== undefined) {
      const nextDefaultTopN = normalizeTopNValue(
        patch.defaultTopN,
        this._settings.defaultTopN,
      );
      if (nextDefaultTopN !== this._settings.defaultTopN)
        shouldResetUniverse = true;
      this._settings.defaultTopN = nextDefaultTopN;
    }
    if (patch.topNBySymbol !== undefined) {
      const normalized = normalizeTopNBySymbol(patch.topNBySymbol);
      const filtered: Record<string, number> = {};
      for (const sym of this._settings.symbols) {
        if (normalized[sym] != null) filtered[sym] = normalized[sym];
      }
      this._settings.topNBySymbol = filtered;
      shouldResetUniverse = true;
    }
    // Keep a stable global default to reduce mode-side complexity in UI.
    if (this._settings.defaultTopN !== DEFAULT_MONITOR_TOP_N) {
      this._settings.defaultTopN = DEFAULT_MONITOR_TOP_N;
      shouldResetUniverse = true;
    }

    if (shouldResetUniverse) this.universeBySymbol.clear();

    saveMonitorSettings(cloneMonitorSettings(this._settings));
    if (this.enabled) this.scheduler.schedule();
    this.broadcast(
      `Settings updated (${this._settings.symbols.length} tickers, ${this._settings.intervalMinutes}m, ${describeUniverseMode(this._settings.universeMode)}).`,
    );
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

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

  // ── Cycle entry points ────────────────────────────────────────────────────

  async start(runNow: boolean): Promise<void> {
    if (this.enabled) return;
    this.enabled = true;
    this._settings.enabled = true;
    saveMonitorSettings(cloneMonitorSettings(this._settings));

    if (runNow) {
      const elapsed = await getMinutesSinceLastCycle();
      if (elapsed === null || elapsed >= this._settings.intervalMinutes) {
        this.broadcast(
          `Monitor started (${this._settings.symbols.length} tickers, ${this._settings.intervalMinutes}m) — fetching now.`,
        );
        void this.runCycle("startup");
      } else {
        const remaining = Math.ceil(this._settings.intervalMinutes - elapsed);
        this.broadcast(
          `Monitor started (${this._settings.symbols.length} tickers, ${this._settings.intervalMinutes}m) — last fetch ${elapsed.toFixed(0)}m ago, next in ~${remaining}m.`,
        );
      }
    } else {
      this.broadcast(
        `Monitor started (${this._settings.symbols.length} tickers, ${this._settings.intervalMinutes}m).`,
      );
    }

    this.scheduler.schedule();
  }

  stop(): void {
    this.enabled = false;
    this._settings.enabled = false;
    saveMonitorSettings(cloneMonitorSettings(this._settings));
    this.scheduler.clear();
    this.broadcast("Monitor paused.");
  }

  async runCycle(reason: MonitorCycleReason = "scheduled"): Promise<void> {
    return runMonitorCycle(this, reason);
  }

  async refreshSymbol(
    symbol: string,
  ): Promise<OptionsChainsResponse | null> {
    return refreshSymbolImpl(this, symbol);
  }

  // ── Maintenance / purge ───────────────────────────────────────────────────

  async cleanData(): Promise<{
    before: number;
    after: number;
    touchedSymbols: number;
  }> {
    let before = 0;
    let after = 0;
    let touchedSymbols = 0;
    const now = new Date();
    for (const symbol of this._settings.symbols) {
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
    const symbols = [...this._settings.symbols];
    for (const symbol of symbols) {
      await this.purgeSymbol(symbol);
    }
    log.info("monitor.purge.all", { purgedSymbols: symbols.length });
    return { purgedSymbols: symbols.length };
  }

  async purgeSymbol(symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    const db = await openAlexQuantDB();

    const snapshotStore = new CaptureSnapshotStore(db);
    const snapshots = await snapshotStore.getBySymbol(sym);
    const openingIds = snapshots.map((s) => s.openingId);

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

    const monitorStore = new MonitorCaptureStore(db);
    await monitorStore.deleteBySymbol(sym);

    const tsStore = new TimestampCaptureStore(db);
    await tsStore.deleteBySymbol(sym);

    this.responseCache.delete(sym);
    this.universeBySymbol.delete(sym);

    log.info("monitor.purge.symbol", {
      symbol: sym,
      openingsPurged: openingIds.length,
    });
  }

  destroy(): void {
    this.enabled = false;
    this.scheduler.clear();
    this.statusListeners.clear();
    this.symbolUpdateListeners.clear();
    this.responseCache.clear();
    this.universeBySymbol.clear();
    this.dbWriteInProgress.clear();
  }
}
