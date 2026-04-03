/**
 * Expected move (straddle-mid and risk-neutral density),
 * probability cone projections.
 */
import type{ OptionsChain, OptionsExpiration } from "shared/types/options";
import type {
  ExpectedMoveData,
  ExpectedMoveRND,
  ProbabilityConePoint,
  GreeksBasis,
} from "./types";
import { findATMStrike, quoteBasisPrice, pickSpread } from "./chainHelpers";

export function computeExpectedMove(
  chains: OptionsChain[],
  underlyingPrice: number | null,
  daysUntil: number,
  expLabel: string,
  basis: GreeksBasis = "mid",
): ExpectedMoveData {
  const atm = findATMStrike(chains, underlyingPrice);
  if (!atm || !underlyingPrice) {
    return {
      atmStrike: null,
      atmCallPrice: null,
      atmPutPrice: null,
      straddlePrice: null,
      expectedMove: null,
      expectedMovePct: null,
      upperBound1Sigma: null,
      lowerBound1Sigma: null,
      upperBound2Sigma: null,
      lowerBound2Sigma: null,
      daysUntil,
      expLabel,
    };
  }

  const atmChain = chains.find((c) => c.strike === atm);
  const callMark = quoteBasisPrice(atmChain?.call, basis);
  const putMark = quoteBasisPrice(atmChain?.put, basis);

  const straddlePrice =
    callMark != null && putMark != null ? callMark + putMark : null;

  const expectedMove = straddlePrice != null ? 0.85 * straddlePrice : null;
  const expectedMovePct =
    expectedMove != null && underlyingPrice > 0
      ? expectedMove / underlyingPrice
      : null;

  return {
    atmStrike: atm,
    atmCallPrice: callMark,
    atmPutPrice: putMark,
    straddlePrice,
    expectedMove,
    expectedMovePct,
    upperBound1Sigma:
      expectedMove != null ? underlyingPrice + expectedMove : null,
    lowerBound1Sigma:
      expectedMove != null ? underlyingPrice - expectedMove : null,
    upperBound2Sigma:
      expectedMove != null ? underlyingPrice + expectedMove * 2 : null,
    lowerBound2Sigma:
      expectedMove != null ? underlyingPrice - expectedMove * 2 : null,
    daysUntil,
    expLabel,
  };
}

export function computeExpectedMoveRND(
  chains: OptionsChain[],
  underlyingPrice: number | null,
  daysUntil: number,
  rate: number | null,
): ExpectedMoveRND {
  const empty: ExpectedMoveRND = {
    skew: 0,
    kurtosis: 3,
    adjustedMove: null,
    adjustedMovePct: null,
    rndBounds68: null,
    rndBounds95: null,
    modeLabel: "rnd",
  };

  if (!underlyingPrice || chains.length < 5) return empty;

  const sorted = [...chains]
    .filter((c) => c.call?.bid != null && c.call?.ask != null && c.call.bid > 0)
    .sort((a, b) => a.strike - b.strike);

  if (sorted.length < 5) return empty;

  const strikes = sorted.map((c) => c.strike);
  const callMids = sorted.map((c) => (c.call!.bid! + c.call!.ask!) / 2);

  const T = daysUntil / 365;
  const r = rate ?? 0;
  const discountFactor = Math.exp(r * T);

  const density: { k: number; pdf: number }[] = [];
  for (let i = 1; i < strikes.length - 1; i++) {
    const dk1 = strikes[i] - strikes[i - 1];
    const dk2 = strikes[i + 1] - strikes[i];
    const dk = (dk1 + dk2) / 2;
    if (dk <= 0) continue;
    const d2CdK2 =
      (callMids[i + 1] - 2 * callMids[i] + callMids[i - 1]) / (dk * dk);
    const pdf = d2CdK2 * discountFactor;
    if (pdf > 0) {
      density.push({ k: strikes[i], pdf });
    }
  }

  if (density.length < 3) return empty;

  let totalArea = 0;
  for (let i = 0; i < density.length; i++) {
    const dk =
      i < density.length - 1
        ? density[i + 1].k - density[i].k
        : density[i].k - density[i - 1].k;
    totalArea += density[i].pdf * dk;
  }
  if (totalArea <= 0) return empty;

  let mean = 0;
  let variance = 0;
  let m3 = 0;
  let m4 = 0;

  for (let i = 0; i < density.length; i++) {
    const dk =
      i < density.length - 1
        ? density[i + 1].k - density[i].k
        : density[i].k - density[i - 1].k;
    const p = (density[i].pdf / totalArea) * dk;
    mean += density[i].k * p;
  }

  for (let i = 0; i < density.length; i++) {
    const dk =
      i < density.length - 1
        ? density[i + 1].k - density[i].k
        : density[i].k - density[i - 1].k;
    const p = (density[i].pdf / totalArea) * dk;
    const diff = density[i].k - mean;
    variance += diff * diff * p;
    m3 += diff * diff * diff * p;
    m4 += diff * diff * diff * diff * p;
  }

  const sigma = Math.sqrt(variance);
  const skew = sigma > 0 ? m3 / (sigma * sigma * sigma) : 0;
  const kurtosis = sigma > 0 ? m4 / (sigma * sigma * sigma * sigma) : 3;

  const cdf: { k: number; cum: number }[] = [];
  let cumulative = 0;
  for (let i = 0; i < density.length; i++) {
    const dk =
      i < density.length - 1
        ? density[i + 1].k - density[i].k
        : density[i].k - density[i - 1].k;
    cumulative += (density[i].pdf / totalArea) * dk;
    cdf.push({ k: density[i].k, cum: cumulative });
  }

  const findPercentile = (p: number): number => {
    for (let i = 0; i < cdf.length - 1; i++) {
      if (cdf[i].cum <= p && cdf[i + 1].cum > p) {
        const frac = (p - cdf[i].cum) / (cdf[i + 1].cum - cdf[i].cum);
        return cdf[i].k + frac * (cdf[i + 1].k - cdf[i].k);
      }
    }
    return p < 0.5 ? cdf[0].k : cdf[cdf.length - 1].k;
  };

  const lower68 = findPercentile(0.16);
  const upper68 = findPercentile(0.84);
  const lower95 = findPercentile(0.025);
  const upper95 = findPercentile(0.975);

  const adjustedMove = sigma;
  const adjustedMovePct =
    underlyingPrice > 0 ? sigma / underlyingPrice : null;

  return {
    skew,
    kurtosis,
    adjustedMove,
    adjustedMovePct,
    rndBounds68: { lower: lower68, upper: upper68 },
    rndBounds95: { lower: lower95, upper: upper95 },
    modeLabel: "rnd",
  };
}

