export type FieldMap = Readonly<Record<string, string>>;

// Schwab LEVELONE_EQUITIES field-id to normalized update key.
export const EQUITY_FIELD_MAP: FieldMap = {
  "0": "symbol",
  "1": "bidPrice",
  "2": "askPrice",
  "3": "lastPrice",
  "4": "bidSize",
  "5": "askSize",
  "6": "askId",
  "7": "bidId",
  "8": "totalVolume",
  "9": "lastSize",
  "10": "highPrice",
  "11": "lowPrice",
  "12": "closePrice",
  "13": "exchangeId",
  "14": "marginable",
  "15": "description",
  "16": "lastId",
  "17": "openPrice",
  "18": "netChange",
  "19": "priceHigh52w",
  "20": "priceLow52w",
  "21": "peRatio",
  "22": "dividendAmount",
  "23": "dividendYield",
  "24": "nav",
  "25": "exchangeName",
  "26": "dividendDate",
  "27": "regularMarketQuote",
  "28": "regularMarketTrade",
  "29": "regularMarketLastPrice",
  "30": "regularMarketLastSize",
  "31": "regularMarketNetChange",
  "32": "securityStatus",
  "33": "mark",
  "34": "quoteTimeMs",
  "35": "tradeTimeMs",
  "36": "regularMarketTradeTimeMs",
  "37": "bidTime",
  "38": "askTime",
  "39": "askMicId",
  "40": "bidMicId",
  "41": "lastMicId",
  "42": "netPercentChange",
  "43": "regularMarketPercentChange",
  "44": "markChange",
  "45": "markPercentChange",
  "46": "htbQuantity",
  "47": "htbRate",
  "48": "isHardToBorrow",
  "49": "isShortable",
  "50": "postMarketNetChange",
  "51": "postMarketPercentChange",
  "52": "lastSizeDecimal",
  "53": "regularMarketLastSizeDecimal",
  "54": "totalVolumeDecimal",
};

// Schwab LEVELONE_OPTIONS field-id to normalized update key.
export const OPTION_FIELD_MAP: FieldMap = {
  "0": "symbol",
  "1": "description",
  "2": "bidPrice",
  "3": "askPrice",
  "4": "lastPrice",
  "5": "highPrice",
  "6": "lowPrice",
  "7": "closePrice",
  "8": "totalVolume",
  "9": "openInterest",
  "10": "volatility",
  "11": "moneyIntrinsicValue",
  "12": "expirationYear",
  "13": "multiplier",
  "14": "digits",
  "15": "openPrice",
  "16": "bidSize",
  "17": "askSize",
  "18": "lastSize",
  "19": "netChange",
  "20": "strikePrice",
  "21": "contractType",
  "22": "underlying",
  "23": "expirationMonth",
  "24": "deliverables",
  "25": "timeValue",
  "26": "expirationDay",
  "27": "daysToExpiration",
  "28": "delta",
  "29": "gamma",
  "30": "theta",
  "31": "vega",
  "32": "rho",
  "33": "securityStatus",
  "34": "theoreticalOptionValue",
  "35": "underlyingPrice",
  "36": "uvExpirationType",
  "37": "mark",
  "38": "quoteTimeMs",
  "39": "tradeTimeMs",
  "40": "exchange",
  "41": "exchangeName",
  "42": "lastTradingDay",
  "43": "settlementType",
  "44": "netPercentChange",
  "45": "markChange",
  "46": "markPercentChange",
  "47": "impliedYield",
  "48": "isPennyPilot",
  "49": "optionRoot",
  "50": "priceHigh52w",
  "51": "priceLow52w",
  "52": "indicativeAskPrice",
  "53": "indicativeBidPrice",
  "54": "indicativeQuoteTime",
  "55": "exerciseType",
};

export const EQUITY_FIELDS =
  "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54";

export const OPTIONS_FIELDS =
  "0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55";

export type StreamerResponse = {
  command?: string;
  service?: string;
  content?: { code?: number; msg?: string };
};
export type StreamerDataGroup = {
  service?: string;
  content?: Array<Record<string, unknown> & { key: string }>;
};
export type StreamerNotify = {
  heartbeat?: unknown;
  content?: { code?: number; msg?: string };
};
export type StreamerMessage = {
  response?: StreamerResponse[];
  data?: StreamerDataGroup[];
  notify?: StreamerNotify[];
};

export type SchwabRequest = {
  service: string;
  requestid: number;
  command: string;
  SchwabClientCustomerId: string | null;
  SchwabClientCorrelId: string | null;
  parameters?: Record<string, unknown>;
};

export type SchwabRequestEnvelope = { requests: SchwabRequest[] };
