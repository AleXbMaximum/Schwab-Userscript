/**
 * Shared helper functions used by multiple options chain computation modules.
 * These are internal to the compute/ directory — not part of the public API.
 */
import type{ OptionsChain, OptionsLeg } from "shared/types/options";
import type {
  GexDataPoint,
  GreeksBasis,
  BSGexParams,
  KeyLevelEntry,
  KeyLevelSource,
  LiquidityGrade,
} from "./types";
import { clamp } from "shared/utils/math/numeric";
import { blackScholes } from "../math/blackScholes";

export function findATMStrike(
  chains: OptionsChain[],
  underlyingPrice: number | null,
): number | null {
  const atm = findATMChain(chains, underlyingPrice);
  return atm ? atm.strike : null;
}

export function findATMChain(
  chains: OptionsChain[],
  underlyingPrice: number | null,
): OptionsChain | null {
  if (!underlyingPrice || chains.length === 0) return null;
  let closest = chains[0];
  let minDiff = Math.abs(chains[0].strike - underlyingPrice);
  for (let i = 1; i < chains.length; i++) {
    const chain = chains[i];
    const diff = Math.abs(chain.strike - underlyingPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closest = chain;
    }
  }
  return closest;
}

function midPrice(leg: OptionsLeg | null | undefined): number | null {
  if (!leg) return null;
  if (leg.bid != null && leg.ask != null && leg.bid > 0 && leg.ask > 0) {
    return (leg.bid + leg.ask) / 2;
  }
  if (leg.mark != null && leg.mark > 0) return leg.mark;
  if (leg.last != null && leg.last > 0) return leg.last;
  return null;
}

export function quoteBasisPrice(
  leg: OptionsLeg | null | undefined,
  basis: GreeksBasis,
): number | null {
  if (!leg) return null;
  if (basis === "mark") return leg.mark ?? midPrice(leg);
  return midPrice(leg);
}

export function greekBasisScale(
  leg: OptionsLeg | null | undefined,
  basis: GreeksBasis,
): number {
  if (!leg) return 1;
  const ref = leg.mark ?? midPrice(leg);
  const basisPx = quoteBasisPrice(leg, basis);
  if (ref == null || basisPx == null || ref <= 0 || basisPx <= 0) return 1;
  return clamp(basisPx / ref, 0.5, 1.5);
}

export function computeGex(
  chains: OptionsChain[],
  multiplier: number,
  underlyingPrice: number | null,
  basis: GreeksBasis = "mid",
  bsFallback?: BSGexParams,
): GexDataPoint[] {
  const spot = underlyingPrice ?? 0;
  const T = bsFallback ? bsFallback.daysToExpiry / 365 : 0;

  return chains.map((chain) => {
    let callGamma = (chain.call?.gamma ?? 0) * greekBasisScale(chain.call, basis);
    let putGamma = (chain.put?.gamma ?? 0) * greekBasisScale(chain.put, basis);

    // BS fallback: when Schwab gamma is missing but IV is available
    if (bsFallback && spot > 0 && T > 0) {
      if (callGamma === 0 && chain.call?.iv && chain.call.iv > 0) {
        callGamma = blackScholes({
          spot,
          strike: chain.strike,
          timeToExpiry: T,
          riskFreeRate: bsFallback.riskFreeRate,
          iv: chain.call.iv,
          dividendYield: bsFallback.dividendYield,
        }).gamma;
      }
      if (putGamma === 0 && chain.put?.iv && chain.put.iv > 0) {
        putGamma = blackScholes({
          spot,
          strike: chain.strike,
          timeToExpiry: T,
          riskFreeRate: bsFallback.riskFreeRate,
          iv: chain.put.iv,
          dividendYield: bsFallback.dividendYield,
        }).gamma;
      }
    }

    const callOI = chain.call?.oi ?? 0;
    const putOI = chain.put?.oi ?? 0;

    const callGex = (callOI * callGamma * spot * spot * multiplier) / 100;
    const putGex = -((putOI * putGamma * spot * spot * multiplier) / 100);
    const netGex = callGex + putGex;

    return { strike: chain.strike, callGex, putGex, netGex };
  });
}

export function isSortedByStrike(data: Array<{ strike: number }>): boolean {
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].strike > data[i].strike) return false;
  }
  return true;
}

