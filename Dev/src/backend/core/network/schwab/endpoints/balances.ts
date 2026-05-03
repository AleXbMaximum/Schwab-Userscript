import { generateUUID } from "shared/utils/data/uuid";
import { throw401, withTokenRefresh } from "../infra/httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

export type BalancesInvestments = {
  total: number;
  securitiesMarketValue: number;
  optionsMarketValue: number;
  securityLong: { total: number };
  securityShort: { total: number };
  optionsLong: { total: number };
  optionsShort: { total: number };
};

export type BalancesFundsAvailable = {
  tradeFunds: {
    cashInvestments: number;
    settled: number;
    cashBorrowing: number;
    sma: number;
    dayBuyPower: number;
    availableToDayTrade: number;
  };
  withdrawFunds: {
    cashInvestments: number;
    cashBorrowing: number;
  };
};

export type BalancesMarginsInfo = {
  marginEquity: number;
  equityPercent: number;
  mtdInterestOwed: number;
  marginEquityPm: number;
};

export type BalancesOptionDetails = {
  optionRequirement: number;
  optionsApprovalCode: string;
};

export type BalancesMarginInterestRate = {
  interestRate: number;
  baseRate: number;
  hasDiscountedRate: boolean;
};

export type BalancesBrokerageAccount = {
  dayChange: number;
  dayChangePercent: number;
  total: number;
  marketValue: number;
  accountId: string;
  cashInvestments: { total: number; marginBalance: number };
  investments: BalancesInvestments;
  fundsAvailable: BalancesFundsAvailable;
  marginsInfo: BalancesMarginsInfo;
  optionDetails: BalancesOptionDetails;
  marginInterestRate: BalancesMarginInterestRate;
};

export type BalancesApiResponse = {
  brokerageAccountList: BalancesBrokerageAccount[];
  totals: {
    accountValue: number;
    sumOfDayChange: number;
    sumOfDayChangePercent: number;
    cashInvestments: number;
    marketValue: number;
  };
};

export type BalancesSnapshot = {
  ts: number;
  dayChangeDollar: number;
  dayChangePercent: number;
  accountValue: number;
  marketValue: number;
  cashInvestments: number;
  marginBalance: number;
  securitiesMarketValue: number;
  optionsMarketValue: number;
  securityLongValue: number;
  securityShortValue: number;
  optionsLongValue: number;
  optionsShortValue: number;
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
};

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeBalancesSnapshot(raw: BalancesApiResponse): BalancesSnapshot {
  const acct = raw.brokerageAccountList?.[0];
  if (!acct) {
    return emptyBalancesSnapshot();
  }

  const inv = acct.investments;
  const funds = acct.fundsAvailable;
  const margin = acct.marginsInfo;
  const opts = acct.optionDetails;
  const rate = acct.marginInterestRate;

  return {
    ts: Date.now(),
    dayChangeDollar: toNum(acct.dayChange),
    dayChangePercent: toNum(acct.dayChangePercent) / 100,
    accountValue: toNum(acct.total),
    marketValue: toNum(acct.marketValue),
    cashInvestments: toNum(acct.cashInvestments?.total),
    marginBalance: toNum(acct.cashInvestments?.marginBalance),
    securitiesMarketValue: toNum(inv?.securitiesMarketValue),
    optionsMarketValue: toNum(inv?.optionsMarketValue),
    securityLongValue: toNum(inv?.securityLong?.total),
    securityShortValue: toNum(inv?.securityShort?.total),
    optionsLongValue: toNum(inv?.optionsLong?.total),
    optionsShortValue: toNum(inv?.optionsShort?.total),
    dayBuyPower: toNum(funds?.tradeFunds?.dayBuyPower),
    settledFunds: toNum(funds?.tradeFunds?.settled),
    cashBorrowing: toNum(funds?.tradeFunds?.cashBorrowing),
    sma: toNum(funds?.tradeFunds?.sma),
    marginEquity: toNum(margin?.marginEquity),
    equityPercent: toNum(margin?.equityPercent),
    optionRequirement: toNum(opts?.optionRequirement),
    mtdInterestOwed: toNum(margin?.mtdInterestOwed),
    marginRate: toNum(rate?.baseRate),
    withdrawable: toNum(funds?.withdrawFunds?.cashBorrowing),
  };
}

function emptyBalancesSnapshot(): BalancesSnapshot {
  return {
    ts: Date.now(),
    dayChangeDollar: 0,
    dayChangePercent: 0,
    accountValue: 0,
    marketValue: 0,
    cashInvestments: 0,
    marginBalance: 0,
    securitiesMarketValue: 0,
    optionsMarketValue: 0,
    securityLongValue: 0,
    securityShortValue: 0,
    optionsLongValue: 0,
    optionsShortValue: 0,
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
  };
}

export function fetchBalances(
  token: string | null | undefined,
  accountId: string,
): Promise<BalancesSnapshot> {
  const span = log.span("fetchBalances", { accountId });
  const url =
    "https://ausgateway.schwab.com/api/is.Balances/V1/Balances/balances/brokerage?selectionType=S3";

  const doRequest = async (
    bearerToken: string,
  ): Promise<BalancesApiResponse> => {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        correlatorid: generateUUID(),
        "schwab-client-correlid": generateUUID(),
        "schwab-client-ids": accountId,
        "schwab-client-appid": "AD00008376",
        "schwab-clientapp-name": "Balances",
        "schwab-channelcode": "IO",
        "schwab-client-channel": "IO",
        "schwab-env": "DEFAULT",
        "schwab-environment": "PROD",
        "schwab-resource-version": "1",
        pragma: "no-cache",
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<BalancesApiResponse>;
  };

  return withTokenRefresh(doRequest, token)
    .then((raw) => {
      const snapshot = normalizeBalancesSnapshot(raw);
      span.end("ok", { accountValue: snapshot.accountValue }, "debug");
      return snapshot;
    })
    .catch((err) => {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    });
}
