import type{
  HoldingsResponse,
  QuoteItem,
  QuotesResponse,
} from "../../../shared/types/holdings";
import type { OvernightPriceUpdate } from "backend/core/network/yahoo/overnightStreamer";
import { getHoldingsKey } from "../../../shared/utils/domain/holdingsKeys";
import { toFiniteNumberOrNullNoSentinel } from "backend/core/network/schwab/parsing/numberParsers";
import { logService } from "../../../shared/log/core/LogService";
import { INDEX_SYMBOLS_SET as INDEX_SYMBOLS } from "../indexSymbols";

const holdFlow = logService.namespace("flow:hold");
const quoteFlow = logService.namespace("flow:quote");
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

// Streamer ingestion lives in `./streamerIngestion.ts`; re-exported here for
// existing call sites (BackendOrchestrator, IngestionCoordinator) that import
// it from this module.
export { applyStreamerUpdates } from "./streamerIngestion";


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
