/**
 * Implied volatility computations: IV skew, term structure, vol surface,
 * surface diagnostics, and IV smile overlay.
 */
import type{ OptionsChain, OptionsExpiration } from "shared/types/options";
import type {
  IVSkewPoint,
  TermStructurePoint,
  VolSurfaceData,
  VolSurfaceDiagnostics,
  CalendarViolation,
  ButterflyViolation,
  IVSmileLine,
} from "./types";
import { pickNiceBucketWidth } from "shared/utils/math/scale";
import { findATMChain, filterChainsAroundATM } from "./chainHelpers";

export function computeIVSkew(chains: OptionsChain[]): IVSkewPoint[] {
  return chains.map((chain) => ({
    strike: chain.strike,
    callIV: chain.call?.iv ?? null,
    putIV: chain.put?.iv ?? null,
  }));
}

export function computeTermStructure(
  expirations: OptionsExpiration[],
  underlyingPrice: number | null,
): TermStructurePoint[] {
  return expirations.map((exp) => {
    const atmChain = findATMChain(exp.chains, underlyingPrice);

    const atmCallIV = atmChain?.call?.iv ?? null;
    const atmPutIV = atmChain?.put?.iv ?? null;
    const avgIV =
      atmCallIV != null && atmPutIV != null
        ? (atmCallIV + atmPutIV) / 2
        : (atmCallIV ?? atmPutIV);

    return {
      label: exp.label,
      daysUntil: exp.daysUntil,
      atmCallIV,
      atmPutIV,
      avgIV,
    };
  });
}

export function computeVolSurface(
  expirations: OptionsExpiration[],
  underlyingPrice: number | null,
  maxExpirations: number = 12,
): VolSurfaceData {
  const filteredExps = expirations
    .filter((e) => e.daysUntil <= 365)
    .slice(0, maxExpirations);

  if (filteredExps.length === 0 || !underlyingPrice) {
    return { strikes: [], expirations: [], matrix: [] };
  }

  const lower = underlyingPrice * 0.75;
  const upper = underlyingPrice * 1.25;

  let minStrike = Infinity;
  let maxStrike = -Infinity;
  for (const exp of filteredExps) {
    for (const chain of exp.chains) {
      if (chain.strike >= lower && chain.strike <= upper) {
        minStrike = Math.min(minStrike, chain.strike);
        maxStrike = Math.max(maxStrike, chain.strike);
      }
    }
  }
  if (!isFinite(minStrike)) return { strikes: [], expirations: [], matrix: [] };

  const maxColumns = 30;
  const range = maxStrike - minStrike;
  const bucketWidth = pickNiceBucketWidth(range, maxColumns);

  const alignedStart = Math.floor(minStrike / bucketWidth) * bucketWidth;
  const alignedEnd = Math.ceil(maxStrike / bucketWidth) * bucketWidth;

  const bucketCenters: number[] = [];
  for (let strike = alignedStart; strike <= alignedEnd; strike += bucketWidth) {
    bucketCenters.push(Math.round(strike * 100) / 100);
  }
  const numBuckets = bucketCenters.length;
  if (numBuckets === 0) return { strikes: [], expirations: [], matrix: [] };

  const matrix: (number | null)[][] = [];
  const expLabels: { label: string; daysUntil: number }[] = [];

  for (const exp of filteredExps) {
    expLabels.push({
      label: exp.label.split(",")[0],
      daysUntil: exp.daysUntil,
    });

    const buckets: { sum: number; count: number }[] = Array.from(
      { length: numBuckets },
      () => ({ sum: 0, count: 0 }),
    );

    for (const chain of exp.chains) {
      if (
        chain.strike < alignedStart - bucketWidth / 2 ||
        chain.strike > alignedEnd + bucketWidth / 2
      )
        continue;
      const idx = Math.min(
        numBuckets - 1,
        Math.max(0, Math.round((chain.strike - alignedStart) / bucketWidth)),
      );
      const callIV = chain.call?.iv ?? null;
      const putIV = chain.put?.iv ?? null;
      const avg =
        callIV != null && putIV != null
          ? (callIV + putIV) / 2
          : (callIV ?? putIV);
      if (avg != null) {
        buckets[idx].sum += avg;
        buckets[idx].count++;
      }
    }

    matrix.push(buckets.map((b) => (b.count > 0 ? b.sum / b.count : null)));
  }

  return { strikes: bucketCenters, expirations: expLabels, matrix };
}

