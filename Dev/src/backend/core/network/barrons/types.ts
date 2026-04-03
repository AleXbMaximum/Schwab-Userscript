export type BarronsCompanyDetails = {
  name?: string | null;
  industry?: string | null;
  sector?: string | null;
  fiscalYearEnd?: string | null;
  revenue?: string | null;
  netIncome?: string | null;
  salesGrowth?: string | null;
  employees?: string | null;
  address?: string | null;
  phone?: string | null;
};

export type BarronsRatioTable = Record<string, string>;

export type BarronsFinancialRatios = {
  valuation?: BarronsRatioTable | null;
  profitability?: BarronsRatioTable | null;
  efficiency?: BarronsRatioTable | null;
  capitalization?: BarronsRatioTable | null;
  liquidity?: BarronsRatioTable | null;
};

export type BarronsStatementRow = {
  name: string;
  values: string[];
  rawValues: (number | null)[];
  /** 0=value, 1=growth%, 2=primary */
  type: number;
  level: number;
  isSectionHeader?: boolean;
};

export type BarronsFinancialStatement = {
  columns: string[];
  fiscalYear: string;
  rows: BarronsStatementRow[];
};

export type BarronsAnalystSnapshot = {
  avgRecommendation?: string | null;
  meanRating?: string | null;
  numRatings?: string | null;
  meanTargetPrice?: string | null;
  currentQtrEst?: string | null;
  currentYearEst?: string | null;
  nextFYEst?: string | null;
  lastQtrEPS?: string | null;
  fyReportDate?: string | null;
};

export type BarronsPriceTarget = {
  high?: string | null;
  low?: string | null;
  median?: string | null;
  average?: string | null;
  currentPrice?: string | null;
};

export type BarronsRatingsTableRow = {
  Buy?: number | null;
  Overweight?: number | null;
  Hold?: number | null;
  Underweight?: number | null;
  Sell?: number | null;
  Consensus?: string | null;
};

export type BarronsEstimate = {
  year?: string;
  quarter?: string;
  high?: string | null;
  low?: string | null;
  average?: string | null;
  estimate?: string | null;
  actual?: string | null;
  surprise?: string | null;
  count?: string | null;
};

export type BarronsEstimateTrend = {
  period: string;
  current?: string | null;
  oneMonthAgo?: string | null;
  threeMonthsAgo?: string | null;
};

export type BarronsHolder = {
  name: string;
  shares?: string | null;
  pctOutstanding?: string | null;
  pctAssets?: string | null;
  chgShares?: string | null;
  asOf?: string | null;
};

export type BarronsPeer = {
  name?: string;
  symbol?: string;
  price?: string;
  change?: string;
  changePct?: string;
  marketCap?: string;
};

export type BarronsNewsStory = {
  headline: string;
  summary: string;
  byline: string;
  url: string;
  timestamp: string;
  timestampValue: string;
  provider: string;
  label: string;
};

export type BarronsPerson = {
  name: string;
  title: string;
  age?: string | null;
};

export type BarronsDataBundle = {
  symbol: string;
  companyDetails?: BarronsCompanyDetails | null;
  about?: string | null;
  ratios: BarronsFinancialRatios;
  keyData?: Record<string, string> | null;
  analystSnapshot?: BarronsAnalystSnapshot | null;
  priceTarget?: BarronsPriceTarget | null;
  ratingsTable?: {
    threeMonthsPrior: BarronsRatingsTableRow;
    oneMonthPrior: BarronsRatingsTableRow;
    current: BarronsRatingsTableRow;
  } | null;
  yearlyEstimates?: BarronsEstimate[] | null;
  quarterlyActuals?: BarronsEstimate[] | null;
  quarterlyEstimates?: BarronsEstimate[] | null;
  estimateTrends?: BarronsEstimateTrend[] | null;
  upcomingReports?: { nextQtr?: string; nextYear?: string } | null;
  holders?: {
    mutualFunds: BarronsHolder[];
    institutional: BarronsHolder[];
    individuals: BarronsHolder[];
  } | null;
  people?: {
    executives: BarronsPerson[];
    boardMembers: BarronsPerson[];
  } | null;
  peers?: BarronsPeer[] | null;
  performance?: Record<string, string> | null;
  incomeStatement?: BarronsFinancialStatement | null;
  balanceSheet?: BarronsFinancialStatement | null;
  cashFlowStatement?: BarronsFinancialStatement | null;
  incomeStatementQ?: BarronsFinancialStatement | null;
  balanceSheetQ?: BarronsFinancialStatement | null;
  cashFlowStatementQ?: BarronsFinancialStatement | null;
  news: {
    barrons: BarronsNewsStory[];
    dowJones: BarronsNewsStory[];
    press: BarronsNewsStory[];
  };
  fetchedAt: string;
};
