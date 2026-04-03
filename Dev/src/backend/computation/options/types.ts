export type GexDataPoint = {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
};

export type StrikeOIData = {
  strike: number;
  callOI: number;
  putOI: number;
};

export type StrikeVolumeData = {
  strike: number;
  callVol: number;
  putVol: number;
};

export type IVSkewPoint = {
  strike: number;
  callIV: number | null;
  putIV: number | null;
};

export type TermStructurePoint = {
  label: string;
  daysUntil: number;
  atmCallIV: number | null;
  atmPutIV: number | null;
  avgIV: number | null;
};

export type SummaryMetrics = {
  underlyingPrice: number | null;
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  pcRatioVolume: number | null;
  pcRatioOI: number | null;
  maxPainStrike: number | null;
  atmStrike: number | null;
};

export type VolSurfaceData = {
  strikes: number[];
  expirations: { label: string; daysUntil: number }[];
  matrix: (number | null)[][]; // [expIdx][strikeIdx] = avgIV
};

export type GexAnalytics = {
  data: GexDataPoint[];
  totalNetGex: number;
  grossGex: number;
  flipPoint: number | null;
  isPositiveGamma: boolean;
  callWallStrike: number | null;
  putWallStrike: number | null;
  gammaPivot: string;
  topContributors: GexContributor[];
};

export type GexContributor = {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
};

export type ExpectedMoveMode = "straddle" | "rnd";

export type ExpectedMoveData = {
  atmStrike: number | null;
  atmCallPrice: number | null;
  atmPutPrice: number | null;
  straddlePrice: number | null;
  expectedMove: number | null;
  expectedMovePct: number | null;
  upperBound1Sigma: number | null;
  lowerBound1Sigma: number | null;
  upperBound2Sigma: number | null;
  lowerBound2Sigma: number | null;
  daysUntil: number;
  expLabel: string;
};

export type ProbabilityConePoint = {
  expLabel: string;
  daysUntil: number;
  upper1Sigma: number | null;
  lower1Sigma: number | null;
  upper2Sigma: number | null;
  lower2Sigma: number | null;
  expectedMove: number | null;
};

export type OptionsWallData = {
  maxPainStrike: number | null;
  callWallStrike: number | null;
  callWallOI: number;
  putWallStrike: number | null;
  putWallOI: number;
  oiByStrike: StrikeOIData[];
  gammaFlipPoint: number | null;
  underlyingPrice: number | null;
  forward: number | null;
  minIVStrike: number | null;
};

export type GreeksExposurePoint = {
  strike: number;
  callVal: number;
  putVal: number;
  netVal: number;
};

export type GreeksExposureData = {
  delta: GreeksExposurePoint[];
  theta: GreeksExposurePoint[];
  vega: GreeksExposurePoint[];
  gamma: GreeksExposurePoint[];
  vanna: GreeksExposurePoint[];
  charm: GreeksExposurePoint[];
};

export type IVSmileLine = {
  label: string;
  daysUntil: number;
  points: { strike: number; iv: number | null }[];
};

export type PCSkewPoint = {
  strike: number;
  skew: number | null;
};

export type CumulativeGexPoint = {
  strike: number;
  cumPos: number;
  cumNeg: number;
};

export type ActivitySurfaceData = {
  strikes: number[];
  expirations: { label: string; daysUntil: number }[];
  volMatrix: (number | null)[][];
  oiMatrix: (number | null)[][];
  ratioMatrix: (number | null)[][];
  callVolMatrix: (number | null)[][];
  putVolMatrix: (number | null)[][];
  callOiMatrix: (number | null)[][];
  putOiMatrix: (number | null)[][];
};

export type SpreadPoint = {
  strike: number;
  callSpread: number | null;
  putSpread: number | null;
};

export type PricingPoint = {
  strike: number;
  callBid: number | null;
  callAsk: number | null;
  callMark: number | null;
  callLast: number | null;
  callOI: number | null;
  callVol: number | null;
  callTheo: number | null;
  callIntrinsic: number | null;
  callExtrinsic: number | null;
  putBid: number | null;
  putAsk: number | null;
  putMark: number | null;
  putLast: number | null;
  putOI: number | null;
  putVol: number | null;
  putTheo: number | null;
  putIntrinsic: number | null;
  putExtrinsic: number | null;
};

