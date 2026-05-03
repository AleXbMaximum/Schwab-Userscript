import { blackScholes } from "./blackScholes";

/**
 * Newton-Raphson solver: market price → implied volatility.
 *
 * Initial guess uses the Brenner-Subrahmanyam approximation:
 *   σ₀ ≈ √(2π / T) × (price / spot)
 * which converges faster than a flat 0.3 guess for OTM options.
 *
 * @param spot          - underlying price
 * @param strike        - option strike
 * @param timeToExpiry  - years to expiration (DTE / 365)
 * @param riskFreeRate  - annualized risk-free rate as decimal
 * @param marketPrice   - observed option mid-price
 * @param isCall        - true for call, false for put
 * @param dividendYield - continuous dividend yield as decimal (default 0)
 * @param maxIter       - iteration cap (default 50)
 * @param tolerance     - convergence threshold (default 1e-6)
 * @returns IV as decimal (e.g. 0.30 for 30%), or null if no convergence
 */
export function impliedVolatility(
  spot: number,
  strike: number,
  timeToExpiry: number,
  riskFreeRate: number,
  marketPrice: number,
  isCall: boolean,
  dividendYield?: number,
  maxIter = 50,
  tolerance = 1e-6,
): number | null {
  if (marketPrice <= 0 || timeToExpiry <= 0 || spot <= 0 || strike <= 0) {
    return null;
  }

  // Brenner-Subrahmanyam initial guess, clamped to [0.05, 3.0]
  let sigma = Math.sqrt((2 * Math.PI) / timeToExpiry) * (marketPrice / spot);
  sigma = Math.max(0.05, Math.min(sigma, 3.0));

  for (let i = 0; i < maxIter; i++) {
    const result = blackScholes({
      spot,
      strike,
      timeToExpiry,
      riskFreeRate,
      iv: sigma,
      dividendYield,
    });
    const modelPrice = isCall ? result.callPrice : result.putPrice;
    const diff = modelPrice - marketPrice;

    if (Math.abs(diff) < tolerance) return sigma;

    // Vega in natural units (not per-1%)
    const vegaNatural = result.vega * 100;
    if (vegaNatural < 1e-10) return null;

    sigma -= diff / vegaNatural;

    // Clamp to reasonable range
    if (sigma < 0.001) sigma = 0.001;
    if (sigma > 5.0) sigma = 5.0;
  }

  return null; // did not converge
}
