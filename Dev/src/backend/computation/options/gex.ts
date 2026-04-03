/**
 * GEX (Gamma Exposure) analytics, cumulative GEX, and scenario shift computation.
 */
import type{ OptionsChain } from "shared/types/options";
import type {
  GexDataPoint,
  GexAnalytics,
  GexContributor,
  CumulativeGexPoint,
  GreeksBasis,
  GexGammaSource,
  BSGexParams,
  ScenarioInput,
  ScenarioOutput,
} from "./types";
import { computeGex, isSortedByStrike, greekBasisScale } from "./chainHelpers";
import { computeBSGex } from "./bsGex";
import { blackScholes } from "../math/blackScholes";

export function computeGexAnalytics(
  chains: OptionsChain[],
  multiplier: number,
  underlyingPrice: number | null,
  basis: GreeksBasis = "mid",
  bsConfig?: { gammaSource: GexGammaSource } & BSGexParams,
): GexAnalytics {
  const data =
    bsConfig?.gammaSource === "bs"
      ? computeBSGex(chains, {
          spot: underlyingPrice ?? 0,
          riskFreeRate: bsConfig.riskFreeRate,
          daysToExpiry: bsConfig.daysToExpiry,
          dividendYield: bsConfig.dividendYield,
          multiplier,
        })
      : computeGex(chains, multiplier, underlyingPrice, basis);
  if (!isSortedByStrike(data)) {
    data.sort((a, b) => a.strike - b.strike);
  }

  let totalNetGex = 0;
  let grossGex = 0;
  let maxCallGex = 0;
  let maxCallGexAboveSpot = 0;
  let maxPutGex = 0;
  let maxPutGexBelowSpot = 0;
  let callWallStrike: number | null = null;
  let callWallAboveSpot: number | null = null;
  let putWallStrike: number | null = null;
  let putWallBelowSpot: number | null = null;

  for (const point of data) {
    totalNetGex += point.netGex;
    grossGex += Math.abs(point.netGex);
    if (point.callGex > maxCallGex) {
      maxCallGex = point.callGex;
      callWallStrike = point.strike;
    }
    if (
      (underlyingPrice == null || point.strike >= underlyingPrice) &&
      point.callGex > maxCallGexAboveSpot
    ) {
      maxCallGexAboveSpot = point.callGex;
      callWallAboveSpot = point.strike;
    }
    if (Math.abs(point.putGex) > maxPutGex) {
      maxPutGex = Math.abs(point.putGex);
      putWallStrike = point.strike;
    }
    if (
      (underlyingPrice == null || point.strike <= underlyingPrice) &&
      Math.abs(point.putGex) > maxPutGexBelowSpot
    ) {
      maxPutGexBelowSpot = Math.abs(point.putGex);
      putWallBelowSpot = point.strike;
    }
  }

  // Prefer the side-appropriate wall (call above spot, put below spot).
  // Fall back to the global max only when the side-appropriate concentration
  // is less than 40% of the global peak — meaning the genuine mass is on the
  // "wrong" side and the global value is more informative.
  const WALL_SIDE_MIN_RATIO = 0.4;
  const finalCallWallStrike =
    callWallAboveSpot != null &&
    maxCallGexAboveSpot >= WALL_SIDE_MIN_RATIO * maxCallGex
      ? callWallAboveSpot
      : callWallStrike;
  const finalPutWallStrike =
    putWallBelowSpot != null && maxPutGexBelowSpot >= WALL_SIDE_MIN_RATIO * maxPutGex
      ? putWallBelowSpot
      : putWallStrike;

  const sorted = [...data].sort(
    (a, b) => Math.abs(b.netGex) - Math.abs(a.netGex),
  );
  const topContributors: GexContributor[] = sorted.slice(0, 5).map((point) => ({
    strike: point.strike,
    netGex: point.netGex,
    callGex: point.callGex,
    putGex: point.putGex,
  }));

  // Only count zero-crossings where the adjacent bars average ≥ 1% of gross
  // GEX. This filters phantom flips in sparse/low-GEX regions (e.g., far-OTM
  // strikes) while preserving real gamma-regime transitions.
  const FLIP_MIN_MAGNITUDE = 0.01;
  const crossings: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].netGex;
    const curr = data[i].netGex;
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      const avgMag = (Math.abs(prev) + Math.abs(curr)) / 2;
      if (grossGex === 0 || avgMag >= FLIP_MIN_MAGNITUDE * grossGex) {
        const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        crossings.push(
          data[i - 1].strike + ratio * (data[i].strike - data[i - 1].strike),
        );
      }
    }
  }

  let flipPoint: number | null = null;
  if (crossings.length > 0 && underlyingPrice != null) {
    flipPoint = crossings.reduce((best, c) =>
      Math.abs(c - underlyingPrice) < Math.abs(best - underlyingPrice)
        ? c
        : best,
    );
  } else if (crossings.length > 0) {
    flipPoint = crossings[0];
  }

  let isPositiveGamma = totalNetGex >= 0;
  if (underlyingPrice != null && data.length > 0) {
    const nearSpot = data.reduce((best, point) =>
      Math.abs(point.strike - underlyingPrice) <
      Math.abs(best.strike - underlyingPrice)
        ? point
        : best,
    );
    isPositiveGamma = nearSpot.netGex >= 0;
  }

  return {
    data,
    totalNetGex,
    grossGex,
    flipPoint,
    isPositiveGamma,
    callWallStrike: finalCallWallStrike,
    putWallStrike: finalPutWallStrike,
    gammaPivot: isPositiveGamma ? "Positive" : "Negative",
    topContributors,
  };
}

