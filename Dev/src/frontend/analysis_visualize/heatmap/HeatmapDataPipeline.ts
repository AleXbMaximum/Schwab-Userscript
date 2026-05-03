import type { BetaHorizon } from "../../../backend/computation/beta/types";
import {
  alignBarsByDate,
  computeLogReturns,
  computeBeta,
} from "../../../backend/computation/beta/singleFactor";
import { pearsonCorrelation } from "../../../shared/utils/math/statistics";
import type { ChartDataService } from "../../../backend/core/network/chart/ChartDataService";
import type {
  ChartInterval,
  OHLCVBar,
} from "../../../shared/types/chartData";

export type HeatmapMode = "correlation" | "beta";
export type WindowKey = "1D" | "1M" | "6M" | "2Y";

type WindowConfig = {
  days: number;
  interval: ChartInterval;
  horizon: BetaHorizon;
};

// Mirrors BetaService.HORIZONS exactly
export const WINDOW_CONFIGS: Record<WindowKey, WindowConfig> = {
  "1D": { days: 5, interval: "5m", horizon: "ultraShort" },
  "1M": { days: 35, interval: "15m", horizon: "short" },
  "6M": { days: 200, interval: "1h", horizon: "medium" },
  "2Y": { days: 760, interval: "1d", horizon: "long" },
};

const PERIOD_SAFETY_BUFFER = 3600;
const FETCH_CONCURRENCY = 4;

// Absolute beta beyond this cap is treated as degenerate (near-zero base variance)
const MAX_BETA_ABS = 5;

export async function fetchAllBars(
  tickers: string[],
  cfg: WindowConfig,
  chartDataService: ChartDataService,
  shouldAbort: () => boolean,
  setProgress: (
    percent: number,
    summary: string,
    meta?: string,
    detail?: string,
  ) => void,
): Promise<Map<string, OHLCVBar[]> | null> {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - cfg.days * 86400 + PERIOD_SAFETY_BUFFER;
  const barsMap = new Map<string, OHLCVBar[]>();
  const queue = [...tickers];
  let fetched = 0;

  const worker = async () => {
    while (queue.length > 0) {
      if (shouldAbort()) return;
      const sym = queue.shift()!;
      try {
        const result = await chartDataService.fetch({
          symbol: sym,
          interval: cfg.interval,
          window: { kind: "period", period1, period2: now },
          includePrePost: false,
        });
        barsMap.set(sym, result.bars);
        fetched++;
        const pct = (fetched / tickers.length) * 90;
        setProgress(
          pct,
          `Fetching bars ${fetched}/${tickers.length}`,
          `${(Date.now() / 1000 - now + cfg.days * 86400).toFixed(0)}s`,
          `${sym}: ${result.bars.length} bars`,
        );
      } catch {
        barsMap.set(sym, []);
        fetched++;
        setProgress(
          (fetched / tickers.length) * 90,
          `Fetching bars ${fetched}/${tickers.length}`,
          undefined,
          `${sym}: fetch failed`,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, () => worker()));
  if (shouldAbort()) return null;
  return barsMap;
}

export function computeMatrix(
  rows: string[],
  cols: string[],
  barsMap: Map<string, OHLCVBar[]>,
  mode: HeatmapMode,
  horizon: BetaHorizon,
  minRSquared: number,
): { matrix: number[][]; sampleSizes: number[][]; rSquared: number[][] } {
  const nRows = rows.length;
  const nCols = cols.length;
  const matrix = Array.from({ length: nRows }, () =>
    new Array<number>(nCols).fill(NaN),
  );
  const sampleSizes = Array.from({ length: nRows }, () =>
    new Array<number>(nCols).fill(0),
  );
  const rSquared = Array.from({ length: nRows }, () =>
    new Array<number>(nCols).fill(NaN),
  );

  // Cache aligned returns to avoid double work
  const alignedCache = new Map<
    string,
    { returnsA: number[]; returnsB: number[] }
  >();
  function getAligned(
    a: string,
    b: string,
  ): { returnsA: number[]; returnsB: number[] } {
    const sorted = a < b;
    const key = sorted ? `${a}|${b}` : `${b}|${a}`;
    const cached = alignedCache.get(key);
    if (cached) {
      return sorted
        ? cached
        : { returnsA: cached.returnsB, returnsB: cached.returnsA };
    }
    const barsA = barsMap.get(a) ?? [];
    const barsB = barsMap.get(b) ?? [];
    const { stockCloses, marketCloses } = alignBarsByDate(barsA, barsB);
    const entry = {
      returnsA: computeLogReturns(stockCloses),
      returnsB: computeLogReturns(marketCloses),
    };
    alignedCache.set(key, entry);
    return entry;
  }

  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      // Self-pair on diagonal
      if (rows[i] === cols[j]) {
        matrix[i][j] = 1.0;
        sampleSizes[i][j] = barsMap.get(rows[i])?.length ?? 0;
        rSquared[i][j] = 1.0;
        continue;
      }

      const { returnsA, returnsB } = getAligned(rows[i], cols[j]);

      if (mode === "correlation") {
        matrix[i][j] = pearsonCorrelation(returnsA, returnsB);
        sampleSizes[i][j] = returnsA.length;
      } else {
        // Beta: row = target (stock), col = base (market)
        const result = computeBeta(returnsA, returnsB, horizon);
        rSquared[i][j] = result?.rSquared ?? NaN;
        if (
          result &&
          result.rSquared >= minRSquared &&
          Math.abs(result.beta) <= MAX_BETA_ABS
        ) {
          matrix[i][j] = result.beta;
        }
        sampleSizes[i][j] = result?.sampleSize ?? 0;
      }
    }
  }

  return { matrix, sampleSizes, rSquared };
}
