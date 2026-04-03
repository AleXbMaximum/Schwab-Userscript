import type{
  HoldingsResponse,
  HoldingsRow,
  QuoteItem,
  QuotesResponse,
} from "../../../shared/types/holdings";
import type { StreamerUpdate } from "backend/core/network/types";
import type { OvernightPriceUpdate } from "backend/core/network/yahoo/overnightStreamer";
import { getHoldingsKey, isOption } from "../../../shared/utils/holdingsKeys";
import type { SymbolMap } from "./HoldingsIndexBuilder";
import { toFiniteNumberOrNullNoSentinel } from "backend/core/network/schwab/parsing/numberParsers";
import { logService } from "../../../shared/log/core/LogService";
import { INDEX_SYMBOLS_SET as INDEX_SYMBOLS } from "../indexSymbols";

const holdFlow = logService.namespace("flow:hold");
const quoteFlow = logService.namespace("flow:quote");
const streamerFlow = logService.namespace("flow:strm");
const overnightFlow = logService.namespace("flow:over");

export type RawDataState = {
  holdings: HoldingsResponse | null;
  quotesBySymbol: Record<string, QuoteItem>;
  lastUpdated: number;
};

export interface StreamerIngestionResult {
  newState: RawDataState;
  touchedHoldingsKeys: Set<string>;
  touchedSymbols: Set<string>;
}

export type StreamerIngestionMode = "full" | "day_change_only" | "disabled";


export function applyHoldings(
  currentState: RawDataState,
  holdings: HoldingsResponse,
): RawDataState {
  if (holdFlow.levelEnabled("debug")) {
    const accounts = (holdings as any)?.accounts ?? [];
    let rowCount = 0;
    for (const acct of accounts) {
      for (const group of acct?.groupedPositions ?? []) {
        rowCount += (group?.holdingsRows ?? []).length;
      }
    }
    holdFlow.debug("apply", () => {
      const sampleRows: Record<string, unknown>[] = [];
      for (const acct of accounts) {
        for (const group of acct?.groupedPositions ?? []) {
          for (const row of group?.holdingsRows ?? []) {
            if (sampleRows.length >= 5) break;
            sampleRows.push({
              sym: row?.symbol?.symbol ?? row?.dataSymbol,
              price: row?.price?.val ?? row?.price?.price,
              bid: row?.bid?.val,
              ask: row?.ask?.val,
              qty: row?.qty?.qty ?? row?.qty?.val,
              dayChg: row?.dayChange?.val,
              dayPct: row?.dayChngPerc?.val,
              mktVal: row?.marketValue?.val,
              costBasis: row?.costBasis?.val,
            });
          }
        }
      }
      return {
        accountCount: accounts.length,
        rowCount,
        hasPrevHoldings: !!currentState.holdings,
        totalsDayChg: (holdings as any)?.accountTotals?.dayChangeDollar,
        totalsDayPct: (holdings as any)?.accountTotals?.dayChangePercent,
        totalsMktVal: (holdings as any)?.accountTotals?.marketValue,
        sampleRows,
      };
    });
  }

  currentState.holdings = holdings;
  currentState.lastUpdated = Date.now();
  return currentState;
}

