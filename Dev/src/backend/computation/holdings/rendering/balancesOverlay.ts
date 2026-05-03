import type { AccountOverviewMetrics } from "../metrics/accountOverviewMetrics";
import type { BalancesSnapshot } from "../../../core/network/schwab/endpoints/balances";

/**
 * Overlay balances-API fields onto an AccountOverviewMetrics snapshot.
 * Pure function — no side effects. Returns a new object.
 */
export function applyBalancesOverlay(
  overview: AccountOverviewMetrics,
  balances: BalancesSnapshot | null,
): AccountOverviewMetrics {
  if (!balances) return overview;
  return {
    ...overview,
    dayChangeDollar: balances.dayChangeDollar,
    dayChangePercent: balances.dayChangePercent,
    accountValue: balances.accountValue,
    marketValue: balances.marketValue,
    cashInvestments: balances.cashInvestments,
    marginBalance: balances.marginBalance,
    dayBuyPower: balances.dayBuyPower,
    marginEquity: balances.marginEquity,
    equityPercent: balances.equityPercent,
    optionRequirement: balances.optionRequirement,
    securitiesMarketValue: balances.securitiesMarketValue,
    optionsMarketValue: balances.optionsMarketValue,
    optionsLongValue: balances.optionsLongValue,
    optionsShortValue: balances.optionsShortValue,
    settledFunds: balances.settledFunds,
    cashBorrowing: balances.cashBorrowing,
    sma: balances.sma,
    mtdInterestOwed: balances.mtdInterestOwed,
    marginRate: balances.marginRate,
    withdrawable: balances.withdrawable,
  };
}