export type TradingInsight = {
  category: "regime" | "direction" | "volatility" | "levels" | "flow";
  signal: "bullish" | "bearish" | "neutral" | "info";
  title: string;
  description: string;
};

export type TradingInsightsData = {
  insights: TradingInsight[];
  overallBias: "bullish" | "bearish" | "neutral";
  biasScore: number;
  keyLevels: {
    putWall: number | null;
    callWall: number | null;
    maxPain: number | null;
    gammaFlip: number | null;
    spot: number | null;
  };
};

export type GreeksBasis = "mid" | "mark";

export type GexGammaSource = "schwab" | "bs";

export type BSGexParams = {
  riskFreeRate: number;
  daysToExpiry: number;
  dividendYield?: number;
};

export type LiquidityGrade = "A" | "B" | "C" | "D" | "F";

export type LiquidityScoreData = {
  overallScore: number; // 0–100
  overallGrade: LiquidityGrade;
  byStrike: LiquidityStrikeData[];
  filteredCount: number;
  totalCount: number;
};

export type LiquidityStrikeData = {
  strike: number;
  callSpreadPct: number | null;
  putSpreadPct: number | null;
  callVolume: number;
  putVolume: number;
  qualityGrade: LiquidityGrade;
};

export type ScenarioInput = {
  deltaSpotPct: number; // ±10%
  deltaIVPct: number; // ±50%
  deltaDays: number; // 0 → DTE
};

export type ScenarioOutput = {
  shiftedGex: GexDataPoint[];
  shiftedFlip: number | null;
  shiftedCallWall: number | null;
  shiftedPutWall: number | null;
  hedgeFlowEstimate: number | null;
};

export type DataQualityReport = {
  zeroOIExpirations: number;
  missingIVPct: number;
  missingQuoteCount: number;
  missingQuotePct: number;
  wideSpreadFilteredCount: number;
  wideSpreadFilteredPct: number;
  interpolatedPointCount: number;
  interpolatedPointPct: number;
  qualityScore: number; // 0-100
  qualityGrade: LiquidityGrade;
  oiTimestamp: string;
  isPreMarket: boolean;
  freshPositionStrikes: number[];
  totalStrikes: number;
};

export type StateVectorData = {
  spot: number | null;
  forward: number | null;
  forwardCarry: { rate: number | null; divYield: number | null };
  selectedExpiry: string;
  dte: number;
  eventFlags: EventFlag[];
  atmIV: number | null;
  skewMetric: number | null; // 25-delta risk reversal
  impliedMove1Sigma: number | null;
  impliedMovePct: number | null;
  netGex: number | null; // $ per 1% move
  gammaFlip: number | null;
  dataTimestamp: string;
  isDelayed: boolean;
};

export type EventFlag = {
  type: "earnings" | "cpi" | "fomc" | "custom";
  label: string;
  daysUntil?: number;
};

export type ExpectedMoveRND = {
  skew: number;
  kurtosis: number;
  adjustedMove: number | null;
  adjustedMovePct: number | null;
  rndBounds68: { lower: number; upper: number } | null;
  rndBounds95: { lower: number; upper: number } | null;
  modeLabel: "straddle" | "rnd";
};

export type KeyLevelId = "putWall" | "flip" | "maxPain" | "callWall";
export type KeyLevelSource = "OI" | "GEX" | "Model";

export type KeyLevelEntry = {
  id: KeyLevelId;
  label: string;
  source: KeyLevelSource;
  value: number | null;
  shiftedValue: number | null;
  shiftedSource: KeyLevelSource | null;
};

export type KeyLevelsLadderData = {
  spot: number | null;
  entries: KeyLevelEntry[];
};

export type VolSurfaceDiagnostics = {
  calendarViolations: CalendarViolation[];
  butterflyViolations: ButterflyViolation[];
  missingPointPct: number;
  totalPoints: number;
  filledPoints: number;
  interpolationMethod: string;
};

export type CalendarViolation = {
  strike: number;
  exp1: string;
  exp2: string;
  iv1: number;
  iv2: number;
};

export type ButterflyViolation = {
  strike: number;
  exp: string;
  detail: string;
};

export type FormulaDefinition = {
  title: string;
  formula: string;
  description: string;
  variables?: Record<string, string>;
};