export function applyQuotes(
  currentState: RawDataState,
  quotes: QuotesResponse,
): RawDataState {
  if (!quotes?.quotes) {
    quoteFlow.debug("apply:skip", { reason: "no quotes data" });
    return currentState;
  }

  const now = Date.now();
  const OVERNIGHT_FRESHNESS_MS = 60_000; // 60s guard window
  let overnightPreserved = 0;
  let indexUpdated = 0;
  let holdingUpdated = 0;

  for (const q of quotes.quotes) {
    const sym = q.reference.symbol;
    const existing = currentState.quotesBySymbol[sym];
    const isIndex = INDEX_SYMBOLS.has(sym);
    // Preserve fresh Yahoo overnight data from being overwritten by stale Schwab quotes
    const overnightTs = existing?.quote?.__overnightUpdatedAt as
      | number
      | undefined;
    if (overnightTs && now - overnightTs < OVERNIGHT_FRESHNESS_MS) {
      const merged = { ...q, quote: { ...q.quote } };
      (merged.quote as any).__overnightPrice = existing!.quote.__overnightPrice;
      (merged.quote as any).__overnightChangeDollar =
        existing!.quote.__overnightChangeDollar;
      (merged.quote as any).__overnightChangePercent =
        existing!.quote.__overnightChangePercent;
      (merged.quote as any).__overnightUpdatedAt = overnightTs;
      currentState.quotesBySymbol[sym] = merged;
      overnightPreserved++;
    } else {
      currentState.quotesBySymbol[sym] = q;
    }
    if (isIndex) indexUpdated++;
    else holdingUpdated++;
  }

  quoteFlow.debug("apply", () => ({
    quoteCount: quotes.quotes!.length,
    indexUpdated,
    holdingUpdated,
    overnightPreserved,
    sampleQuotes: quotes.quotes!.slice(0, 5).map((q) => ({
      sym: q.reference.symbol,
      last: q.quote.lastPrice,
      net: q.quote.netChange,
      netPct: q.quote.netChangePercent,
      bid: q.quote.bidPrice,
      ask: q.quote.askPrice,
      vol: q.quote.volume,
      mktType: q.marketType,
    })),
  }));

  currentState.lastUpdated = Date.now();
  return currentState;
}

export function applyStreamerUpdates(
  currentState: RawDataState,
  updates: StreamerUpdate[],
  symbolMap: SymbolMap,
  mode: StreamerIngestionMode = "full",
): StreamerIngestionResult {
  // In disabled mode, ignore all streamer updates entirely
  if (mode === "disabled") {
    streamerFlow.debug("blocked", { mode, updateCount: updates.length });
    return {
      newState: currentState,
      touchedHoldingsKeys: new Set(),
      touchedSymbols: new Set(),
    };
  }

  const touchedHoldingsKeys = new Set<string>();
  const touchedSymbols = new Set<string>();
  let hasChanges = false;
  let holdingsMatched = 0;
  let holdingsUnmatched = 0;
  let indexMatched = 0;

  for (const update of updates) {
    const symbol = update.symbol;
    touchedSymbols.add(symbol);

    const row = symbolMap.get(symbol);
    if (row) {
      const pk = getHoldingsKey(row);
      if (pk) {
        applyUpdateToRow(row, update, mode);

        touchedHoldingsKeys.add(pk);
        hasChanges = true;
        holdingsMatched++;
      }
    } else if (!INDEX_SYMBOLS.has(symbol)) {
      holdingsUnmatched++;
    }

    if (INDEX_SYMBOLS.has(symbol)) {
      // Mutate index entry in-place (consistent with in-place row mutation above)
      if (!currentState.quotesBySymbol[symbol]) {
        currentState.quotesBySymbol[symbol] = createEmptyQuoteItem(symbol);
      }
      applyUpdateToIndex(currentState.quotesBySymbol[symbol], update, mode);
      hasChanges = true;
      indexMatched++;
    }
  }

  streamerFlow.debug("applied", () => {
    const sampleRows: Record<string, unknown>[] = [];
    let i = 0;
    for (const update of updates) {
      if (i >= 3) break;
      const row = symbolMap.get(update.symbol);
      if (row) {
        sampleRows.push({
          sym: update.symbol,
          price: (row as any).price?.val,
          bid: (row as any).bid?.val,
          ask: (row as any).ask?.val,
          dayChange: (row as any).dayChange?.val,
          marketValue: (row as any).marketValue?.val,
        });
        i++;
      }
    }
    return {
      mode,
      updateCount: updates.length,
      holdingsMatched,
      holdingsUnmatched,
      indexMatched,
      touchedKeys: touchedHoldingsKeys.size,
      hasChanges,
      sampleRows,
    };
  });

  // Mutate in-place: holdings rows and index entries are already updated above
  if (hasChanges) {
    currentState.lastUpdated = Date.now();
  }

  return {
    newState: currentState,
    touchedHoldingsKeys,
    touchedSymbols,
  };
}

