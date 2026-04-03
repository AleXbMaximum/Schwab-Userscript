import { blackScholes } from "../math/blackScholes";
import type { OptionsChain } from "shared/types/options";
import type { GexDataPoint } from "./types";

export interface BSGexConfig {
  /** Current underlying price. */
  spot: number;
  /** Annualized risk-free rate as decimal (0.05 = 5%). */
  riskFreeRate: number;
  /** Continuous dividend yield as decimal (default 0). */
  dividendYield?: number;
  /** Calendar days to expiration. */
  daysToExpiry: number;
  /** Contract multiplier (default 100). */
  multiplier?: number;
}

/**
 * Compute GEX using Black-Scholes derived gamma instead of Schwab passthrough.
 *
 * GEX per strike = OI × BS_gamma × S² × multiplier / 100
 *
 * Convention (same as existing computeGex):
 *   - Call GEX > 0 (dealers assumed short calls → long gamma)
 *   - Put GEX < 0 (dealers assumed short puts → short gamma)
 *
 * IV strategy: average of call IV and put IV per strike.
 * No greekBasisScale — BS computes gamma from first principles.
 */
export function computeBSGex(
  chains: OptionsChain[],
  config: BSGexConfig,
): GexDataPoint[] {
  const { spot, riskFreeRate, daysToExpiry, multiplier = 100 } = config;
  const q = config.dividendYield ?? 0;
  const T = daysToExpiry / 365;

  if (T <= 0 || spot <= 0) return [];

  return chains.map((chain) => {
    const strike = chain.strike;

    const callIV = chain.call?.iv ?? 0;
    const putIV = chain.put?.iv ?? 0;
    // Average IV; fall back to whichever side is available
    const iv =
      callIV > 0 && putIV > 0
        ? (callIV + putIV) / 2
        : callIV > 0
          ? callIV
          : putIV;

    if (iv <= 0) {
      return { strike, callGex: 0, putGex: 0, netGex: 0 };
    }

    const bs = blackScholes({
      spot,
      strike,
      timeToExpiry: T,
      riskFreeRate,
      iv,
      dividendYield: q,
    });

    const callOI = chain.call?.oi ?? 0;
    const putOI = chain.put?.oi ?? 0;

    // GEX = OI × gamma × S² × multiplier / 100
    const gexFactor = (bs.gamma * spot * spot * multiplier) / 100;
    const callGex = callOI * gexFactor;
    const putGex = -(putOI * gexFactor);

    return { strike, callGex, putGex, netGex: callGex + putGex };
  });
}
