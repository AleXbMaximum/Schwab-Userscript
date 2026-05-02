/**
 * Fetch pipeline — per-symbol refresh + DB persistence.
 *
 * Extracted from MonitorController. Free functions take a `MonitorRuntime`
 * so the controller stays focused on lifecycle and listeners.
 */

import { fetchOptionChains } from "../../../backend/core/network/schwab/options";
import { logService } from "../../../shared/log/core/LogService";
import { pruneLowOIExpirations } from "shared/utils/optionsChains";
import type { OptionsChainsResponse } from "shared/types/options";
import type { ExpirySelectionContext } from "backend/computation/options/monitor/etl/ExpiryMetricsETL";

import {
  toCtDateKey,
  buildUniverseItems,
  filterResponseByUniverse,
  buildSelectionContext,
  type SymbolRefreshContext,
} from "./monitorUniverse";

import {
  buildOptionCapture,
  readOptionCaptures,
  writeOptionCaptures,
  mergeAndCompact,
  openCaptureStores,
  persistCaptureToIndexedDb,
} from "./monitorCapture";

import type { MonitorRuntime } from "./monitorRuntime";

const log = logService.namespace("compute");

/**
 * Fetch one symbol and persist its snapshot to IndexedDB.
 *
 * The monitor_openings snapshot is always written on success.
 * The full opening DB persist runs fire-and-forget in the background.
 */
export async function refreshSymbol(
  runtime: MonitorRuntime,
  symbol: string,
): Promise<OptionsChainsResponse | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) return null;
  if (!runtime.authToken) {
    log.warn("monitor.refresh.noAuth", { symbol: normalizedSymbol });
    return null;
  }

  const capturedAtUtc = new Date().toISOString();

  try {
    const refreshContext = await loadRefreshContext(
      runtime,
      normalizedSymbol,
      capturedAtUtc,
    );
    if (!refreshContext || refreshContext.response.expirations.length === 0) {
      log.warn("monitor.refresh.noExpirations", { symbol: normalizedSymbol });
      return null;
    }
    const { response, selectionContext } = refreshContext;

    runtime.responseCache.set(normalizedSymbol, {
      response,
      capturedAt: capturedAtUtc,
    });

    const opening = await buildOptionCapture(
      normalizedSymbol,
      response,
      capturedAtUtc,
      selectionContext,
    );

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

    fireAndForgetDbPersist(
      runtime,
      normalizedSymbol,
      response,
      capturedAtUtc,
      selectionContext,
    );

    runtime.broadcastSymbolUpdate({
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

/**
 * Resolve which expirations to fetch for `symbol` and produce a selection
 * context describing the universe (for downstream ETL).
 */
export async function loadRefreshContext(
  runtime: MonitorRuntime,
  symbol: string,
  capturedAtUtc: string,
): Promise<SymbolRefreshContext | null> {
  const authToken = runtime.authToken;
  if (!authToken) return null;

  const mode = runtime.settings.universeMode;
  const topN = runtime.getTopNForSymbol(symbol);
  const ctDate = toCtDateKey(new Date(capturedAtUtc));

  const loadFullAndBuildUniverse =
    async (): Promise<SymbolRefreshContext | null> => {
      const full = await fetchOptionChains(symbol, authToken);
      pruneLowOIExpirations(full);
      if (full.expirations.length === 0) return null;

      if (mode === "all") {
        runtime.universeBySymbol.delete(symbol);
        return { response: full, selectionContext: { mode: "all" } };
      }

      const items = buildUniverseItems(full, mode, topN, capturedAtUtc);
      if (items.length === 0) {
        runtime.universeBySymbol.delete(symbol);
        return { response: full, selectionContext: { mode: "all" } };
      }

      const filtered = filterResponseByUniverse(full, items);
      if (filtered.expirations.length === 0) {
        runtime.universeBySymbol.delete(symbol);
        return { response: full, selectionContext: { mode: "all" } };
      }

      runtime.universeBySymbol.set(symbol, { ctDate, mode, topN, items });
      return {
        response: filtered,
        selectionContext: buildSelectionContext(mode, items),
      };
    };

  if (mode === "all") {
    return loadFullAndBuildUniverse();
  }

  const cached = runtime.universeBySymbol.get(symbol);
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
 * Persist to IndexedDB without blocking the caller. Skips if a write for the
 * same symbol is already in progress (prevents the ConstraintError race on
 * the unique [symbol, dataTimestamp] index).
 */
export function fireAndForgetDbPersist(
  runtime: MonitorRuntime,
  symbol: string,
  response: OptionsChainsResponse,
  capturedAtUtc: string,
  selectionContext: ExpirySelectionContext,
): void {
  if (runtime.dbWriteInProgress.has(symbol)) {
    log.debug("monitor.persist.skippedBusy", { symbol });
    return;
  }

  runtime.dbWriteInProgress.add(symbol);
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
      runtime.dbWriteInProgress.delete(symbol);
    }
  })();
}
