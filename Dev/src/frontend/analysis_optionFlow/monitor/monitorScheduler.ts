/**
 * Scheduler / cycle helpers — extracted from MonitorController.
 *
 * `runMonitorCycle` walks the configured symbol universe, throttling by
 * concurrency, and orchestrates per-symbol refreshes via the runtime.
 *
 * `getMinutesSinceLastCycle` / `saveMonitorLastCycleTimestamp` are
 * standalone IndexedDB helpers consumed by the scheduler.
 *
 * `createCycleScheduler` produces a tick handle aligned to interval-minute
 * boundaries (with a 250 ms grace period).
 */

import { logService } from "../../../shared/log/core/LogService";
import { APP_TIMEZONE, isMarketClosedCT } from "shared/utils/time";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";

import {
  SYMBOL_REFRESH_TIMEOUT_MS,
  readOptionCaptures,
  withTimeout,
} from "./monitorCapture";

import type { MonitorRuntime } from "./monitorRuntime";

const log = logService.namespace("compute");

export type MonitorCycleReason = "startup" | "manual" | "scheduled";

/**
 * Run a single monitor cycle: fetch every configured symbol (concurrency-
 * limited), tally results, save the last-cycle timestamp, and broadcast
 * status. No-op if a cycle is already running or if the market is closed
 * (manual cycles bypass the closed-market gate).
 */
export async function runMonitorCycle(
  runtime: MonitorRuntime,
  reason: MonitorCycleReason = "scheduled",
): Promise<void> {
  if (runtime.isRunning()) {
    runtime.broadcast("Monitor sync already in progress.", "#c97100");
    return;
  }
  // Skip automated cycles during market-closed hours (nights + weekends).
  // Manual cycles are always allowed.
  if (reason !== "manual" && isMarketClosedCT(Date.now())) {
    runtime.broadcast(
      "Monitor skipped — market closed.",
      "var(--ios-text-secondary)",
    );
    runtime.scheduleNext();
    return;
  }
  runtime.setRunning(true);
  try {
    if (!runtime.authToken) {
      runtime.broadcast("Monitor waiting for auth token.", "#c97100");
      return;
    }

    const symbols = Array.from(
      new Set(
        runtime.settings.symbols
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0),
      ),
    );
    if (symbols.length === 0) {
      runtime.broadcast("Monitor has no tickers configured.", "#c97100");
      return;
    }

    const startedAt = new Date();
    runtime.broadcast(`Monitor syncing (${reason})...`);

    let updated = 0;
    let failed = 0;
    let keptTotal = 0;

    const processSymbol = async (symbol: string): Promise<void> => {
      try {
        const response = await withTimeout(
          runtime.refreshSymbol(symbol),
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

    const concurrency = runtime.settings.concurrency;
    for (let i = 0; i < symbols.length; i += concurrency) {
      await Promise.all(symbols.slice(i, i + concurrency).map(processSymbol));
    }

    await saveMonitorLastCycleTimestamp();

    const hhmm = startedAt.toLocaleTimeString("en-US", {
      timeZone: APP_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
    const color = failed > 0 ? "#c97100" : "var(--ios-text-secondary)";
    runtime.broadcast(
      `Monitor ${hhmm}: ${updated}/${symbols.length} updated, ${failed} failed, kept ${keptTotal} (${elapsed}s).`,
      color,
    );
  } catch (error) {
    log.error("monitor.cycle.fail", {
      reason,
      error: (error as Error)?.message ?? String(error),
    });
    runtime.broadcast(`Monitor sync failed (${reason}).`, "#c97100");
  } finally {
    runtime.setRunning(false);
  }
}

/** Minutes since the last persisted cycle timestamp. Returns null if absent. */
export async function getMinutesSinceLastCycle(): Promise<number | null> {
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

/** Persist the current wall-clock as the monitor's last-cycle timestamp. */
export async function saveMonitorLastCycleTimestamp(): Promise<void> {
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    await kv.set("monitor.lastCycleAt", Date.now());
  } catch {
    // best-effort — failing to save is non-fatal.
  }
}

export type CycleScheduler = {
  /** Schedule the next tick; replaces any pending tick. */
  schedule(): void;
  /** Cancel the pending tick (if any). */
  clear(): void;
};

/**
 * Build a cycle scheduler that fires aligned to interval-minute boundaries
 * (plus a 250 ms grace period). The tick callback runs the cycle and the
 * scheduler self-rearms while the runtime remains enabled.
 */
export function createCycleScheduler(opts: {
  isEnabled(): boolean;
  getIntervalMinutes(): number;
  onTick: () => Promise<void> | void;
}): CycleScheduler {
  let timer: number | null = null;

  const clear = (): void => {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (): void => {
    clear();
    if (!opts.isEnabled()) return;

    const intervalMs = opts.getIntervalMinutes() * 60 * 1000;
    const now = Date.now();
    const remainder = now % intervalMs;
    const delay = (remainder === 0 ? intervalMs : intervalMs - remainder) + 250;

    timer = window.setTimeout(async () => {
      timer = null;
      if (!opts.isEnabled()) return;
      await opts.onTick();
      schedule();
    }, delay);
  };

  return { schedule, clear };
}
