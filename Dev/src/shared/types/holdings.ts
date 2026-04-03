// Shared naming convention: *Pct fields are ratios; priceChng* is price movement, dayChng* is portfolio P&L.

/** Percent fields use ratio semantics. */
export type HoldingsTotals = {
  dayChangeDollar?: number;
  dayChangePercent?: number;
  marketValue?: number;
  liquidationValue?: number;
  gainLossDollar?: number;
  gainLossPercent?: number;
  marketValueLong?: number;
  marketValueShort?: number;

  percentageOfAccount?: number;
  cashInvestments?: number;
  costBasis?: number;
  accountValue?: number;
  totalDayChangeDollar?: number;
  totalDayChangePercent?: number;
  hasAssetGap?: boolean;
  isCostFullyKnown?: boolean;
  isGainLossFullyKnown?: boolean;
  isMarketValueAvailable?: boolean;
  isPriceAvailable?: boolean;
  isCostAvailable?: boolean;
  isPriceChangeAvailable?: boolean;
  isGainLossAvailable?: boolean;
  [key: string]: unknown;
};

export type HoldingsNumberCell = { val?: number; [key: string]: unknown };
export type HoldingsLabelCell = { lbl?: string; [key: string]: unknown };
export type HoldingsBooleanCell = { val?: boolean; [key: string]: unknown };

export type HoldingsPriceCell = {
  price?: number;
  priceDate?: string;
  isPriceItemized?: boolean;
  isUnexpItmPrce?: boolean;
  val?: number;
  [key: string]: unknown;
};

export type HoldingsQtyCell = {
  qty?: number;
  qtyBeforeSplt?: number;
  intraDayQuantity?: number;
  val?: number;
  [key: string]: unknown;
};

export type HoldingsSecurityType = 1 | 2 | 4 | 9 | (number & {});
export type HoldingsRowType = 0 | 3 | 9 | 10 | 11 | (number & {});

export type HoldingsAccountDetail = {
  isGainLoss?: boolean;
  isEditableLots?: boolean;
  isMargin?: boolean;
  nickname?: string;
  groupName?: string;
  role?: string;
  isGreenAccount?: boolean;
  isGreenCustomer?: boolean;
  isCheckered?: boolean;
  isMinilogovisible?: boolean;
  coBrandingOfferDetails?: Record<string, unknown>;
  [key: string]: unknown;
};

export type HoldingsBalances = {
  marginBalance?: number;
  schwabBankSweepFeature?: number;
  sweepMoneyMarketFund?: number;
  sweepCashBalance?: number;
  cashSecuredEquityPut?: number;
  [key: string]: unknown;
};

export type HoldingsSymbol = {
  symbol?: string;
  secGrpCd?: string;
  isEqtOpt?: boolean;
  underlyingSym?: string;
  [key: string]: unknown;
};

/** Cell values are read through `.val` unless the field is label-only. */
export type HoldingsRow = {
  rowType?: HoldingsRowType;
  dataSymbol?: string;
  securityType?: HoldingsSecurityType;
  symbol?: HoldingsSymbol;
  childRows?: HoldingsRow[];

  description?: HoldingsLabelCell;
  price?: HoldingsPriceCell;
  priceChng?: HoldingsNumberCell;
  priceChngPrc?: HoldingsNumberCell;
  dayChange?: HoldingsNumberCell;
  dayChngPerc?: HoldingsNumberCell;
  marketValue?: HoldingsNumberCell;
  pctOfAcct?: HoldingsNumberCell | HoldingsLabelCell;
  volume?: HoldingsNumberCell;
  qty?: HoldingsQtyCell;

  bid?: HoldingsNumberCell;
  ask?: HoldingsNumberCell;
  bidSize?: HoldingsNumberCell;
  askSize?: HoldingsNumberCell;
  closePrice?: HoldingsNumberCell;
  lastPrice?: HoldingsNumberCell;
  lastSize?: HoldingsNumberCell;
  openPrice?: HoldingsNumberCell;
  dayLow?: HoldingsNumberCell;
  dayHigh?: HoldingsNumberCell;

  costBasis?: { [key: string]: unknown };
  gainLoss?: { [key: string]: unknown };
  reinvestDtl?: { [key: string]: unknown };
  marginReq?: HoldingsLabelCell;
  nxtStps?: { [key: string]: unknown };
  canStream?: boolean;

  delta?: { val?: number; [key: string]: unknown };
  gamma?: { val?: number; [key: string]: unknown };
  theta?: { val?: number; [key: string]: unknown };
  vega?: { val?: number; [key: string]: unknown };
  rho?: { val?: number; [key: string]: unknown };
  openInterest?: { val?: number; [key: string]: unknown };
  [key: string]: any;
};