// Field names that applyUpdateToRow writes to. Ensure objects exist once per row
// to avoid repeated typeof checks on every streamer tick.
const STREAMER_ROW_FIELDS = [
  "lastPrice",
  "price",
  "priceChng",
  "priceChngPrc",
  "marketValue",
  "dayChange",
  "dayChngPerc",
  "gainLoss",
  "bid",
  "ask",
  "bidSize",
  "askSize",
  "lastSize",
  "openPrice",
  "dayHigh",
  "dayLow",
  "closePrice",
  "volume",
  "openInterest",
  "impliedVolatility",
  "delta",
  "gamma",
  "theta",
  "vega",
  "rho",
  "dividendYield",
  "markPrice",
] as const;

const ROW_FIELDS_INIT = Symbol("fieldsInit");

function ensureRowFieldObjects(row: HoldingsRow): void {
  if ((row as any)[ROW_FIELDS_INIT]) return;
  for (const f of STREAMER_ROW_FIELDS) {
    if (!(row as any)[f] || typeof (row as any)[f] !== "object") {
      (row as any)[f] = {};
    }
  }
  (row as any)[ROW_FIELDS_INIT] = true;
}

function applyUpdateToRow(
  row: HoldingsRow,
  update: StreamerUpdate,
  mode: StreamerIngestionMode,
): void {
  ensureRowFieldObjects(row);

  if (mode === "day_change_only") {
    applyDayChangeOnlyUpdateToRow(row, update);
    return;
  }

  const lastPrice = toFiniteNumberOrNullNoSentinel(update.lastPrice);
  if (lastPrice !== null) {
    (row as any).lastPrice.val = lastPrice;
    (row as any).price.price = lastPrice;
    (row as any).price.val = lastPrice;

    const close = toFiniteNumberOrNullNoSentinel((row as any).closePrice.val);
    const streamerNetChange = toFiniteNumberOrNullNoSentinel(update.netChange);
    const priceChng =
      streamerNetChange ?? (close != null ? lastPrice - close : null);

    if (priceChng !== null) {
      (row as any).priceChng.val = priceChng;
    }

    const streamerPctChange = toFiniteNumberOrNullNoSentinel(
      update.netPercentChange,
    );
    const priceChngPrc =
      streamerPctChange ??
      (close != null && close !== 0 ? (lastPrice - close) / close : null);

    if (priceChngPrc !== null) {
      (row as any).priceChngPrc.val = priceChngPrc;
    }

    const qty = toFiniteNumberOrNullNoSentinel(
      (row as any).qty?.qty ?? (row as any).qty?.val,
    );
    const multiplier = isOption(row) ? 100 : 1;

    if (qty !== null) {
      const newMarketValue = lastPrice * qty * multiplier;
      (row as any).marketValue.val = newMarketValue;

      // Use absolute netChange (or lastPrice - closePrice fallback) to avoid
      // incremental drift that compounds across streamer ticks.
      const streamerNetChange = toFiniteNumberOrNullNoSentinel(update.netChange);
      const effectiveNetChange =
        streamerNetChange ?? (close != null ? lastPrice - close : null);
      if (effectiveNetChange !== null) {
        const newDayChange = effectiveNetChange * qty * multiplier;
        (row as any).dayChange.val = newDayChange;
        const startOfDayMV = newMarketValue - newDayChange;
        if (startOfDayMV !== 0) {
          (row as any).dayChngPerc.val = newDayChange / Math.abs(startOfDayMV);
        }
      }

      const costBasis = toFiniteNumberOrNullNoSentinel(
        (row as any).costBasis?.val,
      );
      if (costBasis !== null) {
        const gainLossDlr = newMarketValue - costBasis;
        (row as any).gainLoss.gainLossDlr = gainLossDlr;
        (row as any).gainLoss.val = gainLossDlr;
        if (costBasis !== 0) {
          (row as any).gainLoss.gainLossPct = gainLossDlr / Math.abs(costBasis);
        }
      }
    }
  }

  const bidPrice = toFiniteNumberOrNullNoSentinel(update.bidPrice);
  if (bidPrice !== null) (row as any).bid.val = bidPrice;
  const askPrice = toFiniteNumberOrNullNoSentinel(update.askPrice);
  if (askPrice !== null) (row as any).ask.val = askPrice;
  const bidSize = toFiniteNumberOrNullNoSentinel(update.bidSize);
  if (bidSize !== null) (row as any).bidSize.val = bidSize;
  const askSize = toFiniteNumberOrNullNoSentinel(update.askSize);
  if (askSize !== null) (row as any).askSize.val = askSize;
  const lastSize = toFiniteNumberOrNullNoSentinel(update.lastSize);
  if (lastSize !== null) (row as any).lastSize.val = lastSize;

  const openPrice = toFiniteNumberOrNullNoSentinel(update.openPrice);
  if (openPrice !== null) (row as any).openPrice.val = openPrice;
  const highPrice = toFiniteNumberOrNullNoSentinel(update.highPrice);
  if (highPrice !== null) (row as any).dayHigh.val = highPrice;
  const lowPrice = toFiniteNumberOrNullNoSentinel(update.lowPrice);
  if (lowPrice !== null) (row as any).dayLow.val = lowPrice;
  const closePrice = toFiniteNumberOrNullNoSentinel(update.closePrice);
  if (closePrice !== null) (row as any).closePrice.val = closePrice;

  const volume = toFiniteNumberOrNullNoSentinel(update.totalVolume);
  if (volume !== null) (row as any).volume.val = volume;

  const openInterest = toFiniteNumberOrNullNoSentinel(update.openInterest);
  if (openInterest !== null) (row as any).openInterest.val = openInterest;
  const impliedVolatility = toFiniteNumberOrNullNoSentinel(
    update.volatility,
  );
  if (impliedVolatility !== null)
    (row as any).impliedVolatility.val = impliedVolatility;
  const delta = toFiniteNumberOrNullNoSentinel(update.delta);
  if (delta !== null) (row as any).delta.val = delta;
  const gamma = toFiniteNumberOrNullNoSentinel(update.gamma);
  if (gamma !== null) (row as any).gamma.val = gamma;
  const theta = toFiniteNumberOrNullNoSentinel(update.theta);
  if (theta !== null) (row as any).theta.val = theta;
  const vega = toFiniteNumberOrNullNoSentinel(update.vega);
  if (vega !== null) (row as any).vega.val = vega;
  const rho = toFiniteNumberOrNullNoSentinel(update.rho);
  if (rho !== null) (row as any).rho.val = rho;

  const dividendYield = toFiniteNumberOrNullNoSentinel(update.dividendYield);
  if (dividendYield !== null) (row as any).dividendYield.val = dividendYield;

  const markPrice = toFiniteNumberOrNullNoSentinel(update.mark);
  if (markPrice !== null) (row as any).markPrice.val = markPrice;
}

