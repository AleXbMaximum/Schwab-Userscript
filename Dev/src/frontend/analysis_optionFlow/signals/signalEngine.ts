import type {
  OptionCapture,
  OptionCaptureMetaRow,
  OptionCaptureExpiryMetricsRow,
} from "backend/core/db/capture/optionMonitorTypes";
import type { SignalResult, SignalSeverity } from "./types";
import { buildCaptureFrames } from "../components/chartData";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import { percentileRank } from "shared/utils/math/statistics";
import { formatPct } from "shared/utils/formatters";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("compute");

const MIN_HISTORY_FOR_RANK = 5;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Keep one snapshot per date (last captured), for unbiased percentile ranking. */
function dailySnapshots(history: OptionCapture[]): OptionCapture[] {
  const byDate = new Map<string, OptionCapture>();
  for (const snap of history) {
    const date = snap.capturedAt.substring(0, 10);
    const existing = byDate.get(date);
    if (!existing || existing.capturedAt < snap.capturedAt) {
      byDate.set(date, snap);
    }
  }
  return Array.from(byDate.values());
}

function fmtPct(value: number, decimals: number = 1): string {
  return formatPct(value, { decimals, multiply: false });
}

function fmtNum(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

// ── Signal 1: IV Percentile Rank ────────────────────────────────────────────

function computeIVRank(
  history: OptionCapture[],
  currentIV: number | null,
): SignalResult {
  const id = "ivRank";
  const label = "IV RANK";

  if (currentIV == null) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "No IV data",
      severity: "neutral",
    };
  }

  const daily = dailySnapshots(history);
  const ivValues = daily
    .map((s) => s.atmIV)
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (ivValues.length < MIN_HISTORY_FOR_RANK) {
    return {
      id,
      label,
      value: fmtPct(currentIV, 1),
      detail: `< ${MIN_HISTORY_FOR_RANK} days history`,
      severity: "neutral",
    };
  }

  const sorted = [...ivValues].sort((a, b) => a - b);
  const rank = percentileRank(sorted, currentIV);

  let severity: SignalSeverity = "neutral";
  if (rank >= 90) severity = "alert";
  else if (rank >= 75) severity = "bearish";
  else if (rank <= 10) severity = "alert";
  else if (rank <= 25) severity = "bullish";

  let context: string;
  if (rank >= 90) context = "Extreme high \u2014 sell vol zone";
  else if (rank >= 75) context = "Elevated IV";
  else if (rank <= 10) context = "Extreme low \u2014 buy vol zone";
  else if (rank <= 25) context = "Depressed IV";
  else context = "Normal range";

  return {
    id,
    label,
    value: `${fmtPct(rank, 0)} (IV ${fmtPct(currentIV, 1)})`,
    detail: `${context} \u00B7 ${ivValues.length}d history`,
    severity,
    chartData: {
      kind: "sparkline",
      points: ivValues,
      currentIdx: ivValues.length - 1,
      percentile: rank,
    },
  };
}

// ── Signal 2: Skew Dynamics (RR25) ──────────────────────────────────────────

function computeSkewDynamics(
  history: OptionCapture[],
  currentRR25: number | null,
): SignalResult {
  const id = "skew";
  const label = "SKEW (RR25)";

  if (currentRR25 == null) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "No skew data",
      severity: "neutral",
    };
  }

  const daily = dailySnapshots(history);
  const rrValues = daily
    .map((s) => s.rr25)
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (rrValues.length < MIN_HISTORY_FOR_RANK) {
    return {
      id,
      label,
      value: fmtNum(currentRR25, 4),
      detail: `< ${MIN_HISTORY_FOR_RANK} days history`,
      severity: "neutral",
    };
  }

  const sorted = [...rrValues].sort((a, b) => a - b);
  const rank = percentileRank(sorted, currentRR25);

  let severity: SignalSeverity = "neutral";
  if (rank <= 5 || rank >= 95) severity = "alert";
  else if (rank <= 15 || rank >= 85) severity = "bearish";

  let context: string;
  if (rank >= 95) context = "Extreme call skew \u2014 breakout signal";
  else if (rank <= 5) context = "Extreme put skew \u2014 fear signal";
  else if (rank >= 85) context = "Elevated call premium";
  else if (rank <= 15) context = "Elevated put premium";
  else context = "Normal skew";

  return {
    id,
    label,
    value: `${fmtPct(rank, 0)} (${fmtNum(currentRR25, 4)})`,
    detail: `${context} \u00B7 ${rrValues.length}d`,
    severity,
    chartData: {
      kind: "sparkline",
      points: rrValues,
      currentIdx: rrValues.length - 1,
      percentile: rank,
    },
  };
}

