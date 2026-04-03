/**
 * Option capture — compact snapshot type, builders, IndexedDB helpers,
 * retention compaction, and full-capture persistence.
 */

import { logService } from "shared/log/core/LogService";
import {
  APP_TIMEZONE,
  parseSchwabEtTimestampToUtcIso,
} from "shared/utils/time";
import type{ OptionsChainsResponse } from "shared/types/options";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { MonitorCaptureStore } from "backend/core/db/capture/MonitorCaptureStore";
import {
  CaptureSnapshotStore,
  buildSnapshotRow,
} from "backend/core/db/capture/CaptureSnapshotStore";
import { CaptureStrikeStore } from "backend/core/db/capture/CaptureStrikeStore";
import { CaptureStrikeAggregateStore } from "backend/core/db/capture/CaptureStrikeAggregateStore";
import { CaptureLabelStore } from "backend/core/db/capture/CaptureLabelStore";
import { buildMetaRow } from "backend/computation/options/monitor/etl/MetaETL";
import { type ExpirySelectionContext } from "backend/computation/options/monitor/etl/ExpiryMetricsETL";
import { computeWorkerPool } from "backend/computation/workers/ComputeWorkerPool";
import { buildStrikeLegsRows } from "backend/computation/options/monitor/StrikeLegs";
import {
  backfillLabels,
  createInitialLabel,
} from "backend/computation/options/monitor/etl/LabelBackfill";
import type {
  OptionCapture,
  OptionCaptureMetaRow,
  OptionCaptureExpiryMetricsRow,
  OptionCaptureStrikeLegRow,
  OptionCaptureStrikeAggregateRow,
} from "backend/core/db/capture/optionMonitorTypes";

const log = logService.namespace("compute");

// ---------------------------------------------------------------------------
// OptionCapture — compact snapshot stored in IndexedDB
// ---------------------------------------------------------------------------

export const SYMBOL_REFRESH_TIMEOUT_MS = 90_000;
export const MAX_CAPTURES_PER_SYMBOL = 500;
export const MAX_STRIKE_GEX_CAPTURES_PER_SYMBOL = MAX_CAPTURES_PER_SYMBOL;
export const MAX_STRIKE_LEGS_CAPTURES_PER_SYMBOL = 1;

// ---------------------------------------------------------------------------
// OptionCapture builder — runs ETL synchronously from raw response
// ---------------------------------------------------------------------------

export function qualityScoreToGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.75) return "B";
  if (score >= 0.5) return "C";
  if (score >= 0.25) return "D";
  return "F";
}

export function buildOptionCaptureFromExpiryRows(
  symbol: string,
  meta: OptionCaptureMetaRow,
  expiryRows: OptionCaptureExpiryMetricsRow[],
): OptionCapture | null {
  if (expiryRows.length === 0) return null;

  // Nearest non-zero DTE expiry for single-series metrics.
  const sorted = [...expiryRows].sort((a, b) => {
    const aDte = a.dte > 0 ? a.dte : Infinity;
    const bDte = b.dte > 0 ? b.dte : Infinity;
    return aDte - bDte;
  });
  const near = sorted[0];

  // Aggregate across all expirations.
  let totalCallVolume = 0;
  let totalPutVolume = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;
  for (const r of expiryRows) {
    totalCallVolume += r.totalCallVolume;
    totalPutVolume += r.totalPutVolume;
    totalCallOI += r.totalCallOI;
    totalPutOI += r.totalPutOI;
  }

  return {
    version: 1,
    symbol,
    capturedAt: meta.capturedAtUtc,
    dataTimestamp: meta.dataTimestamp,
    underlyingPrice: meta.underlyingPrice,
    selectedExpiry: near.expiryLabel,
    dte: near.dte,
    atmIV: near.atmIV,
    rr25: near.rr25,
    impliedMovePct: near.expectedMovePct,
    netGex: near.totalNetGex,
    gammaFlip: near.gammaFlip,
    callWall: near.callWallOIStrike,
    putWall: near.putWallGexStrike,
    maxPain: near.maxPain,
    totalCallVolume,
    totalPutVolume,
    totalCallOI,
    totalPutOI,
    pcRatioVolume:
      totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null,
    pcRatioOI: totalCallOI > 0 ? totalPutOI / totalCallOI : null,
    qualityScore: near.qualityScore,
    qualityGrade: qualityScoreToGrade(near.qualityScore),
    isDelayed: meta.isDelayed,
  };
}