export function computeProbabilityCone(
  expirations: OptionsExpiration[],
  underlyingPrice: number | null,
  basis: GreeksBasis = "mid",
  maxPoints: number = 10,
): ProbabilityConePoint[] {
  const available = expirations.filter(
    (e) => e.daysUntil > 0 && e.daysUntil <= 365,
  );
  const selected = pickSpread(available, maxPoints);

  const points = selected.map((exp) => {
    const em = computeExpectedMove(
      exp.chains,
      underlyingPrice,
      exp.daysUntil,
      exp.label,
      basis,
    );
    return {
      expLabel: exp.label.split(",")[0],
      daysUntil: exp.daysUntil,
      upper1Sigma: em.upperBound1Sigma,
      lower1Sigma: em.lowerBound1Sigma,
      upper2Sigma: em.upperBound2Sigma,
      lower2Sigma: em.lowerBound2Sigma,
      expectedMove: em.expectedMove,
    };
  });

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (cur.upper1Sigma != null && prev.upper1Sigma != null) {
      cur.upper1Sigma = Math.max(cur.upper1Sigma, prev.upper1Sigma);
    }
    if (cur.lower1Sigma != null && prev.lower1Sigma != null) {
      cur.lower1Sigma = Math.min(cur.lower1Sigma, prev.lower1Sigma);
    }
    if (cur.upper2Sigma != null && prev.upper2Sigma != null) {
      cur.upper2Sigma = Math.max(cur.upper2Sigma, prev.upper2Sigma);
    }
    if (cur.lower2Sigma != null && prev.lower2Sigma != null) {
      cur.lower2Sigma = Math.min(cur.lower2Sigma, prev.lower2Sigma);
    }
  }

  return points;
}

export function computeProbabilityConeRND(
  expirations: OptionsExpiration[],
  underlyingPrice: number | null,
  rate: number | null,
  maxPoints: number = 10,
): ProbabilityConePoint[] {
  const available = expirations.filter(
    (e) => e.daysUntil > 0 && e.daysUntil <= 365,
  );
  const selected = pickSpread(available, maxPoints);

  const points = selected.map((exp) => {
    const rnd = computeExpectedMoveRND(
      exp.chains,
      underlyingPrice,
      exp.daysUntil,
      rate,
    );
    return {
      expLabel: exp.label.split(",")[0],
      daysUntil: exp.daysUntil,
      upper1Sigma: rnd.rndBounds68?.upper ?? null,
      lower1Sigma: rnd.rndBounds68?.lower ?? null,
      upper2Sigma: rnd.rndBounds95?.upper ?? null,
      lower2Sigma: rnd.rndBounds95?.lower ?? null,
      expectedMove: rnd.adjustedMove,
    };
  });

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (cur.upper1Sigma != null && prev.upper1Sigma != null) {
      cur.upper1Sigma = Math.max(cur.upper1Sigma, prev.upper1Sigma);
    }
    if (cur.lower1Sigma != null && prev.lower1Sigma != null) {
      cur.lower1Sigma = Math.min(cur.lower1Sigma, prev.lower1Sigma);
    }
    if (cur.upper2Sigma != null && prev.upper2Sigma != null) {
      cur.upper2Sigma = Math.max(cur.upper2Sigma, prev.upper2Sigma);
    }
    if (cur.lower2Sigma != null && prev.lower2Sigma != null) {
      cur.lower2Sigma = Math.min(cur.lower2Sigma, prev.lower2Sigma);
    }
  }

  return points;
}
