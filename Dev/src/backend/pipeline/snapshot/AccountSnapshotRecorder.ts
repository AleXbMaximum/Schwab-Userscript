import { computeAccountOverviewMetrics } from "../../computation/holdings/metrics/accountOverviewMetrics";
import type { AccountOverviewMetrics } from "../../computation/holdings/metrics/accountOverviewMetrics";
import { applyBalancesOverlay } from "../../computation/holdings/rendering/balancesOverlay";
import { isMarketClosedCT } from "../../../shared/utils/time";
import type { BalancesSnapshot } from "../../core/network/schwab/endpoints/balances";
import type { AccountHistoryPoint } from "../../core/db/account/accountHistoryTypes";
import { toNumber, buildPoint } from "./historyPoint";
import { loadHistory } from "./historyPersistence";
import { saveHistory, DEFAULT_ARCHIVE_THRESHOLD } from "./historyPersistence";
import {
  updateLiveHistoryCache,
  normalizeRetentionDays,
  setSnapshotRetentionDays,
  DEFAULT_RETENTION_DAYS,
} from "./historyCache";
import { logService } from "../../../shared/log/core/LogService";

const balFlow = logService.namespace("flow:bal");

const DEFAULT_INTERVAL_MS = 10_000;
const STARTUP_SUPPRESS_WINDOW_MS = 10_000;
const MAX_POINTS = 300_000;
const PERSIST_INTERVAL_MS = 30_000;

type HeaderControllerLike = {
  subscribe: (cb: (data: any) => void) => () => void;
};

export class AccountSnapshotRecorder {
  private intervalMs: number;
  private skipNightSession: boolean;
  private autoArchiveEnabled: boolean;
  private archiveThreshold: number;
  private retentionDays: number;
  private history: AccountHistoryPoint[] = [];
  private latestOverview: AccountOverviewMetrics | null = null;
  private alignTimer: number | null = null;
  private intervalTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private isRunning = false;
  private persistTimer: number | null = null;
  private persistInFlight = false;
  private persistQueued = false;
  private lastPersistAt = 0;
  private suppressCaptureUntilTs = 0;
  private latestBalances: BalancesSnapshot | null = null;
  private captureListeners = new Set<() => void>();

  constructor(
    intervalMs?: number,
    skipNightSession = true,
    archiveThreshold = DEFAULT_ARCHIVE_THRESHOLD,
    autoArchiveEnabled = true,
    retentionDays = DEFAULT_RETENTION_DAYS,
  ) {
    this.intervalMs = intervalMs ?? DEFAULT_INTERVAL_MS;
    this.skipNightSession = skipNightSession;
    this.autoArchiveEnabled = autoArchiveEnabled;
    this.archiveThreshold =
      Number.isFinite(archiveThreshold) && archiveThreshold > 0
        ? Math.round(archiveThreshold)
        : DEFAULT_ARCHIVE_THRESHOLD;
    this.retentionDays = normalizeRetentionDays(retentionDays);
    setSnapshotRetentionDays(this.retentionDays);
  }

  async start(headerController: HeaderControllerLike): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.suppressCaptureUntilTs = Date.now() + STARTUP_SUPPRESS_WINDOW_MS;

    this.history = await loadHistory();
    updateLiveHistoryCache(this.history);

    this.unsubscribe = headerController.subscribe((data: any) => {
      this.handleDataUpdate(data);
    });