export type HoldingsGroup = {
  groupName?: string;
  securityType?: HoldingsSecurityType;
  positionsCount?: number;
  holdingsRows?: HoldingsRow[];
  totals?: HoldingsTotals;
  [key: string]: unknown;
};

export type HoldingsAccount = {
  accountId?: string;
  accountDetail?: HoldingsAccountDetail;
  balances?: HoldingsBalances;
  totals?: HoldingsTotals;
  groupedPositions?: HoldingsGroup[];
  [key: string]: unknown;
};

export type HoldingsConditionalFootNotes = {
  containsOptions?: boolean;
  hasFractionPairingIn?: boolean;
  [key: string]: unknown;
};

export type HoldingsColumnsMetaField = {
  isOption?: boolean;
  maxLength?: number;
  sampleMaxText?: string;
  [key: string]: unknown;
};

export type HoldingsColumnsMetaData = {
  symbol?: HoldingsColumnsMetaField;
  name?: HoldingsColumnsMetaField;
  marginRequirement?: HoldingsColumnsMetaField;
  quoteSymbols?: string[];
  totalPositionCount?: number;
  [key: string]: unknown;
};

export type HoldingsPrestoAccountSecurityTypeSetting = {
  securityTypeName?: string;
  isCollapsed?: boolean;
  [key: string]: unknown;
};

export type HoldingsPrestoAccountDetail = {
  accountId?: string;
  isCollapsed?: boolean;
  prestoAccountSettings?: HoldingsPrestoAccountSecurityTypeSetting[];
  [key: string]: unknown;
};

export type HoldingsPrestoSortSettings = {
  columnId?: string;
  sortDirection?: number;
  [key: string]: unknown;
};

export type HoldingsPrestoEditViewColumn = {
  id?: string;
  [key: string]: unknown;
};

export type HoldingsPrestoEditViewSettings = {
  groupByCallPut?: boolean;
  groupByStrategy?: boolean;
  groupByUnderlying?: boolean;
  groupedBySecurityType?: boolean;
  viewBy?: string;
  selectedColumns?: HoldingsPrestoEditViewColumn[];
  [key: string]: unknown;
};

export type HoldingsPrestoState = {
  accountDetails?: HoldingsPrestoAccountDetail[];
  sortSettings?: HoldingsPrestoSortSettings;
  isCondensedView?: boolean;
  isShowTransaction?: boolean;
  isSummaryTableCollapsed?: boolean;
  editViewSettings?: HoldingsPrestoEditViewSettings;
  dataVersion?: number;
  isExtendedPricing?: boolean;
  [key: string]: unknown;
};

export type HoldingsPrestoData = {
  holdingsPresto?: HoldingsPrestoState;
  [key: string]: unknown;
};

export type HoldingsResponse = {
  accounts?: HoldingsAccount[];

  accountTotals?: HoldingsTotals;
  conditionalFootNotes?: HoldingsConditionalFootNotes;
  columnsMetaData?: HoldingsColumnsMetaData;
  entitlement?: string;
  clientOms?: string;
  hasThemes?: boolean;
  prestoData?: HoldingsPrestoData;
  isMarketDay?: boolean;
  isGreenCustomer?: boolean;
  [key: string]: unknown;
};

export type QuoteReference = {
  symbol: string;
  assetType?: string;
  companyName?: string;
  exchangeName?: string;
  subAssetType?: string[];
  [key: string]: unknown;
};

/** Percent change fields use ratio semantics. Overnight fields are injected locally. */
export type Quote = {
  lastPrice: number;
  netChange: number;
  netChangePercent: number;
  priceLow52W?: number;
  priceHigh52W?: number;
  bidPrice?: number;
  askPrice?: number;
  bidSize?: number;
  askSize?: number;
  postMarketChange?: number;
  postMarketPercentChange?: number;
  volume?: number;
  quoteDateTime?: string;
  tradeTime?: string;
  // Injected by OvernightBridge from Yahoo overnight streaming data.
  __overnightPrice?: number;
  __overnightChangeDollar?: number;
  __overnightChangePercent?: number;
  __overnightUpdatedAt?: number;
  [key: string]: unknown;
};

/** percentChange uses ratio semantics. */
export type RegularQuote = {
  lastPrice: number;
  lastSize?: number;
  netChange: number;
  percentChange: number;
  tradeTime?: string;
  lastPriceDateTime?: string;
  [key: string]: unknown;
};

export type QuoteItem = {
  reference: QuoteReference;
  quote: Quote;
  regularQuote?: RegularQuote;
  marketType?: string;
  serPdfId?: number | null;
  [key: string]: unknown;
};

export type QuotesResponse = {
  quotes?: QuoteItem[];
  [key: string]: unknown;
};
