import type {
  HoldingsResponse,
  HoldingsRow,
  HoldingsRowType,
  HoldingsSecurityType,
  QuoteItem,
} from "./holdings";

export type HoldingsKey = string;
export type UnderlyingKey = string;

export type InstrumentKind = "EQUITY" | "OPTION" | "INDEX" | "CASH" | "OTHER";

/** Locally computed metrics keyed by holdingsKey. */
export type DerivedMetricsRow = {
  holdingsRowType?: HoldingsRowType | null;
  holdingsSecurityType?: HoldingsSecurityType | null;

  underlying?: string | null;
  expDate?: string | null; // YYYY-MM-DD
  dte?: number | null;
  strike?: number | null;
  callPut?: "C" | "P" | null;

  mid?: number | null;
  spreadDol?: number | null;
  spreadPct?: number | null;
  quoteImbalance?: number | null;
  dayRangeDol?: number | null;
  dayRangePct?: number | null;

  deltaShares?: number | null;
  gammaSharesPerDol?: number | null;
  thetaPerDay?: number | null;
  vegaPerVolPoint?: number | null;
  absGammaSharesPerDol?: number | null;
  absVegaPerVolPoint?: number | null;
  rhoPer1pctRate?: number | null;

  marginUsageRatioPct?: number | null;
  deltaSharesPerMargin?: number | null;
  deltaNotionalPerMargin?: number | null;
  thetaPerMargin?: number | null; // theta/margin (signed, can be negative)
  vegaPerMargin?: number | null; // vega/margin (signed, can be negative)
  marginReqDol?: number | null;
  marginReqReason?: string | null;
  marginToUnderlyingNotional?: number | null;

  optDeltaShares?: number | null;

  rowType?: string | null; // 'Option' | 'Equity' | 'Underlying' | ... (best-effort)

  uPnlUp1PctDol?: number | null; // underlying +1% P&L (underlying-agg, distinct from pnl*)
  uPnlDn1PctDol?: number | null; // underlying -1% P&L (underlying-agg, distinct from pnl*)
  convexityDol?: number | null;

  deltaNotionalDol?: number | null;
  pnlUp1PctDol?: number | null; // total P&L if underlying moves +1%
  pnlDn1PctDol?: number | null; // total P&L if underlying moves -1%

  totalGammaByUnderlying?: number | null;
  totalThetaByUnderlying?: number | null;
  totalVegaByUnderlying?: number | null;
  totalRhoByUnderlying?: number | null;
  totalMarginReqByUnderlying?: number | null;
  gammaDensityNearTerm?: number | null; // per-position near-term gamma weight
  gammaDensityWeighted?: number | null; // per-position DTE-weighted gamma
  deltaNotionalConcentrationPct?: number | null;
  vegaConcentrationPct?: number | null;
  carryPerVega?: number | null;
  carryPerGamma?: number | null;
  thetaOnMargin?: number | null; // |theta|/margin (absolute, always positive)
  vegaOnMargin?: number | null; // |vega|/margin (absolute, always positive)
  gammaOnMargin?: number | null; // |gamma|/margin (absolute, always positive)
  carryToStress?: number | null;
};

/** Aggregated metrics keyed by underlying. */
export type UnderlyingAggRow = {
  underlyingKey: UnderlyingKey;
  totalDeltaShares?: number | null;
  totalOptDeltaShares?: number | null;
  totalGammaSharesPerDol?: number | null;
  totalThetaPerDay?: number | null;
  totalVegaPerVolPoint?: number | null;
  totalRhoPer1pctRate?: number | null;
  absGammaSharesPerDol?: number | null;
  absVegaPerVolPoint?: number | null;
  totalMarginReqDol?: number | null;
  nearTermGammaAbs?: number | null; // aggregated from gammaDensityNearTerm
  nearTermGammaWeighted?: number | null; // aggregated from gammaDensityWeighted
  underlyingPrice?: number | null;
  deltaNotionalDol?: number | null;
  deltaNotionalConcentrationPct?: number | null;
  vegaConcentrationPct?: number | null;
  carryPerVega?: number | null;
  carryPerGamma?: number | null;
  thetaOnMargin?: number | null;
  vegaOnMargin?: number | null;
  gammaOnMargin?: number | null;
  deltaSharesPerMargin?: number | null;
  deltaNotionalPerMargin?: number | null;
  thetaPerMargin?: number | null;
  vegaPerMargin?: number | null;
  convexityDol?: number | null;

  totalMarketValue?: number | null;
  totalCostBasis?: number | null;
  totalDayChangeDollar?: number | null;
  totalGainLossDollar?: number | null;
  dayChangePercent?: number | null; // underlying-level day change % (ratio 0-1)
  gainLossPercent?: number | null; // underlying-level gain/loss % (ratio 0-1)

  uPnlUp1PctDol?: number | null;
  uPnlDn1PctDol?: number | null;

  betaUltraShort?: number | null;
  betaWeek?: number | null;
  betaShort?: number | null;
  betaMedium?: number | null;
  betaLong?: number | null;
  betaNotionalDolUltraShort?: number | null;
  betaNotionalDolWeek?: number | null;
  betaNotionalDol?: number | null;
  betaNotionalDolMedium?: number | null;
  betaNotionalDolLong?: number | null;
  betaNotionalConcentrationPct?: number | null;
};