// ── Signal 3: GEX Regime ────────────────────────────────────────────────────

function computeGexRegime(
  currentSpot: number | null,
  currentGammaFlip: number | null,
  currentNetGex: number | null,
): SignalResult {
  const id = "gexRegime";
  const label = "GEX REGIME";

  if (currentSpot == null || currentGammaFlip == null) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "No GEX data",
      severity: "neutral",
    };
  }

  const aboveFlip = currentSpot > currentGammaFlip;
  const distancePct = ((currentSpot - currentGammaFlip) / currentSpot) * 100;

  let severity: SignalSeverity;
  if (Math.abs(distancePct) < 0.3) {
    severity = "alert";
  } else if (aboveFlip) {
    severity = "bullish";
  } else {
    severity = "bearish";
  }

  const regime = aboveFlip ? "+Gamma" : "\u2212Gamma";
  const gexStr =
    currentNetGex != null
      ? ` \u00B7 GEX ${currentNetGex >= 0 ? "+" : ""}${(currentNetGex / 1e6).toFixed(1)}M`
      : "";

  const detail = aboveFlip
    ? `Dealers dampen vol (${fmtPct(distancePct, 1)} above flip)${gexStr}`
    : `Dealers amplify vol (${fmtPct(Math.abs(distancePct), 1)} below flip)${gexStr}`;

  // Build gauge range: pad ±2% around the spot-gammaFlip midpoint
  const mid = (currentSpot + currentGammaFlip) / 2;
  const span = Math.max(
    Math.abs(currentSpot - currentGammaFlip) * 2,
    mid * 0.04,
  );
  const rangeMin = mid - span;
  const rangeMax = mid + span;

  return {
    id,
    label,
    value: `${regime} \u00B7 $${fmtNum(currentGammaFlip, 0)}`,
    detail,
    severity,
    chartData: {
      kind: "gauge",
      value: currentSpot,
      reference: currentGammaFlip,
      range: [rangeMin, rangeMax],
    },
  };
}

// ── Signal 4: Term Structure Flip ───────────────────────────────────────────

function computeTermStructure(
  expiryRows: OptionCaptureExpiryMetricsRow[],
  openingId: string | null,
): SignalResult {
  const id = "termStructure";
  const label = "TERM STRUCT";

  if (!openingId) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "No data",
      severity: "neutral",
    };
  }

  const expiries = expiryRows
    .filter((r) => r.openingId === openingId && r.atmIV != null)
    .sort((a, b) => a.dte - b.dte);

  if (expiries.length < 2) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "Need 2+ expiries",
      severity: "neutral",
    };
  }

  const nearest = expiries[0];
  const farthest = expiries[expiries.length - 1];

  const nearIV = nearest.atmIV!;
  const farIV = farthest.atmIV!;
  const spread = nearIV - farIV;
  const spreadPct = farIV !== 0 ? spread / farIV : 0;

  const isBackwardation = spread > 0;

  let severity: SignalSeverity;
  if (isBackwardation && Math.abs(spreadPct) > 0.15) severity = "alert";
  else if (isBackwardation) severity = "bearish";
  else severity = "bullish";

  const shape = isBackwardation ? "Backwardation" : "Contango";
  const detail =
    `${nearest.dte}d IV ${fmtPct(nearIV, 1)} vs ${farthest.dte}d IV ${fmtPct(farIV, 1)}` +
    ` \u00B7 spread ${formatPct(spreadPct, { decimals: 1, showSign: true })}`;

  return {
    id,
    label,
    value: shape,
    detail,
    severity,
    chartData: {
      kind: "bars",
      labels: expiries.map((e) => `${e.dte}d`),
      values: expiries.map((e) => e.atmIV!),
    },
  };
}

// ── Signal 5: Wall Migration Velocity ───────────────────────────────────────

