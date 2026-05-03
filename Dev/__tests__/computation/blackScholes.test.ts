import { blackScholes } from "../../src/backend/computation/math/blackScholes";

describe("blackScholes Greeks invariants", () => {
  // Sample a representative range: ITM, ATM, OTM, multiple DTEs and IVs.
  const cases = [
    { spot: 100, strike: 80, dte: 7, iv: 0.2, label: "ITM short-dated" },
    { spot: 100, strike: 100, dte: 30, iv: 0.25, label: "ATM 30d" },
    { spot: 100, strike: 120, dte: 30, iv: 0.4, label: "OTM 30d high IV" },
    { spot: 100, strike: 100, dte: 365, iv: 0.5, label: "ATM 1y" },
    { spot: 100, strike: 100, dte: 1, iv: 0.15, label: "ATM 1d" },
    { spot: 5, strike: 4, dte: 30, iv: 0.6, label: "small-cap ITM" },
  ];

  it.each(cases)("$label produces finite, in-range Greeks", ({ spot, strike, dte, iv }) => {
    const r = blackScholes({
      spot,
      strike,
      timeToExpiry: dte / 365,
      riskFreeRate: 0.045,
      iv,
    });

    // Prices non-negative (allow tiny float noise) and finite
    expect(Number.isFinite(r.callPrice)).toBe(true);
    expect(Number.isFinite(r.putPrice)).toBe(true);
    expect(r.callPrice).toBeGreaterThanOrEqual(-1e-9);
    expect(r.putPrice).toBeGreaterThanOrEqual(-1e-9);

    // Delta bounds
    expect(r.delta.call).toBeGreaterThanOrEqual(0);
    expect(r.delta.call).toBeLessThanOrEqual(1);
    expect(r.delta.put).toBeGreaterThanOrEqual(-1);
    expect(r.delta.put).toBeLessThanOrEqual(0);

    // Gamma & vega non-negative
    expect(r.gamma).toBeGreaterThanOrEqual(0);
    expect(r.vega).toBeGreaterThanOrEqual(0);

    // Theta typically negative for long options; just require finite
    expect(Number.isFinite(r.theta.call)).toBe(true);
    expect(Number.isFinite(r.theta.put)).toBe(true);
  });

  it("put-call parity holds within tolerance", () => {
    const S = 100, K = 100, T = 30 / 365, r = 0.045, q = 0;
    const result = blackScholes({
      spot: S,
      strike: K,
      timeToExpiry: T,
      riskFreeRate: r,
      iv: 0.3,
    });
    // C - P = S*e^(-qT) - K*e^(-rT)
    const lhs = result.callPrice - result.putPrice;
    const rhs = S * Math.exp(-q * T) - K * Math.exp(-r * T);
    expect(Math.abs(lhs - rhs)).toBeLessThan(1e-6);
  });

  it("call-put delta relation holds: deltaCall - deltaPut = e^(-qT)", () => {
    const T = 30 / 365;
    const q = 0;
    const r = blackScholes({
      spot: 100,
      strike: 105,
      timeToExpiry: T,
      riskFreeRate: 0.045,
      iv: 0.3,
      dividendYield: q,
    });
    const expected = Math.exp(-q * T);
    expect(Math.abs(r.delta.call - r.delta.put - expected)).toBeLessThan(1e-9);
  });

  it("zero / negative inputs return zero result without NaN", () => {
    const r = blackScholes({
      spot: 0,
      strike: 100,
      timeToExpiry: 0.25,
      riskFreeRate: 0.045,
      iv: 0.3,
    });
    expect(r.callPrice).toBe(0);
    expect(r.gamma).toBe(0);
    expect(Number.isFinite(r.delta.call)).toBe(true);
  });

});
