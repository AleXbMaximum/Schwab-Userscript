export const BETA_BENCHMARKS = ["$SPX", "$COMPX", "$DJI"] as const;
export type BetaBenchmarkSymbol = (typeof BETA_BENCHMARKS)[number];

export type BetaHorizon = "ultraShort" | "week" | "short" | "medium" | "long";

export type BetaResult = {
  beta: number;
  correlation: number;
  alpha: number;
  rSquared: number;
  sampleSize: number;
  horizon: BetaHorizon;
  computedAt: string;
};

export type TickerBetaBundle = {
  symbol: string;
  benchmark: string;
  ultraShort: BetaResult | null;
  week: BetaResult | null;
  short: BetaResult | null;
  medium: BetaResult | null;
  long: BetaResult | null;
  computedAt: string;
};

export type ThreeFactorBetaResult = {
  betaMkt: number;
  betaNdxRel: number;
  betaDjiRel: number;
  alpha: number;
  rSquared: number;
  residualStd: number;
  sampleSize: number;
  horizon: BetaHorizon;
  computedAt: string;
};

export type ThreeFactorBundle = {
  symbol: string;
  ultraShort: ThreeFactorBetaResult | null;
  week: ThreeFactorBetaResult | null;
  short: ThreeFactorBetaResult | null;
  medium: ThreeFactorBetaResult | null;
  long: ThreeFactorBetaResult | null;
  computedAt: string;
};

export type RollingBetaPoint = {
  date: string;
  beta: number;
  correlation: number;
};
export type RollingBetaOptions = {
  minWindowPoints?: number;
  smoothingWindow?: number;
  samplingStep?: number;
  /** Horizon label for the inner computeBeta calls (default: "short"). */
  horizon?: BetaHorizon;
};