export function computeVolSurfaceDiagnostics(
  surfaceData: VolSurfaceData,
): VolSurfaceDiagnostics {
  const { strikes, expirations, matrix } = surfaceData;
  const calendarViolations: CalendarViolation[] = [];
  const butterflyViolations: ButterflyViolation[] = [];
  let totalPoints = 0;
  let filledPoints = 0;

  for (let expIdx = 0; expIdx < expirations.length; expIdx++) {
    for (let sIdx = 0; sIdx < strikes.length; sIdx++) {
      totalPoints++;
      if (matrix[expIdx]?.[sIdx] != null) filledPoints++;
    }
  }

  for (let sIdx = 0; sIdx < strikes.length; sIdx++) {
    for (let expIdx = 1; expIdx < expirations.length; expIdx++) {
      const iv1 = matrix[expIdx - 1]?.[sIdx];
      const iv2 = matrix[expIdx]?.[sIdx];
      if (iv1 == null || iv2 == null) continue;

      const t1 = expirations[expIdx - 1].daysUntil / 365;
      const t2 = expirations[expIdx].daysUntil / 365;
      const tv1 = (iv1 / 100) * (iv1 / 100) * t1;
      const tv2 = (iv2 / 100) * (iv2 / 100) * t2;

      if (tv2 < tv1 * 0.98) {
        // 2% tolerance
        calendarViolations.push({
          strike: strikes[sIdx],
          exp1: expirations[expIdx - 1].label,
          exp2: expirations[expIdx].label,
          iv1,
          iv2,
        });
      }
    }
  }

  for (let expIdx = 0; expIdx < expirations.length; expIdx++) {
    for (let sIdx = 1; sIdx < strikes.length - 1; sIdx++) {
      const ivL = matrix[expIdx]?.[sIdx - 1];
      const ivM = matrix[expIdx]?.[sIdx];
      const ivR = matrix[expIdx]?.[sIdx + 1];
      if (ivL == null || ivM == null || ivR == null) continue;

      if (ivL + ivR < 2 * ivM - 0.5) {
        // 0.5pp tolerance
        butterflyViolations.push({
          strike: strikes[sIdx],
          exp: expirations[expIdx].label,
          detail: `IV(${strikes[sIdx - 1]})=${ivL.toFixed(1)} + IV(${strikes[sIdx + 1]})=${ivR.toFixed(1)} < 2*IV(${strikes[sIdx]})=${(2 * ivM).toFixed(1)}`,
        });
      }
    }
  }

  const missingPointPct =
    totalPoints > 0 ? ((totalPoints - filledPoints) / totalPoints) * 100 : 0;

  return {
    calendarViolations,
    butterflyViolations,
    missingPointPct,
    totalPoints,
    filledPoints,
    interpolationMethod: "Linear (bucketed average)",
  };
}

export function computeIVSmileOverlay(
  expirations: OptionsExpiration[],
  underlyingPrice: number | null,
  maxExps: number = 6,
): IVSmileLine[] {
  const filtered = expirations.filter(
    (e) => e.daysUntil > 0 && e.daysUntil <= 365,
  );
  const selected = filtered
    .map((exp) => ({
      exp,
      totalOI: exp.chains.reduce(
        (sum, chain) => sum + (chain.call?.oi ?? 0) + (chain.put?.oi ?? 0),
        0,
      ),
    }))
    .sort((a, b) => {
      if (b.totalOI !== a.totalOI) return b.totalOI - a.totalOI;
      return a.exp.daysUntil - b.exp.daysUntil;
    })
    .slice(0, maxExps)
    .map(({ exp }) => exp)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return selected.map((exp) => {
    const chains = filterChainsAroundATM(exp.chains, underlyingPrice, 25);
    return {
      label: `${exp.label.split(",")[0]} (${exp.daysUntil}d)`,
      daysUntil: exp.daysUntil,
      points: chains.map((chain) => ({
        strike: chain.strike,
        iv:
          chain.call?.iv != null && chain.put?.iv != null
            ? (chain.call.iv + chain.put.iv) / 2
            : (chain.call?.iv ?? chain.put?.iv ?? null),
      })),
    };
  });
}
