import type {
  GapMode,
  SessionType,
  TimeSegment,
  TimeAxisMapping,
} from "../timelineTypes";

// ── Constants ─────────────────────────────────────────────────────────────────

const PRE_MARKET_START_MIN_CT = 180;
const REGULAR_OPEN_MIN_CT = 510;
const REGULAR_CLOSE_MIN_CT = 900;
const POST_MARKET_END_MIN_CT = 1140;
const COMPRESSED_GAP_PX = 18;

// ── Time axis utilities ───────────────────────────────────────────────────────

function getCtHour(ts: number): number {
  return parseInt(
    new Date(ts).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }),
  );
}

function ctMinuteToUtcMs(
  y: number,
  m: number,
  d: number,
  minCT: number,
): number {
  const h = Math.floor(minCT / 60);
  const min = minCT % 60;
  const guess = Date.UTC(y, m - 1, d, h + 6, min);
  const actualH = getCtHour(guess);
  return guess + (actualH === h ? 0 : -3_600_000);
}

export function getGapMode(rangeDurationMs: number): GapMode {
  return rangeDurationMs <= 3 * 86_400_000 ? "compressed" : "stitched";
}

export function buildTimeAxisMapping(
  startTs: number,
  endTs: number,
  chartW: number,
  padLeft: number,
  mode: GapMode,
): TimeAxisMapping {
  const ONE_DAY = 86_400_000;
  const seen = new Set<string>();
  const activeRaw: Array<{
    startTs: number;
    endTs: number;
    sessionType: SessionType;
  }> = [];

  for (
    let dayTs = startTs - ONE_DAY;
    dayTs <= endTs + ONE_DAY;
    dayTs += ONE_DAY
  ) {
    const dateStr = new Date(dayTs).toLocaleDateString("en-CA", {
      timeZone: "America/Chicago",
    });
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);

    const [y, m, d] = dateStr.split("-").map(Number);
    const preStart = ctMinuteToUtcMs(y, m, d, PRE_MARKET_START_MIN_CT);

    const dow = new Date(preStart).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
    });
    if (dow === "Sat" || dow === "Sun") continue;

    const regOpen = ctMinuteToUtcMs(y, m, d, REGULAR_OPEN_MIN_CT);
    const regClose = ctMinuteToUtcMs(y, m, d, REGULAR_CLOSE_MIN_CT);
    const postEnd = ctMinuteToUtcMs(y, m, d, POST_MARKET_END_MIN_CT);

    activeRaw.push({ startTs: preStart, endTs: regOpen, sessionType: "pre" });
    activeRaw.push({
      startTs: regOpen,
      endTs: regClose,
      sessionType: "regular",
    });
    activeRaw.push({ startTs: regClose, endTs: postEnd, sessionType: "post" });
  }

  activeRaw.sort((a, b) => a.startTs - b.startTs);

  const clipped: typeof activeRaw = [];
  for (const seg of activeRaw) {
    const s = Math.max(seg.startTs, startTs);
    const e = Math.min(seg.endTs, endTs);
    if (e > s)
      clipped.push({ startTs: s, endTs: e, sessionType: seg.sessionType });
  }

  if (clipped.length === 0) {
    const seg: TimeSegment = {
      startTs,
      endTs,
      startPx: padLeft,
      endPx: padLeft + chartW,
      isGap: false,
      sessionType: "regular",
    };
    return {
      segments: [seg],
      toX: (ts) => padLeft + ((ts - startTs) / (endTs - startTs)) * chartW,
      fromX: (x) => startTs + ((x - padLeft) / chartW) * (endTs - startTs),
    };
  }

  const allSegs: TimeSegment[] = [];

  if (clipped[0].startTs > startTs && mode === "compressed") {
    allSegs.push({
      startTs,
      endTs: clipped[0].startTs,
      startPx: 0,
      endPx: 0,
      isGap: true,
      sessionType: "overnight",
    });
  }

  for (let i = 0; i < clipped.length; i++) {
    allSegs.push({
      startTs: clipped[i].startTs,
      endTs: clipped[i].endTs,
      startPx: 0,
      endPx: 0,
      isGap: false,
      sessionType: clipped[i].sessionType,
    });

    if (i < clipped.length - 1 && clipped[i].endTs < clipped[i + 1].startTs) {
      allSegs.push({
        startTs: clipped[i].endTs,
        endTs: clipped[i + 1].startTs,
        startPx: 0,
        endPx: 0,
        isGap: true,
        sessionType: "overnight",
      });
    }
  }

  if (clipped[clipped.length - 1].endTs < endTs && mode === "compressed") {
    allSegs.push({
      startTs: clipped[clipped.length - 1].endTs,
      endTs,
      startPx: 0,
      endPx: 0,
      isGap: true,
      sessionType: "overnight",
    });
  }

  const gapCount = allSegs.filter((s) => s.isGap).length;
  const totalActiveDur = allSegs
    .filter((s) => !s.isGap)
    .reduce((sum, s) => sum + (s.endTs - s.startTs), 0);
  const totalGapPx = mode === "compressed" ? gapCount * COMPRESSED_GAP_PX : 0;
  const activePx = Math.max(1, chartW - totalGapPx);

  let px = padLeft;
  for (const seg of allSegs) {
    seg.startPx = px;
    if (seg.isGap) {
      seg.endPx = px + (mode === "compressed" ? COMPRESSED_GAP_PX : 0);
    } else {
      const frac =
        totalActiveDur > 0 ? (seg.endTs - seg.startTs) / totalActiveDur : 0;
      seg.endPx = px + frac * activePx;
    }
    px = seg.endPx;
  }

  if (allSegs.length > 0) {
    allSegs[allSegs.length - 1].endPx = padLeft + chartW;
  }

  const toX = (ts: number): number => {
    if (ts <= allSegs[0].startTs) return allSegs[0].startPx;
    if (ts >= allSegs[allSegs.length - 1].endTs)
      return allSegs[allSegs.length - 1].endPx;

    for (const seg of allSegs) {
      if (ts >= seg.startTs && ts <= seg.endTs) {
        const dur = seg.endTs - seg.startTs;
        if (dur <= 0) return seg.startPx;
        return (
          seg.startPx + ((ts - seg.startTs) / dur) * (seg.endPx - seg.startPx)
        );
      }
    }
    return padLeft;
  };

  const fromX = (x: number): number => {
    if (x <= allSegs[0].startPx) return allSegs[0].startTs;
    if (x >= allSegs[allSegs.length - 1].endPx)
      return allSegs[allSegs.length - 1].endTs;

    for (const seg of allSegs) {
      if (x >= seg.startPx && x <= seg.endPx) {
        const pxW = seg.endPx - seg.startPx;
        if (pxW <= 0) return seg.startTs;
        return (
          seg.startTs + ((x - seg.startPx) / pxW) * (seg.endTs - seg.startTs)
        );
      }
    }
    return startTs;
  };

  return { segments: allSegs, toX, fromX };
}

