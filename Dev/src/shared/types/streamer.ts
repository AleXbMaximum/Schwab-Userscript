/** Streamer equity payload after numeric field normalization. Percent fields use ratios. */
export type StreamerEquityUpdate = {
  symbol: string;
  // Prices
  lastPrice?: unknown;
  bidPrice?: unknown;
  askPrice?: unknown;
  highPrice?: unknown;
  lowPrice?: unknown;
  closePrice?: unknown;
  openPrice?: unknown;
  mark?: unknown;
  nav?: unknown;
  // Sizes / volume
  bidSize?: unknown;
  askSize?: unknown;
  lastSize?: unknown;
  lastSizeDecimal?: unknown;
  totalVolume?: unknown;
  totalVolumeDecimal?: unknown;
  // IDs / exchange
  bidId?: unknown;
  askId?: unknown;
  lastId?: unknown;
  exchangeId?: unknown;
  exchangeName?: unknown;
  askMicId?: unknown;
  bidMicId?: unknown;
  lastMicId?: unknown;
  // Timestamps
  quoteTimeMs?: unknown;
  tradeTimeMs?: unknown;
  bidTime?: unknown;
  askTime?: unknown;
  regularMarketTradeTimeMs?: unknown;
  // Day change
  netChange?: unknown;
  netPercentChange?: unknown;
  // Mark change
  markChange?: unknown;
  markPercentChange?: unknown;
  // Regular (pre/post-market close) session
  regularMarketQuote?: unknown;
  regularMarketTrade?: unknown;
  regularMarketLastPrice?: unknown;
  regularMarketLastSize?: unknown;
  regularMarketLastSizeDecimal?: unknown;
  regularMarketNetChange?: unknown;
  regularMarketPercentChange?: unknown;
  // Post-market
  postMarketNetChange?: unknown;
  postMarketPercentChange?: unknown;
  // 52-week range
  priceHigh52w?: unknown;
  priceLow52w?: unknown;
  // Fundamental
  peRatio?: unknown;
  dividendAmount?: unknown;
  dividendYield?: unknown;
  dividendDate?: unknown;
  // Hard-to-borrow / shortability
  htbQuantity?: unknown;
  htbRate?: unknown;
  isHardToBorrow?: unknown;
  isShortable?: unknown;
  // Misc
  description?: unknown;
  marginable?: unknown;
  securityStatus?: unknown;
  [key: string]: unknown;
};

/** Streamer option payload after numeric field normalization. Percent fields use ratios. */
export type StreamerOptionUpdate = {
  symbol: string;
  description?: unknown;
  // Prices
  lastPrice?: unknown;
  bidPrice?: unknown;
  askPrice?: unknown;
  highPrice?: unknown;
  lowPrice?: unknown;
  closePrice?: unknown;
  openPrice?: unknown;
  mark?: unknown;
  underlyingPrice?: unknown;
  strikePrice?: unknown;
  theoreticalOptionValue?: unknown;
  moneyIntrinsicValue?: unknown;
  timeValue?: unknown;
  // Sizes / volume
  bidSize?: unknown;
  askSize?: unknown;
  lastSize?: unknown;
  totalVolume?: unknown;
  openInterest?: unknown;
  // Timestamps
  quoteTimeMs?: unknown;
  tradeTimeMs?: unknown;
  lastTradingDay?: unknown;
  // Day change
  netChange?: unknown;
  netPercentChange?: unknown;
  // Mark change
  markChange?: unknown;
  markPercentChange?: unknown;
  // Contract details
  contractType?: unknown;
  multiplier?: unknown;
  digits?: unknown;
  underlying?: unknown;
  deliverables?: unknown;
  settlementType?: unknown;
  uvExpirationType?: unknown;
  exerciseType?: unknown;
  optionRoot?: unknown;
  // Expiration
  expirationYear?: unknown;
  expirationMonth?: unknown;
  expirationDay?: unknown;
  daysToExpiration?: unknown;
  // Greeks / volatility
  delta?: unknown;
  gamma?: unknown;
  theta?: unknown;
  vega?: unknown;
  rho?: unknown;
  volatility?: unknown;
  impliedYield?: unknown;
  // Exchange
  exchange?: unknown;
  exchangeName?: unknown;
  // Misc
  securityStatus?: unknown;
  isPennyPilot?: unknown;
  // Indicative (index options)
  indicativeAskPrice?: unknown;
  indicativeBidPrice?: unknown;
  indicativeQuoteTime?: unknown;
  // 52-week range
  priceHigh52w?: unknown;
  priceLow52w?: unknown;
  [key: string]: unknown;
};

export type StreamerUpdate = StreamerEquityUpdate | StreamerOptionUpdate;

export type StreamerListener = (updates: StreamerUpdate[]) => void;

export interface StreamerLike {
  isConnected: boolean;
  disconnect(): void;
  connect(token: string | null, customerId: string | null): void;
  subscribe(symbols: string[]): void;
  unsubscribe(symbols: string[]): void;
  addListener(listener: StreamerListener): void;
  removeListener(listener: StreamerListener): void;
}
