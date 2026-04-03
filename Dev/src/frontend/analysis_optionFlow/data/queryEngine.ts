import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import {
  CaptureSnapshotStore,
  snapshotToMetaRow,
  snapshotToExpiryRows,
} from "backend/core/db/capture/CaptureSnapshotStore";
import { CaptureStrikeAggregateStore } from "backend/core/db/capture/CaptureStrikeAggregateStore";
import type {
  OptionCaptureMetaRow,
  OptionCaptureExpiryMetricsRow,
  OptionCaptureSnapshotRow,
} from "backend/core/db/capture/optionMonitorTypes";
import type { GexHeatmapData, OIHeatmapData } from "../types";
import { CAPTURE_WINDOW_MIN, CAPTURE_WINDOW_MAX } from "../types";
import {
  formatDateCT,
  normalizeMarketTimeCT,
  parseMarketTimeCTToMinutes,
} from "shared/utils/time";

function isInTimeWindow(
  marketTimeCT: string,
  startMin: number,
  endMin: number,
): boolean {
  const totalMin = parseMarketTimeCTToMinutes(marketTimeCT);
  if (totalMin == null) return false;
  return totalMin >= startMin && totalMin <= endMin;
}

/** Extract the CT date (YYYY-MM-DD) from a UTC ISO timestamp. */
function ctDatePrefix(capturedAtUtc: string): string {
  return formatDateCT(capturedAtUtc) ?? capturedAtUtc.substring(0, 10);
}

/** Short date label for multi-day display: "M/DD" */
function shortDateLabel(capturedAtUtc: string): string {
  const dateStr = ctDatePrefix(capturedAtUtc);
  const month = parseInt(dateStr.substring(5, 7), 10);
  const day = dateStr.substring(8, 10);
  return `${month}/${day}`;
}

/** Shared filtering logic: date range → normalize → time window → sort → multi-day label. */
function filterAndSortSnapshots(
  all: OptionCaptureSnapshotRow[],
  dateStart: string,
  dateEnd: string,
  timeStartMin: number,
  timeEndMin: number,
): OptionCaptureSnapshotRow[] {
  const isMultiDay = dateStart !== dateEnd;
  return all
    .filter((s) => {
      const d = ctDatePrefix(s.capturedAtUtc);
      return d >= dateStart && d <= dateEnd;
    })
    .map((s) => ({ ...s, marketTimeCt: normalizeMarketTimeCT(s.marketTimeCt) }))
    .filter((s) => isInTimeWindow(s.marketTimeCt, timeStartMin, timeEndMin))
    .sort((a, b) => a.capturedAtUtc.localeCompare(b.capturedAtUtc))
    .map((s) =>
      isMultiDay
        ? {
            ...s,
            marketTimeCt: `${shortDateLabel(s.capturedAtUtc)} ${s.marketTimeCt}`,
          }
        : s,
    );
}

export interface DayLoadResult {
  metaRows: OptionCaptureMetaRow[];
  expiryRows: OptionCaptureExpiryMetricsRow[];
}

/**
 * Fast path: load meta + expiry from a single store read (no join).
 * Use loadGexMatrix() / loadOIMatrix() separately for the heavy heatmap data.
 */
export async function loadAll(
  symbol: string,
  dateStart: string,
  dateEnd: string,
  timeStartMin: number = CAPTURE_WINDOW_MIN,
  timeEndMin: number = CAPTURE_WINDOW_MAX,
): Promise<DayLoadResult> {
  const db = await openAlexQuantDB();
  const store = new CaptureSnapshotStore(db);
  const all = await store.getBySymbol(symbol);
  const filtered = filterAndSortSnapshots(
    all,
    dateStart,
    dateEnd,
    timeStartMin,
    timeEndMin,
  );

  // Extract backward-compatible meta + expiry arrays from snapshot rows
  const metaRows = filtered.map(snapshotToMetaRow);
  const expiryRows = filtered.flatMap(snapshotToExpiryRows);
  return { metaRows, expiryRows };
}