/**
 * Build a minimal snapshot when the full ETL fails — preserves price/volume
 * data so the ticker card never goes blank.
 */
export function buildFallbackOptionCapture(
  symbol: string,
  response: OptionsChainsResponse,
  capturedAtUtc: string,
  dataTimestampUtc: string,
): OptionCapture | null {
  if (!response.expirations.length) return null;
  const exp = response.expirations[0];

  let totalCallVolume = 0;
  let totalPutVolume = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;
  for (const e of response.expirations) {
    for (const c of e.chains) {
      totalCallVolume += c.call?.vol ?? 0;
      totalPutVolume += c.put?.vol ?? 0;
      totalCallOI += c.call?.oi ?? 0;
      totalPutOI += c.put?.oi ?? 0;
    }
  }

  return {
    version: 1,
    symbol,
    capturedAt: capturedAtUtc,
    dataTimestamp: dataTimestampUtc,
    underlyingPrice: response.underlyingPrice,
    selectedExpiry: exp.label,
    dte: exp.daysUntil,
    atmIV: null,
    rr25: null,
    impliedMovePct: null,
    netGex: null,
    gammaFlip: null,
    callWall: null,
    putWall: null,
    maxPain: null,
    totalCallVolume,
    totalPutVolume,
    totalCallOI,
    totalPutOI,
    pcRatioVolume:
      totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null,
    pcRatioOI: totalCallOI > 0 ? totalPutOI / totalCallOI : null,
    qualityScore: 0,
    qualityGrade: "F",
    isDelayed: response.isDelayed ?? false,
  };
}

/**
 * Build an OptionCapture from a live OptionsChainsResponse.
 * ETL computation is offloaded to the ComputeWorker (falls back to main thread).
 * Falls back to minimal fields on error.
 */
export async function buildOptionCapture(
  symbol: string,
  response: OptionsChainsResponse,
  capturedAtUtc: string,
  selectionContext: ExpirySelectionContext,
): Promise<OptionCapture | null> {
  if (!response.expirations.length) return null;

  const dataTimestampUtc =
    (response.currentDateTime
      ? parseSchwabEtTimestampToUtcIso(response.currentDateTime)
      : null) ?? capturedAtUtc;

  try {
    const meta = buildMetaRow(response, symbol, capturedAtUtc);
    const expiryRows = await computeWorkerPool.buildExpiryMetrics(
      response,
      meta.openingId,
      symbol,
      selectionContext,
    );
    const capture = buildOptionCaptureFromExpiryRows(symbol, meta, expiryRows);
    return (
      capture ??
      buildFallbackOptionCapture(
        symbol,
        response,
        capturedAtUtc,
        dataTimestampUtc,
      )
    );
  } catch (err) {
    log.warn("monitor.etl.error", {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackOptionCapture(
      symbol,
      response,
      capturedAtUtc,
      dataTimestampUtc,
    );
  }
}

// ---------------------------------------------------------------------------
// IndexedDB snapshot helpers (monitor_openings store)
// ---------------------------------------------------------------------------

async function getMonitorStore(): Promise<MonitorCaptureStore> {
  const db = await openAlexQuantDB();
  return new MonitorCaptureStore(db);
}

export async function readOptionCaptures(
  symbol: string,
): Promise<OptionCapture[]> {
  try {
    const store = await getMonitorStore();
    const captures = await store.getBySymbol(symbol.trim().toUpperCase());
    captures.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
    return captures;
  } catch {
    return [];
  }
}

export async function writeOptionCaptures(
  symbol: string,
  captures: OptionCapture[],
): Promise<void> {
  const store = await getMonitorStore();
  const limited =
    captures.length <= MAX_CAPTURES_PER_SYMBOL
      ? captures
      : captures.slice(0, MAX_CAPTURES_PER_SYMBOL);
  await store.replaceSymbol(symbol.trim().toUpperCase(), limited);
}

export function mergeAndCompact(
  existing: OptionCapture[],
  incoming: OptionCapture,
  now: Date,
): OptionCapture[] {
  const merged = [incoming, ...existing];
  merged.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  return compactCapturesByRetention(merged, now);
}

// ---------------------------------------------------------------------------
// Retention compaction
// ---------------------------------------------------------------------------

export function getCtYmd(
  date: Date,
): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  )
    return null;
  return { year, month, day };
}

