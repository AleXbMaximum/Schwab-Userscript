import type { AccountHistoryPoint } from "../../core/db/account/accountHistoryTypes";
import type { AccountOverviewMetrics } from "../../computation/holdings/accountOverviewMetrics";

export function toNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function normalizeHistoryPoint(point: any): AccountHistoryPoint {
  return {
    ts: toNumber(point?.ts),
    dayChangeDollar: toNumber(point?.dayChangeDollar),
    dayChangePercent: toNumber(point?.dayChangePercent),
    gainLossDollar: toNumber(point?.gainLossDollar),
    gainLossPercent: toNumber(point?.gainLossPercent),
    marketValue: toNumber(point?.marketValue),
    marginBalance: toNumber(point?.marginBalance),
    cashInvestments: toNumber(point?.cashInvestments),
    costBasis: toNumber(point?.costBasis),
    absDeltaNotionalDol: toNumber(point?.absDeltaNotionalDol),
    accountValue: toNumber(point?.accountValue),
    marketValueLong: toNumber(point?.marketValueLong),
    marketValueShort: toNumber(point?.marketValueShort),
    thetaPerDay: toNumber(point?.thetaPerDay),
    vegaPerVolPoint: toNumber(point?.vegaPerVolPoint),
    rhoPer1pctRate: toNumber(point?.rhoPer1pctRate),
    uPnlUp1PctDol: toNumber(point?.uPnlUp1PctDol),
    uPnlDn1PctDol: toNumber(point?.uPnlDn1PctDol),
    beta: toNumber(point?.beta),
    dayBuyPower: toNumber(point?.dayBuyPower),
    marginEquity: toNumber(point?.marginEquity),
    equityPercent: toNumber(point?.equityPercent),
    optionRequirement: toNumber(point?.optionRequirement),
    securitiesMarketValue: toNumber(point?.securitiesMarketValue),
    optionsMarketValue: toNumber(point?.optionsMarketValue),
    settledFunds: toNumber(point?.settledFunds),
  };
}

export function buildPoint(
  overview: AccountOverviewMetrics,
  ts: number,
): AccountHistoryPoint {
  return {
    ts,
    dayChangeDollar: toNumber(overview.dayChangeDollar),
    dayChangePercent: toNumber(overview.dayChangePercent),
    gainLossDollar: toNumber(overview.gainLossDollar),
    gainLossPercent: toNumber(overview.gainLossPercent),
    marketValue: toNumber(overview.marketValue),
    marginBalance: toNumber(overview.marginBalance),
    cashInvestments: toNumber(overview.cashInvestments),
    costBasis: toNumber(overview.costBasis),
    absDeltaNotionalDol: toNumber(overview.absDeltaNotionalDol),
    accountValue: toNumber(overview.accountValue),
    marketValueLong: toNumber(overview.marketValueLong),
    marketValueShort: toNumber(overview.marketValueShort),
    thetaPerDay: toNumber(overview.thetaPerDay),
    vegaPerVolPoint: toNumber(overview.vegaPerVolPoint),
    rhoPer1pctRate: toNumber(overview.rhoPer1pctRate),
    uPnlUp1PctDol: toNumber(overview.uPnlUp1PctDol),
    uPnlDn1PctDol: toNumber(overview.uPnlDn1PctDol),
    beta: toNumber(overview.beta),
    dayBuyPower: toNumber(overview.dayBuyPower),
    marginEquity: toNumber(overview.marginEquity),
    equityPercent: toNumber(overview.equityPercent),
    optionRequirement: toNumber(overview.optionRequirement),
    securitiesMarketValue: toNumber(overview.securitiesMarketValue),
    optionsMarketValue: toNumber(overview.optionsMarketValue),
    settledFunds: toNumber(overview.settledFunds),
  };
}