export function computeMaxPain(chains: OptionsChain[]): number | null {
  if (chains.length === 0) return null;

  const byStrike = new Map<
    number,
    { strike: number; callOI: number; putOI: number }
  >();
  for (const chain of chains) {
    const row = byStrike.get(chain.strike) ?? {
      strike: chain.strike,
      callOI: 0,
      putOI: 0,
    };
    row.callOI += chain.call?.oi ?? 0;
    row.putOI += chain.put?.oi ?? 0;
    byStrike.set(chain.strike, row);
  }

  const rows = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  if (rows.length === 0) return null;

  const numStrikes = rows.length;
  const suffixPutOI = new Array<number>(numStrikes + 1).fill(0);
  const suffixPutStrikeOI = new Array<number>(numStrikes + 1).fill(0);
  for (let i = numStrikes - 1; i >= 0; i--) {
    suffixPutOI[i] = suffixPutOI[i + 1] + rows[i].putOI;
    suffixPutStrikeOI[i] =
      suffixPutStrikeOI[i + 1] + rows[i].putOI * rows[i].strike;
  }

  let prefixCallOI = 0;
  let prefixCallStrikeOI = 0;
  let minPain = Infinity;
  let maxPainStrike = rows[0].strike;

  for (let i = 0; i < numStrikes; i++) {
    const strike = rows[i].strike;
    const callPain = strike * prefixCallOI - prefixCallStrikeOI;
    const putPain = suffixPutStrikeOI[i + 1] - strike * suffixPutOI[i + 1];
    const totalPain = (callPain + putPain) * 100;

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = strike;
    }

    prefixCallOI += rows[i].callOI;
    prefixCallStrikeOI += rows[i].callOI * strike;
  }

  return maxPainStrike;
}

export function filterChainsAroundATM(
  chains: OptionsChain[],
  underlyingPrice: number | null,
  range: number = 40,
): OptionsChain[] {
  if (!underlyingPrice || chains.length === 0) return chains;
  const lower = underlyingPrice * (1 - range / 100);
  const upper = underlyingPrice * (1 + range / 100);
  return chains.filter((chain) => chain.strike >= lower && chain.strike <= upper);
}

export function pickSpread<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (arr.length - 1));
    result.push(arr[idx]);
  }
  return result;
}

export function spreadPct(
  bid: number | null | undefined,
  ask: number | null | undefined,
): number | null {
  if (bid == null || ask == null || bid <= 0) return null;
  const mid = (bid + ask) / 2;
  return mid > 0 ? (ask - bid) / mid : null;
}

export function gradeFromSpreadPct(pct: number | null): LiquidityGrade {
  if (pct == null) return "F";
  // pct is a ratio 0–1 (e.g. 0.01 = 1%)
  if (pct < 0.01) return "A";
  if (pct < 0.02) return "B";
  if (pct < 0.05) return "C";
  if (pct < 0.10) return "D";
  return "F";
}

export function gradeFromScore(score: number): LiquidityGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function computeForwardPrice(
  spot: number | null,
  rate: number | null,
  divYield: number | null,
  daysUntil: number,
): number | null {
  if (spot == null || spot <= 0) return null;
  const riskFreeRate = (rate ?? 0) / 100;
  const dividendYield = (divYield ?? 0) / 100;
  const yearFraction = daysUntil / 365;
  return spot * Math.exp((riskFreeRate - dividendYield) * yearFraction);
}

export function compute25DeltaRR(chains: OptionsChain[]): number | null {
  let call25: { iv: number; diff: number } | null = null;
  let put25: { iv: number; diff: number } | null = null;

  for (const chain of chains) {
    if (chain.call?.delta != null && chain.call?.iv != null) {
      const diff = Math.abs(chain.call.delta - 0.25);
      if (!call25 || diff < call25.diff) {
        call25 = { iv: chain.call.iv, diff };
      }
    }
    if (chain.put?.delta != null && chain.put?.iv != null) {
      const diff = Math.abs(chain.put.delta - -0.25);
      if (!put25 || diff < put25.diff) {
        put25 = { iv: chain.put.iv, diff };
      }
    }
  }

  if (!call25 || !put25) return null;
  return call25.iv - put25.iv;
}

export function keyLevelEntry(
  id: KeyLevelEntry["id"],
  label: string,
  source: KeyLevelSource,
  value: number | null,
  shiftedValue: number | null,
  shiftedSource: KeyLevelSource | null,
): KeyLevelEntry {
  return { id, label, source, value, shiftedValue, shiftedSource };
}
