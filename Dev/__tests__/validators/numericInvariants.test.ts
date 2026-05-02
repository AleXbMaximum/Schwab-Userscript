import {
  findInvariantViolations,
  findGreeksViolations,
} from "../../src/backend/computation/validators/numericInvariants";

describe("findInvariantViolations", () => {
  it("returns empty array for valid records", () => {
    const records = [
      { symbol: "AAPL", spot: 180, askPrice: 1.25, sample_size: 30, r_squared: 0.85 },
      { symbol: "MSFT", spot: 410, lastPrice: 2.5 },
    ];
    expect(findInvariantViolations(records)).toEqual([]);
  });

  it("flags non-positive price-like fields", () => {
    const violations = findInvariantViolations([{ askPrice: 0 }, { lastPrice: -1 }]);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatch(/askPrice must be > 0/);
    expect(violations[1]).toMatch(/lastPrice must be > 0/);
  });

  it("flags non-positive spot", () => {
    expect(findInvariantViolations([{ spot: 0 }])).toEqual([
      expect.stringMatching(/spot must be > 0/),
    ]);
  });

  it("flags r_squared outside [0, 1]", () => {
    const violations = findInvariantViolations([
      { r_squared: -0.1 },
      { r_squared: 1.01 },
    ]);
    expect(violations).toHaveLength(2);
  });

  it("flags non-positive sample_size", () => {
    expect(findInvariantViolations([{ sample_size: 0 }])).toEqual([
      expect.stringMatching(/sample_size must be > 0/),
    ]);
  });

  it("flags NaN and Infinity in any numeric field", () => {
    const violations = findInvariantViolations([
      { value: NaN, score: Infinity, rate: -Infinity },
    ]);
    expect(violations).toHaveLength(3);
    violations.forEach((v) => expect(v).toMatch(/is not finite/));
  });

  it("ignores non-numeric fields", () => {
    expect(
      findInvariantViolations([
        { name: "AAPL", askPrice: 1.25, tags: ["a", "b"], meta: { foo: 1 } },
      ]),
    ).toEqual([]);
  });

  it("uses the context label in messages", () => {
    const [violation] = findInvariantViolations([{ askPrice: 0 }], "snapshot");
    expect(violation).toMatch(/^snapshot\[0\]:/);
  });
});

describe("findGreeksViolations", () => {
  it("returns empty array for valid Greeks summaries", () => {
    const records = [
      {
        symbol: "AAPL",
        spot: 180,
        atm_strike: 180,
        atm_iv: 0.25,
        atm_delta: 0.5,
        atm_gamma: 0.02,
        atm_vega: 0.15,
        atm_theta: -0.05,
        chain_size: 30,
      },
    ];
    expect(findGreeksViolations(records)).toEqual([]);
  });

  it("flags atm_delta outside [-1, 1]", () => {
    const violations = findGreeksViolations([
      { atm_delta: -1.5 },
      { atm_delta: 1.2 },
    ]);
    expect(violations).toHaveLength(2);
  });

  it("flags negative gamma and vega", () => {
    const violations = findGreeksViolations([
      { atm_gamma: -0.01, atm_vega: -0.05 },
    ]);
    expect(violations).toHaveLength(2);
  });

  it("flags chain_size <= 0", () => {
    expect(findGreeksViolations([{ chain_size: 0 }])).toEqual([
      expect.stringMatching(/chain_size must be > 0/),
    ]);
  });

  it("flags non-finite numeric fields", () => {
    const violations = findGreeksViolations([
      { atm_iv: NaN, atm_theta: Infinity, spot: 100 },
    ]);
    expect(violations).toHaveLength(2);
  });

  it("tolerates absent fields", () => {
    expect(findGreeksViolations([{ symbol: "AAPL" }])).toEqual([]);
  });
});
