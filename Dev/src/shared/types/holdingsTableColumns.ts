export type HoldingsTableColumnId =
  | "symbol"
  | "name"
  | "price"
  | "bid"
  | "ask"
  | "bidSize"
  | "askSize"
  | "last"
  | "lastSize"
  | "open"
  | "costPerShare"
  | "priceChngPct"
  | "priceChngDol"
  | "dayChngPct"
  | "dayChngDol"
  | "qty"
  | "gainLossDol"
  | "gainLossPct"
  | "marketValue"
  | "pctOfAcct"
  | "marginReq"
  | "ratings"
  | "costBasis"
  | "peRatio"
  | "divYield"
  | "volume"
  | "delta"
  | "gamma"
  | "theta"
  | "vega"
  | "rho"
  | "openInterest"
  | "reinvest"
  | "dayLow"
  | "dayHigh"
  | "close"
  | "mid"
  | "spreadDol"
  | "spreadPct"
  | "quoteImbalance"
  | "dayRangeDol"
  | "dayRangePct"
  | "deltaShares"
  | "gammaSharesPerDol"
  | "absGammaSharesPerDol"
  | "thetaPerDay"
  | "vegaPerVolPoint"
  | "absVegaPerVolPoint"
  | "rhoPer1pctRate"
  | "marginUsageRatioPct"
  | "deltaSharesPerMargin"
  | "deltaNotionalPerMargin"
  | "thetaPerMargin"
  | "vegaPerMargin"
  | "thetaOnMargin"
  | "vegaOnMargin"
  | "gammaOnMargin"
  | "carryPerVega"
  | "carryPerGamma"
  | "carryToStress"
  | "marginReqReason"
  | "marginToUnderlyingNotional"
  | "deltaNotionalDol"
  | "deltaNotionalConcentrationPct"
  | "betaNotionalDol"
  | "betaNotionalConcentrationPct"
  | "vegaConcentrationPct"
  | "gammaDensityNearTerm"
  | "gammaDensityWeighted"
  | "pnlUp1PctDol"
  | "pnlDn1PctDol"
  | "convexityDol"
  | "underlying"
  | "expDate"
  | "dte"
  | "strike"
  | "callPut"
  | "rowType"
  | "priceLow52W"
  | "priceHigh52W"
  | "overnightPrice"
  | "overnightChgDol"
  | "overnightChgPct"
  | "postMarketChg"
  | "postMarketChgPct"
  | "assetType"
  | "exchangeName"
  | "warnings"
  | "afterHoursPrice"
  | "betaSP1D"
  | "betaSP1M"
  | "betaSP6M"
  | "betaSP2Y";

export type HoldingsTableViewMode = {
  id: string;
  name: string;
  isVisible: boolean;
  columnOrder: HoldingsTableColumnId[];
};

export const HOLDINGS_TABLE_COLUMNS: Array<{
  id: HoldingsTableColumnId;
  label: string;
}> = [
  { id: "symbol", label: "Symbol" },
  { id: "name", label: "Name" },
  { id: "price", label: "Price" },
  { id: "bid", label: "Bid" },
  { id: "ask", label: "Ask" },
  { id: "bidSize", label: "Bid Size" },
  { id: "askSize", label: "Ask Size" },
  { id: "last", label: "Last" },
  { id: "lastSize", label: "Last Size" },
  { id: "open", label: "Open" },
  { id: "costPerShare", label: "Cost/Share" },
  { id: "priceChngPct", label: "Price Chng %" },
  { id: "priceChngDol", label: "Price Chng $" },
  { id: "dayChngPct", label: "Day Chng %" },
  { id: "dayChngDol", label: "Day Chng $" },
  { id: "qty", label: "Qty" },
  { id: "gainLossDol", label: "Gain/Loss $" },
  { id: "gainLossPct", label: "Gain/Loss %" },
  { id: "marketValue", label: "Mkt Val" },
  { id: "pctOfAcct", label: "% of Acct" },
  { id: "marginReq", label: "Margin $" },
  { id: "ratings", label: "Ratings" },
  { id: "costBasis", label: "Cost Basis" },
  { id: "peRatio", label: "P/E Ratio" },
  { id: "divYield", label: "Div Yld" },
  { id: "volume", label: "Volume" },
  { id: "delta", label: "Delta" },
  { id: "gamma", label: "Gamma" },
  { id: "theta", label: "Theta" },
  { id: "vega", label: "Vega" },
  { id: "rho", label: "Rho" },
  { id: "openInterest", label: "Open Int" },
  { id: "reinvest", label: "Reinvest?" },
  { id: "dayLow", label: "Day Low" },
  { id: "dayHigh", label: "Day High" },
  { id: "close", label: "Close" },

  { id: "mid", label: "Mid" },
  { id: "spreadDol", label: "Spread $" },
  { id: "spreadPct", label: "Spread %" },
  { id: "quoteImbalance", label: "Quote Imb" },
  { id: "dayRangeDol", label: "Day Range $" },
  { id: "dayRangePct", label: "Day Range %" },
  { id: "deltaShares", label: "Delta Sh" },
  { id: "gammaSharesPerDol", label: "Gamma Sh/$" },
  { id: "absGammaSharesPerDol", label: "Abs Gamma Sh/$" },
  { id: "thetaPerDay", label: "Theta/Day" },
  { id: "vegaPerVolPoint", label: "Vega/Vol" },
  { id: "absVegaPerVolPoint", label: "Abs Vega/Vol" },
  { id: "rhoPer1pctRate", label: "Rho/1%" },
  { id: "marginUsageRatioPct", label: "Margin %MV" },
  { id: "deltaSharesPerMargin", label: "Delta Sh/M" },
  { id: "deltaNotionalPerMargin", label: "Delta$/M" },
  { id: "thetaPerMargin", label: "Theta/M" },
  { id: "vegaPerMargin", label: "Vega/M" },
  { id: "thetaOnMargin", label: "TOM" },
  { id: "vegaOnMargin", label: "VOM" },
  { id: "gammaOnMargin", label: "GOM" },
  { id: "carryPerVega", label: "Carry/Vega" },
  { id: "carryPerGamma", label: "Carry/Gamma" },
  { id: "carryToStress", label: "CTS" },
  { id: "marginReqReason", label: "Margin Reason" },
  { id: "marginToUnderlyingNotional", label: "Margin %Notl" },
  { id: "deltaNotionalDol", label: "Delta $" },
  { id: "deltaNotionalConcentrationPct", label: "Delta Conc %" },
  { id: "betaNotionalDol", label: "Beta $" },
  { id: "betaNotionalConcentrationPct", label: "Beta Conc %" },
  { id: "vegaConcentrationPct", label: "Vega Conc %" },
  { id: "gammaDensityNearTerm", label: "Gamma Dens" },
  { id: "gammaDensityWeighted", label: "Gamma Dens Wt" },
  { id: "pnlUp1PctDol", label: "Leg PnL +1%" },
  { id: "pnlDn1PctDol", label: "Leg PnL -1%" },
  { id: "convexityDol", label: "Convexity" },
  { id: "underlying", label: "Underlying" },
  { id: "expDate", label: "Exp" },
  { id: "dte", label: "DTE" },
  { id: "strike", label: "Strike" },
  { id: "callPut", label: "C/P" },
  { id: "rowType", label: "Row Type" },
  { id: "priceLow52W", label: "52W Low" },
  { id: "priceHigh52W", label: "52W High" },
  { id: "overnightPrice", label: "ON Price" },
  { id: "overnightChgDol", label: "ON Chg $" },
  { id: "overnightChgPct", label: "ON Chg %" },
  { id: "afterHoursPrice", label: "AH Price" },
  { id: "postMarketChg", label: "AH Chg $" },
  { id: "postMarketChgPct", label: "AH Chg %" },
  { id: "assetType", label: "Asset Type" },
  { id: "exchangeName", label: "Exchange" },
  { id: "warnings", label: "Warnings" },
  { id: "betaSP1D", label: "SPβ1D" },
  { id: "betaSP1M", label: "SPβ1M" },
  { id: "betaSP6M", label: "SPβ6M" },
  { id: "betaSP2Y", label: "SPβ2Y" },
];

