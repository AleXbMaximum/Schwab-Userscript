import type {
  BalanceSheetData,
  CashFlowData,
  FundamentalsData,
  IncomeStatementData,
  InsiderTransaction,
} from "shared/marketDataTypes";
import { gmGet } from "./httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

export type YahooQuoteSummaryResult = {
  fundamentals: FundamentalsData;
  balanceSheet: BalanceSheetData;
  cashFlow: CashFlowData;
  incomeStatement: IncomeStatementData;
  insiderTransactions: InsiderTransaction[];
};

export async function fetchYahooQuoteSummaryAll(
  symbol: string,
): Promise<YahooQuoteSummaryResult> {
  const span = log.span("fetchYahooQuoteSummary", { symbol });
  const modules = [
    "financialData",
    "defaultKeyStatistics",
    "summaryDetail",
    "balanceSheetHistory",
    "cashflowStatementHistory",
    "incomeStatementHistory",
    "insiderTransactions",
  ].join(",");

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const text = await gmGet(url, 45_000);
  const data = JSON.parse(text) as any;
  const r = data?.quoteSummary?.result?.[0] ?? {};

  const fin: any = r.financialData ?? {};
  const stats: any = r.defaultKeyStatistics ?? {};
  const summary: any = r.summaryDetail ?? {};

  const fundamentals: FundamentalsData = {
    peRatio: stats.forwardPE?.raw ?? summary.trailingPE?.raw ?? null,
    forwardPE: stats.forwardPE?.raw ?? null,
    priceToBook: stats.priceToBook?.raw ?? null,
    priceToSales: stats.priceToSalesTrailing12Months?.raw ?? null,
    evToEbitda: stats.enterpriseToEbitda?.raw ?? null,
    revenueGrowthYoy: fin.revenueGrowth?.raw ?? null,
    earningsGrowthYoy: fin.earningsGrowth?.raw ?? null,
    grossMargin: fin.grossMargins?.raw ?? null,
    operatingMargin: fin.operatingMargins?.raw ?? null,
    netMargin: fin.profitMargins?.raw ?? null,
    debtToEquity: fin.debtToEquity?.raw ?? null,
    currentRatio: fin.currentRatio?.raw ?? null,
    freeCashFlow: fin.freeCashflow?.raw ?? null,
    dividendYield: summary.dividendYield?.raw ?? null,
    beta: stats.beta?.raw ?? null,
    marketCap: summary.marketCap?.raw ?? null,
    week52High: summary.fiftyTwoWeekHigh?.raw ?? null,
    week52Low: summary.fiftyTwoWeekLow?.raw ?? null,
    analystTargetPrice: fin.targetMeanPrice?.raw ?? null,
  };

  const bsStatements: any[] =
    r.balanceSheetHistory?.balanceSheetStatements ?? [];
  const balanceSheet: BalanceSheetData = {
    quarters: bsStatements.slice(0, 4).map((q: any) => ({
      date: q.endDate?.fmt ?? "",
      totalAssets: q.totalAssets?.raw ?? null,
      totalLiabilities: q.totalLiab?.raw ?? null,
      totalEquity: q.totalStockholderEquity?.raw ?? null,
      totalDebt: q.longTermDebt?.raw ?? null,
      cash: q.cash?.raw ?? null,
      currentAssets: q.totalCurrentAssets?.raw ?? null,
      currentLiabilities: q.totalCurrentLiabilities?.raw ?? null,
    })),
  };

  const cfStatements: any[] =
    r.cashflowStatementHistory?.cashflowStatements ?? [];
  const cashFlow: CashFlowData = {
    quarters: cfStatements.slice(0, 4).map((q: any) => {
      const opCF: number | null =
        q.totalCashFromOperatingActivities?.raw ??
        q.operatingCashflow?.raw ??
        null;
      const capex: number | null = q.capitalExpenditures?.raw ?? null;
      // Yahoo capital expenditures are already negative, so FCF is additive here.
      const fcf: number | null = opCF != null && capex != null ? opCF + capex : null;
      return {
        date: q.endDate?.fmt ?? "",
        operatingCashFlow: opCF,
        capitalExpenditures: capex,
        freeCashFlow: fcf,
        dividendsPaid: q.dividendsPaid?.raw ?? null,
        netIncome: q.netIncome?.raw ?? null,
      };
    }),
  };

  const isStatements: any[] =
    r.incomeStatementHistory?.incomeStatementHistory ?? [];
  const incomeStatement: IncomeStatementData = {
    quarters: isStatements.slice(0, 4).map((q: any) => ({
      date: q.endDate?.fmt ?? "",
      totalRevenue: q.totalRevenue?.raw ?? null,
      grossProfit: q.grossProfit?.raw ?? null,
      operatingIncome: q.ebit?.raw ?? q.operatingIncome?.raw ?? null,
      netIncome: q.netIncome?.raw ?? null,
      ebitda: q.ebitda?.raw ?? null,
      eps: q.basicEps?.raw ?? null,
    })),
  };

  const txns: any[] = r.insiderTransactions?.transactions ?? [];
  const insiderTransactions: InsiderTransaction[] = txns
    .slice(0, 20)
    .map((t: any) => ({
      name: t.filerName ?? "Unknown",
      relation: t.relation?.longDesc ?? t.relation?.value ?? "",
      transactionDescription: t.transactionText ?? "",
      value: t.value?.raw ?? null,
      shares: t.shares?.raw ?? null,
      date: t.startDate?.fmt ?? "",
      ownership: t.ownership?.longDesc ?? t.ownership?.value ?? "",
    }));

  span.end(
    "ok",
    { symbol, insiderTxCount: insiderTransactions.length },
    "info",
  );
  return {
    fundamentals,
    balanceSheet,
    cashFlow,
    incomeStatement,
    insiderTransactions,
  };
}