export function generateSessionAwareTicks(
  segments: TimeSegment[],
  rangeDurationMs: number,
  mode: GapMode,
  startTs: number,
  endTs: number,
): { ts: number; dateOnly: boolean }[] {
  const activeSegments = segments.filter((s) => !s.isGap);

  if (mode === "stitched") {
    const dayTicks = segments
      .filter((s) => s.sessionType === "regular" && !s.isGap)
      .map((s) => s.startTs);

    const DAY = 86_400_000;
    let step: number;
    if (rangeDurationMs <= 10 * DAY) step = 1;
    else if (rangeDurationMs <= 35 * DAY) step = 5;
    else if (rangeDurationMs <= 100 * DAY) step = 15;
    else step = 30;

    const result =
      step <= 1 ? dayTicks : dayTicks.filter((_, i) => i % step === 0);
    return result.map((ts) => ({ ts, dateOnly: true }));
  }

  const rawTicks = generateTimeTicks(startTs, endTs, rangeDurationMs);
  return rawTicks
    .filter((t) =>
      activeSegments.some((seg) => t >= seg.startTs && t <= seg.endTs),
    )
    .map((ts) => ({ ts, dateOnly: false }));
}

export function getMarketBoundaries(
  startTs: number,
  endTs: number,
): { ts: number; label: string }[] {
  const results: { ts: number; label: string }[] = [];
  const seen = new Set<string>();
  const ONE_DAY = 86_400_000;

  for (
    let dayTs = startTs - ONE_DAY;
    dayTs <= endTs + ONE_DAY;
    dayTs += ONE_DAY
  ) {
    const dateStr = new Date(dayTs).toLocaleDateString("en-CA", {
      timeZone: "America/Chicago",
    });
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);

    const [y, m, d] = dateStr.split("-").map(Number);

    const openGuess = Date.UTC(y, m - 1, d, 14, 30);
    const ctHour = getCtHour(openGuess);
    const adj = ctHour === 8 ? 0 : -3_600_000;
    const openTs = openGuess + adj;
    const closeTs = Date.UTC(y, m - 1, d, 21, 0) + adj;

    const dow = new Date(openTs).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
    });
    if (dow === "Sat" || dow === "Sun") continue;

    if (openTs >= startTs && openTs <= endTs)
      results.push({ ts: openTs, label: "Open" });
    if (closeTs >= startTs && closeTs <= endTs)
      results.push({ ts: closeTs, label: "Close" });
  }

  return results.sort((a, b) => a.ts - b.ts);
}

export function generateTimeTicks(
  startTs: number,
  endTs: number,
  rangeDurationMs: number,
): number[] {
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  let stepMs: number;
  if (rangeDurationMs <= 2 * HOUR) stepMs = 15 * MIN;
  else if (rangeDurationMs <= 8 * HOUR) stepMs = HOUR;
  else if (rangeDurationMs <= 2 * DAY) stepMs = 4 * HOUR;
  else if (rangeDurationMs <= 5 * DAY) stepMs = 12 * HOUR;
  else if (rangeDurationMs <= 10 * DAY) stepMs = DAY;
  else if (rangeDurationMs <= 35 * DAY) stepMs = 5 * DAY;
  else if (rangeDurationMs <= 100 * DAY) stepMs = 14 * DAY;
  else stepMs = 30 * DAY;

  const first = Math.ceil(startTs / stepMs) * stepMs;
  const ticks: number[] = [];
  for (let t = first; t <= endTs; t += stepMs) {
    ticks.push(t);
  }
  return ticks;
}