export function computeCumulativeGex(
  gexData: GexDataPoint[],
): CumulativeGexPoint[] {
  let pos = 0;
  let neg = 0;
  return gexData.map((point) => {
    if (point.netGex >= 0) pos += point.netGex;
    else neg += point.netGex;
    return { strike: point.strike, cumPos: pos, cumNeg: neg };
  });
}

export function computeScenarioShift(
  chains: OptionsChain[],
  multiplier: number,
  underlyingPrice: number | null,
  input: ScenarioInput,
  basis: GreeksBasis = "mid",
): ScenarioOutput {
  const spot = underlyingPrice ?? 0;
  const dS = (spot * input.deltaSpotPct) / 100;
  const newSpot = spot + dS;

  const shiftedGex: GexDataPoint[] = chains.map((chain) => {
    const callGamma = (chain.call?.gamma ?? 0) * greekBasisScale(chain.call, basis);
    const putGamma = (chain.put?.gamma ?? 0) * greekBasisScale(chain.put, basis);
    const callOI = chain.call?.oi ?? 0;
    const putOI = chain.put?.oi ?? 0;

    const ivScale = 1 + input.deltaIVPct / 100;
    const adjCallGamma = callGamma * ivScale;
    const adjPutGamma = putGamma * ivScale;

    const callGex =
      (callOI * adjCallGamma * newSpot * newSpot * multiplier) / 100;
    const putGex = -(
      (putOI * adjPutGamma * newSpot * newSpot * multiplier) /
      100
    );
    return { strike: chain.strike, callGex, putGex, netGex: callGex + putGex };
  });
  shiftedGex.sort((a, b) => a.strike - b.strike);

  let shiftedFlip: number | null = null;
  for (let i = 1; i < shiftedGex.length; i++) {
    const prev = shiftedGex[i - 1].netGex;
    const curr = shiftedGex[i].netGex;
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
      const flip =
        shiftedGex[i - 1].strike +
        ratio * (shiftedGex[i].strike - shiftedGex[i - 1].strike);
      if (
        shiftedFlip == null ||
        Math.abs(flip - newSpot) < Math.abs(shiftedFlip - newSpot)
      ) {
        shiftedFlip = flip;
      }
    }
  }

  let shiftedCallWall: number | null = null;
  let maxCallGex = 0;
  let shiftedPutWall: number | null = null;
  let maxPutGex = 0;
  for (const point of shiftedGex) {
    if (point.callGex > maxCallGex) {
      maxCallGex = point.callGex;
      shiftedCallWall = point.strike;
    }
    if (Math.abs(point.putGex) > maxPutGex) {
      maxPutGex = Math.abs(point.putGex);
      shiftedPutWall = point.strike;
    }
  }

  let hedgeFlowEstimate: number | null = null;
  if (spot > 0) {
    let totalDeltaShift = 0;
    for (const chain of chains) {
      const callOI = chain.call?.oi ?? 0;
      const putOI = chain.put?.oi ?? 0;
      const callGamma = (chain.call?.gamma ?? 0) * greekBasisScale(chain.call, basis);
      const putGamma = (chain.put?.gamma ?? 0) * greekBasisScale(chain.put, basis);
      totalDeltaShift +=
        (callOI * callGamma - putOI * putGamma) * dS * multiplier;
    }
    hedgeFlowEstimate = -totalDeltaShift * spot; // $ value of hedge flow
  }

  return {
    shiftedGex,
    shiftedFlip,
    shiftedCallWall,
    shiftedPutWall,
    hedgeFlowEstimate,
  };
}

/**
 * BS-based scenario shift: recomputes gamma at shifted spot/IV/DTE
 * using full Black-Scholes instead of linear scaling.
 *
 * Captures nonlinear effects that linear scaling misses:
 *   - Gamma itself changes with spot (gamma-of-gamma)
 *   - IV shift affects gamma nonlinearly (vomma)
 *   - DTE decay is properly modeled
 */