function applyDayChangeOnlyUpdateToRow(
  row: HoldingsRow,
  update: StreamerUpdate,
): void {
  // ensureRowFieldObjects already called by applyUpdateToRow
  const qty = toFiniteNumberOrNullNoSentinel(
    (row as any).qty?.qty ?? (row as any).qty?.val,
  );
  const multiplier = isOption(row) ? 100 : 1;

  const lastPrice = toFiniteNumberOrNullNoSentinel(update.lastPrice);
  const streamerNetChange = toFiniteNumberOrNullNoSentinel(update.netChange);
  const close = toFiniteNumberOrNullNoSentinel((row as any).closePrice?.val);
  const effectiveNetChange =
    streamerNetChange ??
    (lastPrice !== null && close !== null ? lastPrice - close : null);

  if (effectiveNetChange !== null && qty !== null) {
    const newDayChange = effectiveNetChange * qty * multiplier;
    (row as any).dayChange.val = newDayChange;

    // Derive dayChngPerc from absolute values when possible
    if (lastPrice !== null) {
      const currentMV = lastPrice * qty * multiplier;
      const startOfDayMV = currentMV - newDayChange;
      if (startOfDayMV !== 0) {
        (row as any).dayChngPerc.val = newDayChange / Math.abs(startOfDayMV);
      }
    }
  }

  // Streamer explicit netPercentChange takes priority over derived value
  const percentChange = toFiniteNumberOrNullNoSentinel(update.netPercentChange);
  if (percentChange !== null) {
    (row as any).dayChngPerc.val = percentChange;
  }
}

