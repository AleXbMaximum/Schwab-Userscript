/**
 * Open interest distribution, volume profile, options walls, and activity surface.
 */
import type{ OptionsChain, OptionsExpiration } from "shared/types/options";
import type {
  StrikeOIData,
  StrikeVolumeData,
  OptionsWallData,
  GexAnalytics,
  GreeksBasis,
  ActivitySurfaceData,
} from "./types";
import { pickNiceBucketWidth } from "shared/utils/math/scale";
import { computeMaxPain } from "./chainHelpers";
import { computeGexAnalytics } from "./gex";

export function computeOIDistribution(chains: OptionsChain[]): StrikeOIData[] {
  return chains.map((chain) => ({
    strike: chain.strike,
    callOI: chain.call?.oi ?? 0,
    putOI: chain.put?.oi ?? 0,
  }));
}

export function computeVolumeProfile(
  chains: OptionsChain[],
): StrikeVolumeData[] {
  return chains.map((chain) => ({
    strike: chain.strike,
    callVol: chain.call?.vol ?? 0,
    putVol: chain.put?.vol ?? 0,
  }));
}

type ComputeOptionsWallsHints = {
  maxPainStrike?: number | null;
  gexAnalytics?: GexAnalytics;
};

export function computeOptionsWalls(
  chains: OptionsChain[],
  multiplier: number,
  underlyingPrice: number | null,
  basis: GreeksBasis = "mid",
  hints: ComputeOptionsWallsHints = {},
): OptionsWallData {
  const maxPainStrike =
    hints.maxPainStrike === undefined
      ? computeMaxPain(chains)
      : hints.maxPainStrike;
  const oiByStrike = computeOIDistribution(chains);
  const gexAnalytics =
    hints.gexAnalytics ??
    computeGexAnalytics(chains, multiplier, underlyingPrice, basis);

  let callWallStrike: number | null = null;
  let callWallOI = 0;
  let callWallAboveSpotStrike: number | null = null;
  let callWallAboveSpotOI = 0;
  let putWallStrike: number | null = null;
  let putWallOI = 0;
  let putWallBelowSpotStrike: number | null = null;
  let putWallBelowSpotOI = 0;

  for (const point of oiByStrike) {
    if (point.callOI > callWallOI) {
      callWallOI = point.callOI;
      callWallStrike = point.strike;
    }
    if (
      (underlyingPrice == null || point.strike >= underlyingPrice) &&
      point.callOI > callWallAboveSpotOI
    ) {
      callWallAboveSpotOI = point.callOI;
      callWallAboveSpotStrike = point.strike;
    }
    if (point.putOI > putWallOI) {
      putWallOI = point.putOI;
      putWallStrike = point.strike;
    }
    if (
      (underlyingPrice == null || point.strike <= underlyingPrice) &&
      point.putOI > putWallBelowSpotOI
    ) {
      putWallBelowSpotOI = point.putOI;
      putWallBelowSpotStrike = point.strike;
    }
  }

  const OI_WALL_SIDE_MIN_RATIO = 0.4;
  const finalCallWallStrike =
    callWallAboveSpotStrike != null &&
    callWallAboveSpotOI >= OI_WALL_SIDE_MIN_RATIO * callWallOI
      ? callWallAboveSpotStrike
      : callWallStrike;
  const finalCallWallOI =
    finalCallWallStrike === callWallAboveSpotStrike
      ? callWallAboveSpotOI
      : callWallOI;
  const finalPutWallStrike =
    putWallBelowSpotStrike != null &&
    putWallBelowSpotOI >= OI_WALL_SIDE_MIN_RATIO * putWallOI
      ? putWallBelowSpotStrike
      : putWallStrike;
  const finalPutWallOI =
    finalPutWallStrike === putWallBelowSpotStrike
      ? putWallBelowSpotOI
      : putWallOI;

  let minIVStrike: number | null = null;
  let minIVVal = Infinity;
  for (const c of chains) {
    const callIV = c.call?.iv;
    const putIV = c.put?.iv;
    if (callIV != null && putIV != null && callIV > 0 && putIV > 0) {
      const avg = (callIV + putIV) / 2;
      if (avg < minIVVal) {
        minIVVal = avg;
        minIVStrike = c.strike;
      }
    }
  }

  return {
    maxPainStrike,
    callWallStrike: finalCallWallStrike,
    callWallOI: finalCallWallOI,
    putWallStrike: finalPutWallStrike,
    putWallOI: finalPutWallOI,
    oiByStrike,
    gammaFlipPoint: gexAnalytics.flipPoint,
    underlyingPrice,
    forward: null,
    minIVStrike,
  };
}

