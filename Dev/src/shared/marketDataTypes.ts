export type FundamentalsData = {
  peRatio?: number | null;
  forwardPE?: number | null;
  priceToBook?: number | null;
  priceToSales?: number | null;
  evToEbitda?: number | null;
  revenueGrowthYoy?: number | null;
  earningsGrowthYoy?: number | null;
  grossMargin?: number | null;
  operatingMargin?: number | null;
  netMargin?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  freeCashFlow?: number | null;
  dividendYield?: number | null;
  beta?: number | null;
  marketCap?: number | null;
  week52High?: number | null;
  week52Low?: number | null;
  analystTargetPrice?: number | null;
  sector?: string | null;
  industry?: string | null;
};

export type NewsItem = {
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
  url?: string;
};

export type BalanceSheetData = {
  quarters: Array<{
    date: string;
    totalAssets?: number | null;
    totalLiabilities?: number | null;
    totalEquity?: number | null;
    totalDebt?: number | null;
    cash?: number | null;
    currentAssets?: number | null;
    currentLiabilities?: number | null;
  }>;
};

export type CashFlowData = {
  quarters: Array<{
    date: string;
    operatingCashFlow?: number | null;
    capitalExpenditures?: number | null;
    freeCashFlow?: number | null;
    dividendsPaid?: number | null;
    netIncome?: number | null;
  }>;
};

export type IncomeStatementData = {
  quarters: Array<{
    date: string;
    totalRevenue?: number | null;
    grossProfit?: number | null;
    operatingIncome?: number | null;
    netIncome?: number | null;
    ebitda?: number | null;
    eps?: number | null;
  }>;
};

export type InsiderTransaction = {
  name: string;
  relation: string;
  transactionDescription: string;
  value?: number | null;
  shares?: number | null;
  date: string;
  ownership: string;
};
