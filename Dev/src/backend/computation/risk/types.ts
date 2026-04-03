import type{ UnderlyingAggRow } from "../../../shared/types/derived";
import type { ThreeFactorBundle, TickerBetaBundle, BetaHorizon } from "../beta/types";

export type ConcentrationItem = {
  underlyingKey: string;
  deltaPct: number;
  marketValuePct: number;
  marginPct: number;
  deltaNotional: number;
  marketValue: number;
  margin: number;
};

export type ScenarioItem = {
  name: string;
  marketMove: number;
  volMove: number;
  expectedPnl: number;
  pnlPct: number;
};

export type ScenarioModelType = "anchor" | "threeFactor";

export type BetaFactorScenarioInput = {
  name: string;
  spxMove: number;
  ndxMove: number;
  djiMove: number;
  volShift: number;
  horizonDays: number;
};

export type BetaFactorPositionPnl = {
  underlyingKey: string;
  predictedReturn: number;
  deltaPnl: number;
  gammaPnl: number;
  vegaPnl: number;
  thetaPnl: number;
  totalPnl: number;
  rSquared: number;
  residualStd: number;
  sampleSize: number;
  modelUsed: "threeFactor" | "anchor" | "none";
  betaMkt: number;
  betaNdxRel: number;
  betaDjiRel: number;
};

export type BetaFactorScenarioResult = {
  name: string;
  input: BetaFactorScenarioInput;
  portfolioPnl: number;
  portfolioPnlPct: number;
  positions: BetaFactorPositionPnl[];
  avgRSquared: number;
  coveredPct: number;
  modelExplainedPct: number;
  coveredCount: number;
  totalCount: number;
  weightedResidualPct: number;
  confidenceLevel: "high" | "medium" | "low";
};

export const PRESET_BETA_FACTOR_SCENARIOS: BetaFactorScenarioInput[] = [
  {
    name: "Growth Rally",
    spxMove: 2.0,
    ndxMove: 3.0,
    djiMove: 1.5,
    volShift: -5,
    horizonDays: 1,
  },
  {
    name: "Tech Melt-Up",
    spxMove: 1.0,
    ndxMove: 4.0,
    djiMove: 0.5,
    volShift: 5,
    horizonDays: 1,
  },
  {
    name: "Cyclical Rotation",
    spxMove: 0.5,
    ndxMove: -1.0,
    djiMove: 2.0,
    volShift: 0,
    horizonDays: 1,
  },
  {
    name: "Broad Risk-Off",
    spxMove: -3.0,
    ndxMove: -4.0,
    djiMove: -2.0,
    volShift: 15,
    horizonDays: 1,
  },
  {
    name: "Black Swan",
    spxMove: -10.0,
    ndxMove: -12.0,
    djiMove: -8.0,
    volShift: 50,
    horizonDays: 1,
  },
];

export type LimitBreach = {
  type: string;
  description: string;
  currentValue: number;
  limitValue: number;
  severity: "info" | "warning" | "critical";
};

export type RiskMetrics = {
  marginUtilizationPct: number;
  currentBeta: number;
  availableMargin: number;
  totalMargin: number;
  usedMargin: number;

  netDeltaShares: number;
  netDeltaDollars: number;
  totalAbsGamma: number;
  totalGammaDollarExposure: number;
  dailyThetaDecay: number;
  totalAbsVega: number;
  totalRho: number;

  marketValue: number;
  grossMarketValue: number;

  topUnderlyingConcentrations: ConcentrationItem[];

  scenarios: ScenarioItem[];
  betaFactorScenarios: BetaFactorScenarioResult[];

  limitBreaches: LimitBreach[];
};

export type BetaFactorDataPayload = {
  threeFactorData?: Map<string, ThreeFactorBundle> | null;
  allBenchmarkBetas?: Map<string, Map<string, TickerBetaBundle>> | null;
  modelType?: ScenarioModelType;
  horizon?: BetaHorizon;
  customScenario?: BetaFactorScenarioInput | null;
};

export type UnderlyingAggRecord = Record<string, UnderlyingAggRow>;
