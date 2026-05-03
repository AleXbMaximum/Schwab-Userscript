import type {
  HoldingsRow,
  QuoteItem,
} from "../../../shared/types/holdings";
import type { StreamerUpdate } from "backend/core/network/types";
import { getHoldingsKey, isOption } from "../../../shared/utils/domain/holdingsKeys";
import type { SymbolMap } from "./HoldingsIndexBuilder";
import { toFiniteNumberOrNullNoSentinel } from "backend/core/network/schwab/parsing/numberParsers";
import { logService } from "../../../shared/log/core/LogService";
import { INDEX_SYMBOLS_SET as INDEX_SYMBOLS } from "../indexSymbols";
import type {
  RawDataState,
  StreamerIngestionMode,
  StreamerIngestionResult,
} from "./DataIngestion";

const streamerFlow = logService.namespace("flow:strm");

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

      const streamerNetChangeAbs = toFiniteNumberOrNullNoSentinel(
        update.netChange,
      );
      const effectiveNetChange =
        streamerNetChangeAbs ?? (close != null ? lastPrice - close : null);
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
  const impliedVolatility = toFiniteNumberOrNullNoSentinel(update.volatility);
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

    if (lastPrice !== null) {
      const currentMV = lastPrice * qty * multiplier;
      const startOfDayMV = currentMV - newDayChange;
      if (startOfDayMV !== 0) {
        (row as any).dayChngPerc.val = newDayChange / Math.abs(startOfDayMV);
      }
    }
  }

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

export function applyStreamerUpdates(
  currentState: RawDataState,
  updates: StreamerUpdate[],
  symbolMap: SymbolMap,
  mode: StreamerIngestionMode = "full",
): StreamerIngestionResult {
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

  if (hasChanges) {
    currentState.lastUpdated = Date.now();
  }

  return {
    newState: currentState,
    touchedHoldingsKeys,
    touchedSymbols,
  };
}