export type PortfolioAgg = {
  netMarketValue?: number | null;
  grossMarketValue?: number | null;
  totalAbsDeltaNotionalDol?: number | null;
  totalAbsVegaPerVolPoint?: number | null;
  totalThetaPerDay?: number | null;
  totalVegaPerVolPoint?: number | null;

  top1ConcentrationPct?: number | null;
  top5ConcentrationPct?: number | null;

  longCount?: number;
  shortCount?: number;
  longMarketValue?: number;
  shortMarketValue?: number;

  optionsRiskSharePct?: number | null; // Options share of risk (by |DeltaShares| or |Mkt Val|)

  totalRhoPer1pctRate?: number | null;
  totalUPnlUp1PctDol?: number | null;
  totalUPnlDn1PctDol?: number | null;
  beta?: number | null;
  portfolioWeightedBetaUltraShort?: number | null;
  portfolioWeightedBetaWeek?: number | null;
  portfolioWeightedBetaShort?: number | null;
  portfolioWeightedBetaMedium?: number | null;
  portfolioWeightedBetaLong?: number | null;
  totalAbsBetaNotionalDol?: number | null;
  totalGammaSharesPerDol?: number | null;
  totalAbsGammaSharesPerDol?: number | null;
  totalMarginReqDol?: number | null;
  totalConvexityDol?: number | null;
};

export type DerivedState = {
  byHoldingsKey: Record<HoldingsKey, DerivedMetricsRow>;
  byUnderlying: Record<UnderlyingKey, UnderlyingAggRow>;
  portfolioAgg?: PortfolioAgg;
  asOfTs: number;
};

export type ChangeToken = {
  rawVersion: number;
  derivedVersion: number;
  touchedHoldingsKeys: string[];
  touchedUnderlyingKeys: string[];
  fullRebuild: boolean;
};

export type WarningLevel = "none" | "info" | "warn" | "critical";

export type WarningRuleScope = "HOLDING" | "UNDERLYING" | "PORTFOLIO";
export type WarningRuleCadence = "stream" | "hourly" | "daily-manual";

export type WarningRuleConfig = {
  id: string;
  name?: string;
  scope: WarningRuleScope;
  cadence?: WarningRuleCadence;

  metric: string;

  warnAbove?: number;
  criticalAbove?: number;
  warnBelow?: number;
  criticalBelow?: number;

  message?: string;
};

export type WarningHit = {
  ruleId: string;
  level: WarningLevel;
  message?: string;
  asOfTs: number;
};

export type WarningCell = {
  level: WarningLevel;
  text: string;
  hits?: WarningHit[];
};

export type WarningState = {
  byHoldingsKey: Record<HoldingsKey, WarningCell>;
  byUnderlying: Record<UnderlyingKey, WarningCell>;
  portfolio: WarningCell;
  asOfTs: number;
};

export type GroupTotals = {
  marketValue: number;
  costBasis: number;
  dayChangeDollar: number;
  dayChangePercent: number | null;
  gainLossDollar: number;
  gainLossPercent: number | null;
  holdingCount: number;

  thetaPerDay: number | null;
  vegaPerVolPoint: number | null;
  rhoPer1pctRate: number | null;
  gammaSharesPerDol: number | null;
  absGammaSharesPerDol: number | null;
  absVegaPerVolPoint: number | null;
  deltaNotionalDol: number | null;
  marginReqDol: number | null;

  pnlUp1PctDol: number | null;
  pnlDn1PctDol: number | null;
  convexityDol: number | null;

  carryPerVega: number | null;
  carryPerGamma: number | null;

  deltaNotionalConcentrationPct: number | null;
  vegaConcentrationPct: number | null;

  percentageOfAccount: number | null;

  priceChangePercent: number | null;
  priceChangeDollar: number | null;
};

export type HoldingsBlock = {
  holdingsKey: string;
  row: HoldingsRow;
  derived: DerivedMetricsRow | null;
  warnings: WarningCell | null;

  kind: InstrumentKind;

  optionMeta: {
    expDate: string;
    strike: number;
    callPut: "C" | "P";
    dte: number;
  } | null;
};

export type TickerBlock = {
  underlyingKey: UnderlyingKey;
  underlyingPrice: number | null;

  aggregated: UnderlyingAggRow;

  equityInfoRow: HoldingsRow | null;

  holdings: HoldingsBlock[];

  assetBadges: {
    hasEquity: boolean;
    buyPut: number;
    sellPut: number;
    buyCall: number;
    sellCall: number;
  };
};

export type AssetClassBlock = {
  groupName: string;
  totals: GroupTotals | null;
  tickers: TickerBlock[];
};

export type HierarchicalHoldings = {
  asOfTs: number;
  assetClasses: AssetClassBlock[];
  grandTotal: GroupTotals;
};

export type HoldingsFrame = {
  holdings: HoldingsResponse | null;
  quotesBySymbol: Record<string, QuoteItem>;

  derived?: DerivedState;
  warnings?: WarningState;
  hierarchy?: HierarchicalHoldings | null;
  changeToken?: ChangeToken | null;
  timestamp: number;
};