export function isoWeekKey(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const wy = d.getUTCFullYear();
  const wn = Math.ceil(
    ((d.getTime() - new Date(Date.UTC(wy, 0, 1)).getTime()) / 86400000 + 1) / 7,
  );
  return `${wy}-W${String(wn).padStart(2, "0")}`;
}

export function hierarchyKeys(
  iso: string,
): { day: string; week: string; month: string; year: string } | null {
  const d = new Date(iso);
  const ymd = getCtYmd(d);
  if (!ymd) return null;
  const y = String(ymd.year);
  const m = `${y}-${String(ymd.month).padStart(2, "0")}`;
  const day = `${m}-${String(ymd.day).padStart(2, "0")}`;
  return {
    day,
    week: isoWeekKey(ymd.year, ymd.month, ymd.day),
    month: m,
    year: y,
  };
}

/**
 * Compaction tiers:
 *   Today:      keep ALL
 *   This week:  1 per day
 *   Past year:  1 per week
 *   Older:      1 per month (unlimited retention)
 */
export function compactCapturesByRetention(
  captures: OptionCapture[],
  now: Date = new Date(),
): OptionCapture[] {
  if (!captures.length) return [];
  const cur = hierarchyKeys(now.toISOString());
  if (!cur)
    return [...captures].sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

  const keepToday: OptionCapture[] = [];
  const byDay = new Map<string, OptionCapture>();
  const byWeek = new Map<string, OptionCapture>();
  const byMonth = new Map<string, OptionCapture>();

  const upsert = (
    m: Map<string, OptionCapture>,
    k: string,
    s: OptionCapture,
  ) => {
    const p = m.get(k);
    if (!p || p.capturedAt < s.capturedAt) m.set(k, s);
  };

  for (const snap of captures) {
    const k = hierarchyKeys(snap.capturedAt);
    if (!k) continue;
    if (k.day === cur.day) {
      keepToday.push(snap);
      continue;
    }
    if (k.week === cur.week) {
      upsert(byDay, k.day, snap);
      continue;
    }
    if (k.year === cur.year) {
      upsert(byWeek, k.week, snap);
      continue;
    }
    upsert(byMonth, k.month, snap);
  }

  const kept = [
    ...keepToday,
    ...byDay.values(),
    ...byWeek.values(),
    ...byMonth.values(),
  ];
  kept.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
  return kept;
}

// ---------------------------------------------------------------------------
// IndexedDB persistence — fire-and-forget from MonitorController's perspective
// ---------------------------------------------------------------------------

export type CaptureStores = {
  snapshotStore: CaptureSnapshotStore;
  strikeStore: CaptureStrikeStore;
  aggregateStore: CaptureStrikeAggregateStore;
  labelStore: CaptureLabelStore;
};

export async function openCaptureStores(): Promise<CaptureStores> {
  const db = await openAlexQuantDB();
  return {
    snapshotStore: new CaptureSnapshotStore(db),
    strikeStore: new CaptureStrikeStore(db),
    aggregateStore: new CaptureStrikeAggregateStore(db),
    labelStore: new CaptureLabelStore(db),
  };
}

