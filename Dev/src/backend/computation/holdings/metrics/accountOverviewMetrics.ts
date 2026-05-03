export type AccountOverviewMetrics = {
  marketValue: number;
  marginBalance: number;
  absDeltaNotionalDol: number;
  thetaPerDay: number;
  vegaPerVolPoint: number;
  rhoPer1pctRate: number;
  uPnlUp1PctDol: number;
  uPnlDn1PctDol: number;
  beta: number;
  accountValue: number;
  cashInvestments: number;
  costBasis: number;
  dayChangeDollar: number;
  dayChangePercent: number;
  gainLossDollar: number;
  gainLossPercent: number;
  marketValueLong: number;
  marketValueShort: number;
  // Balances API fields (populated by balances overlay)
  dayBuyPower: number;
  settledFunds: number;
  cashBorrowing: number;
  sma: number;
  marginEquity: number;
  equityPercent: number;
  optionRequirement: number;
  mtdInterestOwed: number;
  marginRate: number;
  withdrawable: number;
  securitiesMarketValue: number;
  optionsMarketValue: number;
  optionsLongValue: number;
  optionsShortValue: number;
};

export function computeAccountOverviewMetrics(
  accountTotals: any,
  derived: any,
  account: any,
  perAccountTotals?: any,
): AccountOverviewMetrics {
  const portfolioAgg = derived?.portfolioAgg;

  const marketValue =
    accountTotals?.marketValue ??
    perAccountTotals?.marketValue ??
    perAccountTotals?.liquidationValue ??
    0;
  const marginBalance = account?.marginBalance ?? 0;

  const absDeltaNotionalDol: number =
    portfolioAgg?.totalAbsDeltaNotionalDol ?? 0;
  const vegaPerVolPoint: number = portfolioAgg?.totalVegaPerVolPoint ?? 0;
  const thetaPerDay: number = portfolioAgg?.totalThetaPerDay ?? 0;
  const rhoPer1pctRate: number = portfolioAgg?.totalRhoPer1pctRate ?? 0;
  const uPnlUp1PctDol: number = portfolioAgg?.totalUPnlUp1PctDol ?? 0;
  const uPnlDn1PctDol: number = portfolioAgg?.totalUPnlDn1PctDol ?? 0;

  const accountValue: number = accountTotals?.accountValue ?? 0;
  const marketValueLong: number = accountTotals?.marketValueLong ?? 0;
  const marketValueShort: number =
    accountTotals?.marketValueShort ??
    (marketValueLong > 0 ? marketValueLong - marketValue : 0);

  const beta = portfolioAgg?.portfolioWeightedBetaShort ?? 0;

  return {
    marketValue,
    marginBalance,
    absDeltaNotionalDol,
    thetaPerDay,
    vegaPerVolPoint,
    rhoPer1pctRate,
    uPnlUp1PctDol,
    uPnlDn1PctDol,
    beta,
    accountValue,
    cashInvestments: accountTotals?.cashInvestments ?? 0,
    costBasis: accountTotals?.costBasis ?? perAccountTotals?.costBasis ?? 0,
    dayChangeDollar:
      accountTotals?.dayChangeDollar ?? perAccountTotals?.dayChangeDollar ?? 0,
    dayChangePercent:
      accountTotals?.dayChangePercent ??
      perAccountTotals?.dayChangePercent ??
      0,
    gainLossDollar:
      accountTotals?.gainLossDollar ?? perAccountTotals?.gainLossDollar ?? 0,
    gainLossPercent:
      accountTotals?.gainLossPercent ?? perAccountTotals?.gainLossPercent ?? 0,
    marketValueLong,
    marketValueShort,
    // Balances API fields (defaults; overwritten by balances overlay)
    dayBuyPower: 0,
    settledFunds: 0,
    cashBorrowing: 0,
    sma: 0,
    marginEquity: 0,
    equityPercent: 0,
    optionRequirement: 0,
    mtdInterestOwed: 0,
    marginRate: 0,
    withdrawable: 0,
    securitiesMarketValue: 0,
    optionsMarketValue: 0,
    optionsLongValue: 0,
    optionsShortValue: 0,
  };
}
