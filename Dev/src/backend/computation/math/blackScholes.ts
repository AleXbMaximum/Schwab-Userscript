import { normalPDF, normalCDF } from "./normalDist";

export interface BSInput {
  /** S: current underlying price */
  spot: number;
  /** K: option strike price */
  strike: number;
  /** T: years to expiration (DTE / 365) */
  timeToExpiry: number;
  /** r: annualized risk-free rate as decimal (0.05 = 5%) */
  riskFreeRate: number;
  /** σ: annualized implied volatility as decimal (0.30 = 30%) */
  iv: number;
  /** q: continuous dividend yield as decimal (default 0) */
  dividendYield?: number;
}

export interface BSResult {
  callPrice: number;
  putPrice: number;
  delta: { call: number; put: number };
  /** Gamma is the same for call and put under BS. */
  gamma: number;
  /** Theta per calendar day (annual / 365). */
  theta: { call: number; put: number };
  /** Vega per 1% IV move (÷100 applied). */
  vega: number;
  rho: { call: number; put: number };
  d1: number;
  d2: number;
}

/**
 * Black-Scholes-Merton option pricing with continuous dividend yield.
 *
 * Call = S × e^(-qT) × N(d1) - K × e^(-rT) × N(d2)
 * Put  = K × e^(-rT) × N(-d2) - S × e^(-qT) × N(-d1)
 *
 * d1 = [ln(S/K) + (r - q + σ²/2)T] / (σ√T)
 * d2 = d1 - σ√T
 */
export function blackScholes(input: BSInput): BSResult {
  const {
    spot: S,
    strike: K,
    timeToExpiry: T,
    riskFreeRate: r,
    iv: sigma,
  } = input;
  const q = input.dividendYield ?? 0;

  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return zeroResult();

  const sqrtT = Math.sqrt(T);
  const sigmaSqrtT = sigma * sqrtT;

  const d1 =
    (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;

  const eNegQT = Math.exp(-q * T);
  const eNegRT = Math.exp(-r * T);
  const pdfD1 = normalPDF(d1);

  // Prices
  const callPrice = S * eNegQT * normalCDF(d1) - K * eNegRT * normalCDF(d2);
  const putPrice =
    K * eNegRT * normalCDF(-d2) - S * eNegQT * normalCDF(-d1);

  // Greeks
  const gamma = (eNegQT * pdfD1) / (S * sigmaSqrtT);
  const deltaCall = eNegQT * normalCDF(d1);
  const deltaPut = -eNegQT * normalCDF(-d1);

  // Theta (per calendar day = annual / 365)
  const thetaCommon = -(S * eNegQT * pdfD1 * sigma) / (2 * sqrtT);
  const thetaCall =
    (thetaCommon -
      r * K * eNegRT * normalCDF(d2) +
      q * S * eNegQT * normalCDF(d1)) /
    365;
  const thetaPut =
    (thetaCommon +
      r * K * eNegRT * normalCDF(-d2) -
      q * S * eNegQT * normalCDF(-d1)) /
    365;

  // Vega (per 1% IV move = ÷100)
  const vega = (S * eNegQT * pdfD1 * sqrtT) / 100;

  // Rho (per 1% rate change = ÷100)
  const rhoCall = (K * T * eNegRT * normalCDF(d2)) / 100;
  const rhoPut = (-K * T * eNegRT * normalCDF(-d2)) / 100;

  return {
    callPrice,
    putPrice,
    delta: { call: deltaCall, put: deltaPut },
    gamma,
    theta: { call: thetaCall, put: thetaPut },
    vega,
    rho: { call: rhoCall, put: rhoPut },
    d1,
    d2,
  };
}

function zeroResult(): BSResult {
  return {
    callPrice: 0,
    putPrice: 0,
    delta: { call: 0, put: 0 },
    gamma: 0,
    theta: { call: 0, put: 0 },
    vega: 0,
    rho: { call: 0, put: 0 },
    d1: 0,
    d2: 0,
  };
}