    this.startIntervalCapture();
  }

  stop(): void {
    this.isRunning = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.clearTimers();
    this.schedulePersist(true);
  }

  destroy(): void {
    this.stop();
  }

  applySettings(cfg: {
    intervalMs?: number;
    skipNightSession?: boolean;
    autoArchiveEnabled?: boolean;
    archiveThreshold?: number;
    retentionDays?: number;
  }): void {
    // Interval — restart timer only when value actually changes
    if (cfg.intervalMs != null && cfg.intervalMs > 0 && cfg.intervalMs !== this.intervalMs) {
      this.intervalMs = cfg.intervalMs;
      if (this.isRunning) {
        this.clearTimers();
        this.startIntervalCapture();
      }
    }
    if (cfg.skipNightSession != null && cfg.skipNightSession !== this.skipNightSession) {
      this.skipNightSession = cfg.skipNightSession;
    }
    if (cfg.autoArchiveEnabled != null && cfg.autoArchiveEnabled !== this.autoArchiveEnabled) {
      this.autoArchiveEnabled = cfg.autoArchiveEnabled;
    }
    if (cfg.archiveThreshold != null && Number.isFinite(cfg.archiveThreshold) && cfg.archiveThreshold > 0) {
      const rounded = Math.round(cfg.archiveThreshold);
      if (rounded !== this.archiveThreshold) this.archiveThreshold = rounded;
    }
    if (cfg.retentionDays != null) {
      const normalized = normalizeRetentionDays(cfg.retentionDays, this.retentionDays);
      if (normalized !== this.retentionDays) {
        this.retentionDays = normalized;
        setSnapshotRetentionDays(normalized);
      }
    }
  }

  getHistory(): readonly AccountHistoryPoint[] {
    return this.history;
  }

  onCapture(cb: () => void): void {
    this.captureListeners.add(cb);
  }

  offCapture(cb: () => void): void {
    this.captureListeners.delete(cb);
  }

  ingestBalances(snapshot: BalancesSnapshot): void {
    this.latestBalances = snapshot;
    if (this.latestOverview) {
      this.latestOverview = applyBalancesOverlay(this.latestOverview, this.latestBalances);
    }
    balFlow.debug("ingest", () => ({
      acctVal: snapshot.accountValue,
      mktVal: snapshot.marketValue,
      dayChg: snapshot.dayChangeDollar,
      dayPct: snapshot.dayChangePercent,
      cash: snapshot.cashInvestments,
      margin: snapshot.marginBalance,
      secMktVal: snapshot.securitiesMarketValue,
      optMktVal: snapshot.optionsMarketValue,
      buyPower: snapshot.dayBuyPower,
      settled: snapshot.settledFunds,
    }));
  }

  private handleDataUpdate(data: any): void {
    const holdings = data?.holdings;
    if (!holdings) return;
    const account = holdings.accounts?.[0];
    const perAccountTotals = account?.totals;
    const accountTotals = (holdings as any).accountTotals;
    if (!(accountTotals || perAccountTotals) || !account) return;

    let overview = computeAccountOverviewMetrics(
      accountTotals,
      data.derived,
      account,
      perAccountTotals,
    );
    overview = this.stabilizeBetaForSnapshot(overview, data);
    overview = applyBalancesOverlay(overview, this.latestBalances);
    this.latestOverview = overview;
  }

  private stabilizeBetaForSnapshot(
    overview: AccountOverviewMetrics,
    data: any,
  ): AccountOverviewMetrics {
    if (!Number.isFinite(overview.beta)) return overview;

    const absDelta = Math.abs(toNumber(overview.absDeltaNotionalDol));
    if (absDelta <= 0) return overview;

    const weightedShort =
      data?.derived?.portfolioAgg?.portfolioWeightedBetaShort;

    if (weightedShort == null) {
      return this.applyFallbackBeta(overview);
    }
    return overview;
  }

  private applyFallbackBeta(
    overview: AccountOverviewMetrics,
  ): AccountOverviewMetrics {
    const fallbackBeta = this.getLatestValidBeta();
    if (fallbackBeta == null) return overview;
    return { ...overview, beta: fallbackBeta };
  }

  private getLatestValidBeta(): number | null {
    if (this.latestOverview && Number.isFinite(this.latestOverview.beta)) {
      return this.latestOverview.beta;
    }
    const last =
      this.history.length > 0 ? this.history[this.history.length - 1] : null;
    if (last && Number.isFinite(last.beta)) {
      return last.beta;
    }
    return null;
  }

  private capturePoint(force = false): void {
    if (!this.latestOverview) return;
    if (!force && Date.now() < this.suppressCaptureUntilTs) return;
    const ts = Date.now();
    if (this.skipNightSession && isMarketClosedCT(ts)) return;

    this.history.push(buildPoint(this.latestOverview, ts));
    if (this.history.length > MAX_POINTS) {
      this.history = this.history.slice(-MAX_POINTS);
    }
    updateLiveHistoryCache(this.history);
    this.schedulePersist(false);
    for (const cb of this.captureListeners) {
      try { cb(); } catch (e) { balFlow.warn("captureListener threw", () => ({ error: e })); }
    }
  }

  private schedulePersist(forceNow: boolean): void {
    this.persistQueued = true;
    const elapsed = Date.now() - this.lastPersistAt;
    if (
      forceNow ||
      this.lastPersistAt === 0 ||
      elapsed >= PERSIST_INTERVAL_MS
    ) {
      this.flushPersist();
      return;
    }

    if (this.persistTimer != null) return;
    const waitMs = PERSIST_INTERVAL_MS - elapsed;
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      this.flushPersist();
    }, waitMs);
  }

  private flushPersist(): void {
    if (!this.persistQueued || this.persistInFlight) return;
    this.persistQueued = false;
    this.persistInFlight = true;
    const snapshot = this.history.slice();
    this.lastPersistAt = Date.now();
    void saveHistory(
      snapshot,
      this.archiveThreshold,
      this.autoArchiveEnabled,
    ).finally(() => {
      this.persistInFlight = false;
      if (this.persistQueued) {
        this.schedulePersist(false);
      }
    });
  }

  private startIntervalCapture(): void {
    const now = Date.now();
    const remainder = now % this.intervalMs;
    const delay =
      (remainder === 0 ? this.intervalMs : this.intervalMs - remainder) + 120;

    this.alignTimer = window.setTimeout(() => {
      const forceFirst = this.history.length === 0 && this.latestOverview != null;
      this.capturePoint(forceFirst);
      this.intervalTimer = window.setInterval(() => {
        this.capturePoint(false);
      }, this.intervalMs);
    }, delay);
  }

  private clearTimers(): void {
    if (this.alignTimer != null) {
      clearTimeout(this.alignTimer);
      this.alignTimer = null;
    }
    if (this.intervalTimer != null) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.persistTimer != null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }
}