/** Deferred heavy load: fetch pre-aggregated strike data and build GEX matrix. */
export async function loadGexMatrix(
  symbol: string,
  dateStart: string,
  dateEnd: string,
  timeStartMin: number = CAPTURE_WINDOW_MIN,
  timeEndMin: number = CAPTURE_WINDOW_MAX,
): Promise<GexHeatmapData> {
  const db = await openAlexQuantDB();
  const snapshotStore = new CaptureSnapshotStore(db);
  const aggStore = new CaptureStrikeAggregateStore(db);

  const all = await snapshotStore.getBySymbol(symbol);
  const filtered = filterAndSortSnapshots(
    all,
    dateStart,
    dateEnd,
    timeStartMin,
    timeEndMin,
  );

  // Deduplicate by marketTimeCt — keep the latest capture per time label.
  const deduped = dedupByTime(filtered);

  const aggMap = await aggStore.getByOpeningIds(
    deduped.map((s) => s.openingId),
  );

  const allStrikes = new Set<number>();
  const timeToStrikes = new Map<
    string,
    Map<number, { net: number; call: number; put: number }>
  >();

  for (const snap of deduped) {
    const rows = aggMap.get(snap.openingId) ?? [];
    const byStrike = new Map<
      number,
      { net: number; call: number; put: number }
    >();
    for (const row of rows) {
      byStrike.set(row.strike, {
        net: row.netGex,
        call: row.callGex,
        put: row.putGex,
      });
      allStrikes.add(row.strike);
    }
    timeToStrikes.set(snap.marketTimeCt, byStrike);
  }

  const times = deduped.map((s) => s.marketTimeCt);
  const spots = deduped.map((s) => s.underlyingPrice ?? 0);
  const strikes = Array.from(allStrikes).sort((a, b) => a - b);

  const netMatrix: number[][] = [];
  const callMatrix: number[][] = [];
  const putMatrix: number[][] = [];

  for (const time of times) {
    const strikeMap = timeToStrikes.get(time) ?? new Map();
    const netRow: number[] = [];
    const callRow: number[] = [];
    const putRow: number[] = [];
    for (const strike of strikes) {
      const accum = strikeMap.get(strike);
      netRow.push(accum?.net ?? 0);
      callRow.push(accum?.call ?? 0);
      putRow.push(accum?.put ?? 0);
    }
    netMatrix.push(netRow);
    callMatrix.push(callRow);
    putMatrix.push(putRow);
  }

  return { times, strikes, spots, netMatrix, callMatrix, putMatrix };
}

/** Deferred heavy load: fetch per-strike OI from aggregates and build OI matrix. */
export async function loadOIMatrix(
  symbol: string,
  dateStart: string,
  dateEnd: string,
  timeStartMin: number = CAPTURE_WINDOW_MIN,
  timeEndMin: number = CAPTURE_WINDOW_MAX,
): Promise<OIHeatmapData> {
  const db = await openAlexQuantDB();
  const snapshotStore = new CaptureSnapshotStore(db);
  const aggStore = new CaptureStrikeAggregateStore(db);

  const all = await snapshotStore.getBySymbol(symbol);
  const filtered = filterAndSortSnapshots(
    all,
    dateStart,
    dateEnd,
    timeStartMin,
    timeEndMin,
  );

  const deduped = dedupByTime(filtered);

  const aggMap = await aggStore.getByOpeningIds(
    deduped.map((s) => s.openingId),
  );

  const allStrikes = new Set<number>();
  const timeToStrikes = new Map<
    string,
    Map<number, { callOI: number; putOI: number }>
  >();

  for (const snap of deduped) {
    const rows = aggMap.get(snap.openingId) ?? [];
    const byStrike = new Map<number, { callOI: number; putOI: number }>();
    for (const row of rows) {
      byStrike.set(row.strike, { callOI: row.callOI, putOI: row.putOI });
      allStrikes.add(row.strike);
    }
    timeToStrikes.set(snap.marketTimeCt, byStrike);
  }

  const times = deduped.map((s) => s.marketTimeCt);
  const spots = deduped.map((s) => s.underlyingPrice ?? 0);
  const strikes = Array.from(allStrikes).sort((a, b) => a - b);

  const callOIMatrix: number[][] = [];
  const putOIMatrix: number[][] = [];

  for (const time of times) {
    const strikeMap = timeToStrikes.get(time) ?? new Map();
    const callRow: number[] = [];
    const putRow: number[] = [];
    for (const strike of strikes) {
      const accum = strikeMap.get(strike);
      callRow.push(accum?.callOI ?? 0);
      putRow.push(accum?.putOI ?? 0);
    }
    callOIMatrix.push(callRow);
    putOIMatrix.push(putRow);
  }

  return { times, strikes, spots, callOIMatrix, putOIMatrix };
}

/** Deduplicate snapshots by marketTimeCt, keeping latest capture per time label. */
function dedupByTime(snapshots: OptionCaptureSnapshotRow[]): OptionCaptureSnapshotRow[] {
  const byTime = new Map<string, OptionCaptureSnapshotRow>();
  for (const s of snapshots) {
    const prev = byTime.get(s.marketTimeCt);
    if (!prev || prev.capturedAtUtc < s.capturedAtUtc) {
      byTime.set(s.marketTimeCt, s);
    }
  }
  return Array.from(byTime.values()).sort((a, b) =>
    a.capturedAtUtc.localeCompare(b.capturedAtUtc),
  );
}

