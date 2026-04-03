// Fields whose authoritative source is the Quotes API (fetchQuotes).
// Streamer updates for these fields are ignored when a fresh quote is available.
// Each maps to a HoldingsRow cell (shared/types.ts).
const QUOTE_OWNED_FIELDS = [
  "lastPrice", // -> HoldingsRow.lastPrice.val (quote snapshot price)
  "bid", // -> HoldingsRow.bid.val
  "ask", // -> HoldingsRow.ask.val
  "bidSize", // -> HoldingsRow.bidSize.val
  "askSize", // -> HoldingsRow.askSize.val
  "lastSize", // -> HoldingsRow.lastSize.val
] as const;

// Fields whose authoritative source is the Schwab WebSocket streamer.
// These update in real-time and take priority over initial holdings API values.
// Each maps to a HoldingsRow cell (shared/types.ts) or StreamerUpdate property.
const STREAMER_OWNED_FIELDS = [
  "openPrice", // -> HoldingsRow.openPrice.val
  "dayHigh", // -> HoldingsRow.dayHigh.val
  "dayLow", // -> HoldingsRow.dayLow.val
  "closePrice", // -> HoldingsRow.closePrice.val
  "volume", // -> HoldingsRow.volume.val
  "delta", // -> HoldingsRow.delta.val (option Greek, from LEVELONE_OPTIONS)
  "gamma", // -> HoldingsRow.gamma.val (option Greek)
  "theta", // -> HoldingsRow.theta.val (option Greek)
  "vega", // -> HoldingsRow.vega.val (option Greek)
  "rho", // -> HoldingsRow.rho.val (option Greek)
  "openInterest", // -> HoldingsRow.openInterest.val
  "impliedVolatility", // -> StreamerOptionUpdate.impliedVolatility (options only)
  "dividendYield", // -> StreamerEquityUpdate.dividendYield (equities only)
] as const;

export const MARKET_DATA_FIELDS: readonly string[] = [
  ...QUOTE_OWNED_FIELDS,
  ...STREAMER_OWNED_FIELDS,
];
