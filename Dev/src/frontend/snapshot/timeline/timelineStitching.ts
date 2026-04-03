import type { AccountHistoryPoint } from "../../../backend/core/db/account/accountHistoryTypes";
import { formatDateCT, isInCTHourWindow } from "../../../shared/utils/time";
import { asFiniteNumber, ONE_HOUR_MS } from "./timelineConstants";
import { median } from "../../../shared/utils/math/statistics";

const NIGHT_SESSION_START_HOUR_CT = 19;
const NIGHT_SESSION_END_HOUR_CT = 3;
const DAY_CHANGE_DISCONTINUITY_MIN_DOLLAR = 600;
const DAY_CHANGE_DISCONTINUITY_MULTIPLIER = 8;

export function isNightSession(ts: number): boolean {
  return isInCTHourWindow(
    ts,
    NIGHT_SESSION_START_HOUR_CT,
    NIGHT_SESSION_END_HOUR_CT,
  );
}

function getResetAlignedCtDayKey(ts: number, resetHourCt: number): string {
  const shiftedTs = ts - resetHourCt * ONE_HOUR_MS;
  return (
    formatDateCT(shiftedTs) ??
    `ct-day-${Math.floor(shiftedTs / (24 * ONE_HOUR_MS))}`
  );
}

function buildDayStitchSegments(
  points: AccountHistoryPoint[],
  resetHourCt: number,
): Array<{ start: number; end: number }> {
  if (points.length === 0) return [];

  const cutIndexes = new Set<number>();
  let previousDayKey = getResetAlignedCtDayKey(points[0].ts, resetHourCt);
  for (let i = 1; i < points.length; i += 1) {
    const dayKey = getResetAlignedCtDayKey(points[i].ts, resetHourCt);
    if (dayKey !== previousDayKey) cutIndexes.add(i);
    previousDayKey = dayKey;
  }

  const unexplainedAbsDiffs: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const dayDelta =
      asFiniteNumber(points[i].dayChangeDollar) -
      asFiniteNumber(points[i - 1].dayChangeDollar);
    const totalDelta =
      asFiniteNumber(points[i].gainLossDollar) -
      asFiniteNumber(points[i - 1].gainLossDollar);
    unexplainedAbsDiffs.push(Math.abs(dayDelta - totalDelta));
  }
  const adaptiveThreshold = Math.max(
    DAY_CHANGE_DISCONTINUITY_MIN_DOLLAR,
    median(unexplainedAbsDiffs) * DAY_CHANGE_DISCONTINUITY_MULTIPLIER,
  );
  for (let i = 1; i < points.length; i += 1) {
    const dayDelta =
      asFiniteNumber(points[i].dayChangeDollar) -
      asFiniteNumber(points[i - 1].dayChangeDollar);
    const totalDelta =
      asFiniteNumber(points[i].gainLossDollar) -
      asFiniteNumber(points[i - 1].gainLossDollar);
    const unexplainedAbs = Math.abs(dayDelta - totalDelta);
    if (unexplainedAbs >= adaptiveThreshold) {
      cutIndexes.add(i);
    }
  }

  const segments: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (!cutIndexes.has(i)) continue;
    segments.push({ start, end: i - 1 });
    start = i;
  }
  segments.push({ start, end: points.length - 1 });
  return segments;
}

function stitchSeriesWithSegments(
  points: AccountHistoryPoint[],
  pick: (point: AccountHistoryPoint) => number,
  segments: Array<{ start: number; end: number }>,
): number[] {
  const rawValues = points.map((point) => asFiniteNumber(pick(point)));
  if (rawValues.length < 2) return rawValues;

  if (segments.length < 2) return rawValues;

  const offsets = new Array<number>(segments.length).fill(0);
  for (
    let segmentIndex = segments.length - 2;
    segmentIndex >= 0;
    segmentIndex -= 1
  ) {
    const current = segments[segmentIndex];
    const next = segments[segmentIndex + 1];
    const nextStartAdjusted = rawValues[next.start] + offsets[segmentIndex + 1];
    offsets[segmentIndex] = nextStartAdjusted - rawValues[current.end];
  }

  const stitchedValues = rawValues.slice();
  for (
    let segmentIndex = 0;
    segmentIndex < segments.length;
    segmentIndex += 1
  ) {
    const offset = offsets[segmentIndex];
    if (offset === 0) continue;

    const segment = segments[segmentIndex];
    for (let i = segment.start; i <= segment.end; i += 1) {
      stitchedValues[i] = rawValues[i] + offset;
    }
  }
  return stitchedValues;
}

export function buildDayResetStitchedPoints(
  points: AccountHistoryPoint[],
): AccountHistoryPoint[] {
  if (points.length < 2) return points;

  const segments = buildDayStitchSegments(points, NIGHT_SESSION_END_HOUR_CT);
  if (segments.length < 2) return points;

  const stitchedDayDollar = stitchSeriesWithSegments(
    points,
    (point) => point.dayChangeDollar,
    segments,
  );
  const stitchedDayPercent = stitchSeriesWithSegments(
    points,
    (point) => point.dayChangePercent,
    segments,
  );

  let hasChanges = false;
  for (let i = 0; i < points.length; i += 1) {
    if (
      stitchedDayDollar[i] !== points[i].dayChangeDollar ||
      stitchedDayPercent[i] !== points[i].dayChangePercent
    ) {
      hasChanges = true;
      break;
    }
  }
  if (!hasChanges) return points;

  return points.map((point, index) => ({
    ...point,
    dayChangeDollar: stitchedDayDollar[index],
    dayChangePercent: stitchedDayPercent[index],
  }));
}