export async function persistCaptureToIndexedDb(
  symbol: string,
  response: OptionsChainsResponse,
  capturedAtUtc: string,
  selectionContext: ExpirySelectionContext,
  stores: CaptureStores,
): Promise<"stored" | "duplicate"> {
  const meta = buildMetaRow(response, symbol, capturedAtUtc);

  // Deduplicate on the normalised UTC ISO dataTimestamp.
  const existing = await stores.snapshotStore.findByDataTimestamp(
    symbol,
    meta.dataTimestamp,
  );
  if (existing) return "duplicate";

  const expiryRows = await computeWorkerPool.buildExpiryMetrics(
    response,
    meta.openingId,
    symbol,
    selectionContext,
  );
  const snapshot = buildSnapshotRow(meta, expiryRows);
  await stores.snapshotStore.put(snapshot);

  const strikeRows = buildStrikeLegsRows(response, meta.openingId, symbol);
  await stores.strikeStore.putBatch(strikeRows);

  const aggRows = aggregateStrikeData(meta.openingId, strikeRows);
  await stores.aggregateStore.putBatch(aggRows);

  await createInitialLabel(meta, stores.labelStore);
  await backfillLabels(meta, stores.snapshotStore, stores.labelStore);

  // Strike legs are dense — keep only the latest capture.
  // Keep a wider recent window for aggregates so time heatmaps have history.
  void pruneOldRecords(
    symbol,
    stores.snapshotStore,
    stores.strikeStore,
    MAX_STRIKE_LEGS_CAPTURES_PER_SYMBOL,
  );
  void pruneOldRecords(
    symbol,
    stores.snapshotStore,
    stores.aggregateStore,
    MAX_STRIKE_GEX_CAPTURES_PER_SYMBOL,
  );

  return "stored";
}

/** Aggregate strike legs into per-strike GEX + OI totals (single pass across expirations and C/P). */
export function aggregateStrikeData(
  openingId: string,
  strikeRows: OptionCaptureStrikeLegRow[],
): OptionCaptureStrikeAggregateRow[] {
  const byStrike = new Map<
    number,
    { net: number; call: number; put: number; callOI: number; putOI: number }
  >();
  for (const row of strikeRows) {
    const prev = byStrike.get(row.strike) ?? {
      net: 0,
      call: 0,
      put: 0,
      callOI: 0,
      putOI: 0,
    };
    prev.net += row.netGex ?? 0;
    prev.call += row.callGex ?? 0;
    prev.put += row.putGex ?? 0;
    const oi = row.oi ?? 0;
    if (row.optionType === "C") prev.callOI += oi;
    else prev.putOI += oi;
    byStrike.set(row.strike, prev);
  }
  return Array.from(byStrike, ([strike, g]) => ({
    openingId,
    strike,
    netGex: g.net,
    callGex: g.call,
    putGex: g.put,
    callOI: g.callOI,
    putOI: g.putOI,
  }));
}

/** Delete child records outside the latest N captures for a given symbol. */
export async function pruneOldRecords(
  symbol: string,
  snapshotStore: CaptureSnapshotStore,
  store: { deleteByOpeningId: (id: string) => Promise<void> },
  keepLatestCaptures: number,
): Promise<void> {
  try {
    const snapshots = await snapshotStore.getBySymbol(symbol);
    const keepCount = Math.max(1, Math.trunc(keepLatestCaptures));
    if (snapshots.length <= keepCount) return;
    snapshots.sort((a, b) => b.capturedAtUtc.localeCompare(a.capturedAtUtc));
    for (let i = keepCount; i < snapshots.length; i++) {
      await store.deleteByOpeningId(snapshots[i].openingId);
    }
  } catch (err) {
    log.warn("monitor.prune.fail", {
      symbol,
      error: (err as Error)?.message ?? String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(id);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(id);
        reject(e);
      },
    );
  });
}