const ALL_HOLDINGS_TABLE_COLUMN_IDS = new Set<HoldingsTableColumnId>(
  HOLDINGS_TABLE_COLUMNS.map((c) => c.id),
);

export const DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER: HoldingsTableColumnId[] = [
  "symbol",
  "name",
  "price",
  "bid",
  "ask",
  "bidSize",
  "askSize",
  "last",
  "lastSize",
  "open",
  "costPerShare",
  "priceChngPct",
  "priceChngDol",
  "dayChngPct",
  "dayChngDol",
  "qty",
  "gainLossDol",
  "gainLossPct",
  "marketValue",
  "pctOfAcct",
  "marginReq",
  "ratings",
  "costBasis",
  "peRatio",
  "divYield",
  "volume",
  "delta",
  "gamma",
  "theta",
  "vega",
  "rho",
  "openInterest",
  "reinvest",
  "dayLow",
  "dayHigh",
  "close",
];

export function normalizeHoldingsTableColumnOrder(
  order: unknown,
): HoldingsTableColumnId[] {
  const allowed = ALL_HOLDINGS_TABLE_COLUMN_IDS;

  const result: HoldingsTableColumnId[] = [];
  if (Array.isArray(order)) {
    for (const item of order) {
      if (typeof item !== "string") continue;
      const id = item as HoldingsTableColumnId;
      if (!allowed.has(id)) continue;
      if (result.includes(id)) continue;
      result.push(id);
    }
  }

  return result;
}

function safeModeName(name: unknown, fallback: string) {
  if (typeof name !== "string") return fallback;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function safeModeId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeHoldingsTableViewModes(
  modes: unknown,
): HoldingsTableViewMode[] {
  const fallbackOrder = normalizeHoldingsTableColumnOrder(
    DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER,
  );

  const fallback: HoldingsTableViewMode = {
    id: "default",
    name: "Default",
    isVisible: true,
    columnOrder: fallbackOrder,
  };

  if (!Array.isArray(modes) || modes.length === 0) return [fallback];

  const result: HoldingsTableViewMode[] = [];
  const usedIds = new Set<string>();

  for (const item of modes) {
    if (!item || typeof item !== "object") continue;
    const raw = item as any;

    const id = safeModeId(raw.id);
    if (!id) continue;
    if (usedIds.has(id)) continue;
    usedIds.add(id);

    result.push({
      id,
      name: safeModeName(raw.name, id),
      isVisible: raw.isVisible !== false,
      columnOrder: normalizeHoldingsTableColumnOrder(
        raw.columnOrder ?? fallbackOrder,
      ),
    });
  }

  if (result.length === 0) return [fallback];
  return result;
}

export function normalizeHoldingsTableActiveViewModeId(
  activeId: unknown,
  modes: HoldingsTableViewMode[],
): string {
  const fallback = modes[0]?.id ?? "default";
  if (typeof activeId !== "string") return fallback;
  const trimmed = activeId.trim();
  if (!trimmed) return fallback;
  return modes.some((m) => m.id === trimmed) ? trimmed : fallback;
}