function applyUpdateToIndex(
  quoteItem: QuoteItem,
  update: StreamerUpdate,
  mode: StreamerIngestionMode,
): void {
  const quote = quoteItem.quote;

  if (mode !== "day_change_only") {
    const lastPrice = toFiniteNumberOrNullNoSentinel(update.lastPrice);
    if (lastPrice !== null) {
      quote.lastPrice = lastPrice;
    }
  }

  const netChange = toFiniteNumberOrNullNoSentinel(update.netChange);
  if (netChange !== null) {
    quote.netChange = netChange;
  }

  const percentChange = toFiniteNumberOrNullNoSentinel(update.netPercentChange);
  if (percentChange !== null) {
    quote.netChangePercent = percentChange;
  }
}

function createEmptyQuoteItem(symbol: string): QuoteItem {
  return {
    reference: { symbol },
    quote: { lastPrice: 0, netChange: 0, netChangePercent: 0 },
  } as QuoteItem;
}

/**
 * Merge quote data into holdings rows in-place.
 * Returns the set of holdingsKeys that were actually updated by quote data.
 */
export function mergeQuotesIntoHoldingsRows(state: RawDataState): Set<string> {
  const touchedKeys = new Set<string>();

  if (!state.holdings || !state.quotesBySymbol) {
    quoteFlow.debug("mergeIntoRows:skip", {
      hasHoldings: !!state.holdings,
      hasQuotes: !!state.quotesBySymbol,
    });
    return touchedKeys;
  }

  for (const acct of (state.holdings as any).accounts ?? []) {
    for (const group of (acct as any).groupedPositions ?? []) {
      for (const row of (group as any).holdingsRows ?? []) {
        if (mergeQuoteIntoRow(row, state.quotesBySymbol)) {
          const hk = getHoldingsKey(row);
          if (hk) touchedKeys.add(hk);
        }

        for (const child of (row as any).childRows ?? []) {
          if (mergeQuoteIntoRow(child, state.quotesBySymbol)) {
            const ck = getHoldingsKey(child);
            if (ck) touchedKeys.add(ck);
          }
        }
      }
    }
  }

  return touchedKeys;
}