export function computeBSScenarioShift(
  chains: OptionsChain[],
  multiplier: number,
  underlyingPrice: number | null,
  input: ScenarioInput,
  bsParams: BSGexParams,
): ScenarioOutput {
  const spot = underlyingPrice ?? 0;
  const dS = (spot * input.deltaSpotPct) / 100;
  const newSpot = spot + dS;
  const newDTE = Math.max(0, bsParams.daysToExpiry - input.deltaDays);
  const T = newDTE / 365;
  const r = bsParams.riskFreeRate;
  const q = bsParams.dividendYield ?? 0;

  const shiftedGex: GexDataPoint[] = chains.map((chain) => {
    const callIV = chain.call?.iv ?? 0;
    const putIV = chain.put?.iv ?? 0;
    const baseIV =
      callIV > 0 && putIV > 0
        ? (callIV + putIV) / 2
        : callIV > 0
          ? callIV
          : putIV;
    const shiftedIV = baseIV * (1 + input.deltaIVPct / 100);

    if (shiftedIV <= 0 || T <= 0 || newSpot <= 0) {
      return { strike: chain.strike, callGex: 0, putGex: 0, netGex: 0 };
    }

    const bs = blackScholes({
      spot: newSpot,
      strike: chain.strike,
      timeToExpiry: T,
      riskFreeRate: r,
      iv: shiftedIV,
      dividendYield: q,
    });

    const callOI = chain.call?.oi ?? 0;
    const putOI = chain.put?.oi ?? 0;
    const gexFactor = (bs.gamma * newSpot * newSpot * multiplier) / 100;
    const callGex = callOI * gexFactor;
    const putGex = -(putOI * gexFactor);

    return { strike: chain.strike, callGex, putGex, netGex: callGex + putGex };
  });
  shiftedGex.sort((a, b) => a.strike - b.strike);

  let shiftedFlip: number | null = null;
  for (let i = 1; i < shiftedGex.length; i++) {
    const prev = shiftedGex[i - 1].netGex;
    const curr = shiftedGex[i].netGex;
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
      const flip =
        shiftedGex[i - 1].strike +
        ratio * (shiftedGex[i].strike - shiftedGex[i - 1].strike);
      if (
        shiftedFlip == null ||
        Math.abs(flip - newSpot) < Math.abs(shiftedFlip - newSpot)
      ) {
        shiftedFlip = flip;
      }
    }
  }

  let shiftedCallWall: number | null = null;
  let maxCallGex = 0;
  let shiftedPutWall: number | null = null;
  let maxPutGex = 0;
  for (const point of shiftedGex) {
    if (point.callGex > maxCallGex) {
      maxCallGex = point.callGex;
      shiftedCallWall = point.strike;
    }
    if (Math.abs(point.putGex) > maxPutGex) {
      maxPutGex = Math.abs(point.putGex);
      shiftedPutWall = point.strike;
    }
  }

  // Hedge flow: use BS delta at base and shifted spot to compute delta change
  let hedgeFlowEstimate: number | null = null;
  if (spot > 0 && T > 0) {
    let totalDeltaShift = 0;
    for (const chain of chains) {
      const callOI = chain.call?.oi ?? 0;
      const putOI = chain.put?.oi ?? 0;
      const callIV = chain.call?.iv ?? 0;
      const putIV = chain.put?.iv ?? 0;
      const iv =
        callIV > 0 && putIV > 0
          ? (callIV + putIV) / 2
          : callIV > 0
            ? callIV
            : putIV;
      if (iv <= 0) continue;

      const shiftedIV = iv * (1 + input.deltaIVPct / 100);
      if (shiftedIV <= 0) continue;

      const bsBase = blackScholes({
        spot,
        strike: chain.strike,
        timeToExpiry: bsParams.daysToExpiry / 365,
        riskFreeRate: r,
        iv,
        dividendYield: q,
      });
      const bsShifted = blackScholes({
        spot: newSpot,
        strike: chain.strike,
        timeToExpiry: T,
        riskFreeRate: r,
        iv: shiftedIV,
        dividendYield: q,
      });

      const callDeltaChange = bsShifted.delta.call - bsBase.delta.call;
      const putDeltaChange = bsShifted.delta.put - bsBase.delta.put;
      totalDeltaShift +=
        (callOI * callDeltaChange + putOI * putDeltaChange) * multiplier;
    }
    hedgeFlowEstimate = -totalDeltaShift * spot;
  }

  return {
    shiftedGex,
    shiftedFlip,
    shiftedCallWall,
    shiftedPutWall,
    hedgeFlowEstimate,
  };
}
