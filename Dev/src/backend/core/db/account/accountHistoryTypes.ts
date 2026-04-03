export type AccountHistoryPoint = {
  ts: number;
  dayChangeDollar: number;
  dayChangePercent: number;
  gainLossDollar: number;
  gainLossPercent: number;
  marketValue: number;
  marginBalance: number;
  cashInvestments: number;
  costBasis: number;
  absDeltaNotionalDol: number;
  accountValue: number;
  marketValueLong: number;
  marketValueShort: number;
  thetaPerDay: number;
  vegaPerVolPoint: number;
  rhoPer1pctRate: number;
  uPnlUp1PctDol: number;
  uPnlDn1PctDol: number;
  beta: number;
  // Balances API fields
  dayBuyPower: number;
  marginEquity: number;
  equityPercent: number;
  optionRequirement: number;
  securitiesMarketValue: number;
  optionsMarketValue: number;
  settledFunds: number;
};