export function computeActivitySurface(
  expirations: OptionsExpiration[],
  underlyingPrice: number | null,
  maxExpirations: number = 12,
): ActivitySurfaceData {
  const filteredExps = expirations
    .filter((e) => e.daysUntil <= 365)
    .slice(0, maxExpirations);

  if (filteredExps.length === 0 || !underlyingPrice) {
    return {
      strikes: [],
      expirations: [],
      volMatrix: [],
      oiMatrix: [],
      ratioMatrix: [],
      callVolMatrix: [],
      putVolMatrix: [],
      callOiMatrix: [],
      putOiMatrix: [],
    };
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
  if (!isFinite(minStrike)) {
    return {
      strikes: [],
      expirations: [],
      volMatrix: [],
      oiMatrix: [],
      ratioMatrix: [],
      callVolMatrix: [],
      putVolMatrix: [],
      callOiMatrix: [],
      putOiMatrix: [],
    };
  }

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
  if (numBuckets === 0) {
    return {
      strikes: [],
      expirations: [],
      volMatrix: [],
      oiMatrix: [],
      ratioMatrix: [],
      callVolMatrix: [],
      putVolMatrix: [],
      callOiMatrix: [],
      putOiMatrix: [],
    };
  }

  const volMatrix: (number | null)[][] = [];
  const oiMatrix: (number | null)[][] = [];
  const ratioMatrix: (number | null)[][] = [];
  const callVolMatrix: (number | null)[][] = [];
  const putVolMatrix: (number | null)[][] = [];
  const callOiMatrix: (number | null)[][] = [];
  const putOiMatrix: (number | null)[][] = [];
  const expLabels: { label: string; daysUntil: number }[] = [];

  for (const exp of filteredExps) {
    expLabels.push({
      label: exp.label.split(",")[0],
      daysUntil: exp.daysUntil,
    });

    const callVolBuckets = Array.from({ length: numBuckets }, () => 0);
    const putVolBuckets = Array.from({ length: numBuckets }, () => 0);
    const callOiBuckets = Array.from({ length: numBuckets }, () => 0);
    const putOiBuckets = Array.from({ length: numBuckets }, () => 0);

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
      const callVol = chain.call?.vol ?? 0;
      const putVol = chain.put?.vol ?? 0;
      const callOI = chain.call?.oi ?? 0;
      const putOI = chain.put?.oi ?? 0;

      callVolBuckets[idx] += callVol;
      putVolBuckets[idx] += putVol;
      callOiBuckets[idx] += callOI;
      putOiBuckets[idx] += putOI;
    }

    const callVolRow = callVolBuckets.map((v) => (v > 0 ? v : null));
    const putVolRow = putVolBuckets.map((v) => (v > 0 ? v : null));
    const callOiRow = callOiBuckets.map((v) => (v > 0 ? v : null));
    const putOiRow = putOiBuckets.map((v) => (v > 0 ? v : null));

    const volRow = callVolBuckets.map((callV, i) => {
      const total = callV + putVolBuckets[i];
      return total > 0 ? total : null;
    });
    const oiRow = callOiBuckets.map((callO, i) => {
      const total = callO + putOiBuckets[i];
      return total > 0 ? total : null;
    });
    const ratioRow = volRow.map((v, i) => {
      const o = oiRow[i];
      if (v == null && o == null) return null;
      const totalVol = v ?? 0;
      const totalOI = o ?? 0;
      return totalOI > 0 ? Math.log(totalVol / totalOI + 1) : null;
    });

    volMatrix.push(volRow);
    oiMatrix.push(oiRow);
    ratioMatrix.push(ratioRow);
    callVolMatrix.push(callVolRow);
    putVolMatrix.push(putVolRow);
    callOiMatrix.push(callOiRow);
    putOiMatrix.push(putOiRow);
  }

  return {
    strikes: bucketCenters,
    expirations: expLabels,
    volMatrix,
    oiMatrix,
    ratioMatrix,
    callVolMatrix,
    putVolMatrix,
    callOiMatrix,
    putOiMatrix,
  };
}
