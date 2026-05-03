import type { OHLCVBar } from "shared/types/chartData";
import type { SchwabChartBar } from "../endpoints/symbol_quotes_history";

/**
 * Convert SchwabChartBar[] to the unified OHLCVBar[] format.
 *
 * Field mapping:
 *   openPrice     → open
 *   highPrice     → high
 *   lowPrice      → low
 *   lastPrice     → close  (bar's closing/last traded price)
 *   volume        → volume
 *   lastPriceDate → date   (ISO datetime, kept as-is)
 */
export function normalizeSchwabBars(bars: SchwabChartBar[]): OHLCVBar[] {
  return bars.map((b) => ({
    date: b.lastPriceDate,
    open: b.openPrice || b.lastPrice,
    high: b.highPrice || b.lastPrice,
    low: b.lowPrice || b.lastPrice,
    close: b.lastPrice,
    volume: b.volume,
  }));
}