function mergeQuoteIntoRow(
  row: any,
  indices: Record<string, QuoteItem>,
): boolean {
  const symbol: string | undefined = row?.symbol?.symbol || row?.dataSymbol;
  if (!symbol) return false;

  const quoteItem = indices[symbol];
  if (!quoteItem) return false;

  const q = quoteItem.quote;
  if (!q) return false;
  const rq = quoteItem.regularQuote;
  const isAfterHours = quoteItem.marketType === "Closed";
  let changed = false;

  const bidPrice = toFiniteNumberOrNullNoSentinel(q.bidPrice);
  if (bidPrice !== null) {
    if (!row.bid || typeof row.bid !== "object") {
      row.bid = {};
      changed = true;
    }
    if (row.bid.val !== bidPrice) {
      row.bid.val = bidPrice;
      changed = true;
    }
  }
  const askPrice = toFiniteNumberOrNullNoSentinel(q.askPrice);
  if (askPrice !== null) {
    if (!row.ask || typeof row.ask !== "object") {
      row.ask = {};
      changed = true;
    }
    if (row.ask.val !== askPrice) {
      row.ask.val = askPrice;
      changed = true;
    }
  }

  const bidSize = toFiniteNumberOrNullNoSentinel(q.bidSize);
  if (bidSize !== null) {
    if (!row.bidSize || typeof row.bidSize !== "object") {
      row.bidSize = {};
      changed = true;
    }
    if (row.bidSize.val !== bidSize) {
      row.bidSize.val = bidSize;
      changed = true;
    }
  }
  const askSize = toFiniteNumberOrNullNoSentinel(q.askSize);
  if (askSize !== null) {
    if (!row.askSize || typeof row.askSize !== "object") {
      row.askSize = {};
      changed = true;
    }
    if (row.askSize.val !== askSize) {
      row.askSize.val = askSize;
      changed = true;
    }
  }

  const lastPrice = toFiniteNumberOrNullNoSentinel(q.lastPrice);
  if (lastPrice !== null) {
    if (!row.lastPrice || typeof row.lastPrice !== "object") {
      row.lastPrice = {};
      changed = true;
    }
    if (row.lastPrice.val !== lastPrice) {
      row.lastPrice.val = lastPrice;
      changed = true;
    }

    if (!row.price || typeof row.price !== "object") {
      row.price = {};
      changed = true;
    }
    // Source precedence: holdings snapshot > streamer (unconditional write) > REST quotes.
    // Only seed price from quotes if no other source has set it yet.
    // Streamer's applyUpdateToRow writes price unconditionally on every tick.
    if (row.price.price == null) {
      row.price.price = lastPrice;
      changed = true;
    }
    if (row.price.val == null) {
      row.price.val = lastPrice;
      changed = true;
    }
  }

  if (rq) {
    const lastSize = toFiniteNumberOrNullNoSentinel(rq.lastSize);
    if (lastSize !== null) {
      if (!row.lastSize || typeof row.lastSize !== "object") {
        row.lastSize = {};
        changed = true;
      }
      if (row.lastSize.val !== lastSize) {
        row.lastSize.val = lastSize;
        changed = true;
      }
    }
  }

  // After-hours price/priceChng/priceChngPrc override removed:
  // The holdings dual-fetch merge (mergeExtendedHoldingsResponses) is the
  // authoritative source for these three columns during extended-hours sessions.
  // Quotes API regularQuote is NOT used here to avoid conflicting data sources.

  const netChange = toFiniteNumberOrNullNoSentinel(q.netChange);
  if (!isAfterHours && netChange !== null) {
    if (!row.priceChng || typeof row.priceChng !== "object") {
      row.priceChng = {};
      changed = true;
    }
    if (row.priceChng.val == null) {
      row.priceChng.val = netChange;
      changed = true;
    }
  }

  const netChangePct = toFiniteNumberOrNullNoSentinel(q.netChangePercent);
  if (!isAfterHours && netChangePct !== null) {
    if (!row.priceChngPrc || typeof row.priceChngPrc !== "object") {
      row.priceChngPrc = {};
      changed = true;
    }
    if (row.priceChngPrc.val == null) {
      row.priceChngPrc.val = netChangePct;
      changed = true;
    }
  }

  return changed;
}

export type OvernightIngestionResult = {
  newState: RawDataState;
  touchedSymbols: Set<string>;
  hasChanges: boolean;
};

export function applyOvernightUpdates(
  currentState: RawDataState,
  updates: OvernightPriceUpdate[],
): OvernightIngestionResult {
  const touchedSymbols = new Set<string>();
  let hasChanges = false;
  let matched = 0;
  let skipped = 0;

  for (const update of updates) {
    const symbol = update.symbol;
    touchedSymbols.add(symbol);

    // Only update symbols we already have quote data for (from Schwab quotes)
    const existing = currentState.quotesBySymbol[symbol];
    if (!existing) {
      skipped++;
      continue;
    }

    // Clone individual entry to preserve overnight fields alongside existing quote data
    const quoteItem: QuoteItem = { ...existing, quote: { ...existing.quote } };
    quoteItem.quote.__overnightPrice = update.price;
    quoteItem.quote.__overnightChangeDollar = update.change;
    quoteItem.quote.__overnightChangePercent = update.changePercent;
    // Timestamp marker so Schwab quote polling won't overwrite with stale data
    quoteItem.quote.__overnightUpdatedAt = Date.now();

    currentState.quotesBySymbol[symbol] = quoteItem;
    hasChanges = true;
    matched++;
  }

  overnightFlow.debug("applied", {
    count: updates.length,
    matched,
    skipped,
    hasChanges,
    sample: updates
      .slice(0, 3)
      .map((u) => `${u.symbol}@${u.price?.toFixed(2)}`)
      .join(", "),
  });

  if (hasChanges) {
    currentState.lastUpdated = Date.now();
  }

  return {
    newState: currentState,
    touchedSymbols,
    hasChanges,
  };
}

export function createEmptyRawState(): RawDataState {
  return {
    holdings: null,
    quotesBySymbol: {},
    lastUpdated: 0,
  };
}