function computeWallVelocity(
  metaRows: OptionCaptureMetaRow[],
  expiryRows: OptionCaptureExpiryMetricsRow[],
): SignalResult {
  const id = "wallVelocity";
  const label = "WALL VELOCITY";

  if (metaRows.length < 2) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "Need 2+ snapshots",
      severity: "neutral",
    };
  }

  const frames = buildCaptureFrames(metaRows, expiryRows);
  const first = frames[0];
  const last = frames[frames.length - 1];

  const firstExp = first.nearestExpiry;
  const lastExp = last.nearestExpiry;
  if (!firstExp || !lastExp) {
    return {
      id,
      label,
      value: "\u2014",
      detail: "Missing expiry data",
      severity: "neutral",
    };
  }

  const cwFirst = firstExp.callWallOIStrike;
  const cwLast = lastExp.callWallOIStrike;
  const pwFirst = firstExp.putWallOIStrike;
  const pwLast = lastExp.putWallOIStrike;
  const mpFirst = firstExp.maxPain;
  const mpLast = lastExp.maxPain;

  const callDelta = cwFirst != null && cwLast != null ? cwLast - cwFirst : 0;
  const putDelta = pwFirst != null && pwLast != null ? pwLast - pwFirst : 0;
  const mpDelta = mpFirst != null && mpLast != null ? mpLast - mpFirst : 0;

  const spot = last.meta.underlyingPrice ?? 0;
  const maxAbsDelta = Math.max(Math.abs(callDelta), Math.abs(putDelta));
  const relMigration = spot > 0 ? (maxAbsDelta / spot) * 100 : 0;

  let severity: SignalSeverity = "neutral";
  let pattern: string;
  if (relMigration < 0.1) {
    pattern = "Stable";
  } else if (relMigration < 0.3) {
    pattern = "Slow drift";
  } else {
    severity = relMigration > 0.5 ? "alert" : "bearish";
    pattern = "Fast repositioning";
  }

  const fmtD = (d: number): string => `${d >= 0 ? "+" : ""}${fmtNum(d, 0)}`;
  const detail = `CW ${fmtD(callDelta)}, PW ${fmtD(putDelta)}, MP ${fmtD(mpDelta)}`;

  // Build multi-line series from all frames
  const callWallPts: number[] = [];
  const putWallPts: number[] = [];
  const maxPainPts: number[] = [];
  for (const f of frames) {
    const ne = f.nearestExpiry;
    if (ne) {
      callWallPts.push(ne.callWallOIStrike ?? 0);
      putWallPts.push(ne.putWallOIStrike ?? 0);
      maxPainPts.push(ne.maxPain ?? 0);
    }
  }

  const hasData = callWallPts.length >= 2;

  return {
    id,
    label,
    value: pattern,
    detail,
    severity,
    chartData: hasData
      ? {
          kind: "multiLine",
          series: [
            {
              label: "CW",
              color: OPTIONS_SEMANTIC_COLORS.callWall,
              points: callWallPts,
            },
            {
              label: "PW",
              color: OPTIONS_SEMANTIC_COLORS.putWall,
              points: putWallPts,
            },
            {
              label: "MP",
              color: OPTIONS_SEMANTIC_COLORS.maxPain,
              points: maxPainPts,
            },
          ],
        }
      : undefined,
  };
}

// ── Main Entry ──────────────────────────────────────────────────────────────

export function computeAlphaSignals(
  history: OptionCapture[],
  metaRows: OptionCaptureMetaRow[],
  expiryRows: OptionCaptureExpiryMetricsRow[],
): SignalResult[] {
  const frames = buildCaptureFrames(metaRows, expiryRows);
  const latest = frames.length > 0 ? frames[frames.length - 1] : null;

  const currentIV = latest?.nearestExpiry?.atmIV ?? null;
  const currentRR25 = latest?.nearestExpiry?.rr25 ?? null;
  const currentSpot = latest?.meta.underlyingPrice ?? null;
  const currentGammaFlip = latest?.nearestExpiry?.gammaFlip ?? null;
  const currentNetGex = latest?.nearestExpiry?.totalNetGex ?? null;
  const latestOpeningId = latest?.meta.openingId ?? null;

  const signals = [
    computeIVRank(history, currentIV),
    computeSkewDynamics(history, currentRR25),
    computeGexRegime(currentSpot, currentGammaFlip, currentNetGex),
    computeTermStructure(expiryRows, latestOpeningId),
    computeWallVelocity(metaRows, expiryRows),
  ];

  log.debug("signals.compute.done", () => ({
    count: signals.length,
    alerts: signals.filter((s) => s.severity === "alert").length,
  }));

  return signals;
}
