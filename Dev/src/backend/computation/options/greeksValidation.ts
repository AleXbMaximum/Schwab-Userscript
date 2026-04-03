import { blackScholes } from "../math/blackScholes";
import type { OptionsChain } from "shared/types/options";

export interface GreeksComparison {
  strike: number;
  schwabGamma: number;
  bsGamma: number;
  gammaDeviation: number; // |schwab - bs| / bs (0–1), NaN if bs is 0
  schwabDelta: { call: number; put: number };
  bsDelta: { call: number; put: number };
  deltaDeviation: { call: number; put: number };
}

/**
 * Compare Schwab-provided Greeks against BS-computed Greeks per strike.
 * Returns only strikes where at least one side has valid Schwab Greeks.
 */
export function validateGreeks(
  chains: OptionsChain[],
  spot: number,
  daysToExpiry: number,
  riskFreeRate: number,
  dividendYield?: number,
): GreeksComparison[] {
  const T = daysToExpiry / 365;
  if (T <= 0 || spot <= 0) return [];

  const q = dividendYield ?? 0;
  const results: GreeksComparison[] = [];

  for (const chain of chains) {
    const callIV = chain.call?.iv ?? 0;
    const putIV = chain.put?.iv ?? 0;
    const iv =
      callIV > 0 && putIV > 0
        ? (callIV + putIV) / 2
        : callIV > 0
          ? callIV
          : putIV;

    // Skip strikes with no IV data
    if (iv <= 0) continue;

    const schwabCallGamma = chain.call?.gamma ?? 0;
    const schwabPutGamma = chain.put?.gamma ?? 0;
    const schwabCallDelta = chain.call?.delta ?? 0;
    const schwabPutDelta = chain.put?.delta ?? 0;

    // Skip if Schwab has no Greeks at all for this strike
    if (
      schwabCallGamma === 0 &&
      schwabPutGamma === 0 &&
      schwabCallDelta === 0 &&
      schwabPutDelta === 0
    ) {
      continue;
    }

    const bs = blackScholes({
      spot,
      strike: chain.strike,
      timeToExpiry: T,
      riskFreeRate,
      iv,
      dividendYield: q,
    });

    // Use the average of Schwab call/put gamma (they should be similar)
    const schwabGamma =
      schwabCallGamma > 0 && schwabPutGamma > 0
        ? (schwabCallGamma + schwabPutGamma) / 2
        : schwabCallGamma > 0
          ? schwabCallGamma
          : schwabPutGamma;

    const gammaDeviation =
      bs.gamma > 0 ? Math.abs(schwabGamma - bs.gamma) / bs.gamma : NaN;

    const callDeltaDev =
      Math.abs(bs.delta.call) > 1e-6
        ? Math.abs(schwabCallDelta - bs.delta.call) / Math.abs(bs.delta.call)
        : 0;
    const putDeltaDev =
      Math.abs(bs.delta.put) > 1e-6
        ? Math.abs(schwabPutDelta - bs.delta.put) / Math.abs(bs.delta.put)
        : 0;

    results.push({
      strike: chain.strike,
      schwabGamma,
      bsGamma: bs.gamma,
      gammaDeviation,
      schwabDelta: { call: schwabCallDelta, put: schwabPutDelta },
      bsDelta: bs.delta,
      deltaDeviation: { call: callDeltaDev, put: putDeltaDev },
    });
  }

  return results;
}

/**
 * Filter comparisons to only anomalous strikes where deviation exceeds threshold.
 * @param threshold - deviation ratio (default 0.10 = 10%)
 */
export function flagAnomalousStrikes(
  comparisons: GreeksComparison[],
  threshold = 0.1,
): GreeksComparison[] {
  return comparisons.filter(
    (c) =>
      !isNaN(c.gammaDeviation) && c.gammaDeviation > threshold,
  );
}
