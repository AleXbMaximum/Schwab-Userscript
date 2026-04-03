import type{ DerivedState, UnderlyingAggRow } from "../../../shared/types/derived";
import { BETA_BENCHMARKS, type TickerBetaBundle } from "./types";

export type WeightedBetaRow = {
  ultraShort: number | null;
  week: number | null;
  short: number | null;
  medium: number | null;
  long: number | null;
};

const NULL_ROW: WeightedBetaRow = {
  ultraShort: null,
  week: null,
  short: null,
  medium: null,
  long: null,
};

// Require more than 50% delta-notional coverage before publishing a weighted beta.
function computeWeightedBetaForOneBenchmark(
  byUnderlying: Record<string, { deltaNotionalDol?: number | null }>,
  betaMap: Map<string, TickerBetaBundle>,
  netMarketValue: number,
  totalAbsDeltaNotional: number,
): WeightedBetaRow {
  let sumUS = 0,
    covUS = 0;
  let sumW = 0,
    covW = 0;
  let sumS = 0,
    covS = 0;
  let sumM = 0,
    covM = 0;
  let sumL = 0,
    covL = 0;

  for (const uk in byUnderlying) {
    const deltaN = byUnderlying[uk]?.deltaNotionalDol ?? 0;
    if (deltaN === 0) continue;
    const bundle = betaMap.get(uk);
    if (!bundle) continue;

    const betaUS = bundle.ultraShort?.beta ?? null;
    const betaW = bundle.week?.beta ?? null;
    const betaS = bundle.short?.beta ?? null;
    const betaM = bundle.medium?.beta ?? null;
    const betaL = bundle.long?.beta ?? null;

    if (betaUS != null) {
      sumUS += deltaN * betaUS;
      covUS += Math.abs(deltaN);
    }
    if (betaW != null) {
      sumW += deltaN * betaW;
      covW += Math.abs(deltaN);
    }
    if (betaS != null) {
      sumS += deltaN * betaS;
      covS += Math.abs(deltaN);
    }
    if (betaM != null) {
      sumM += deltaN * betaM;
      covM += Math.abs(deltaN);
    }
    if (betaL != null) {
      sumL += deltaN * betaL;
      covL += Math.abs(deltaN);
    }
  }

  const threshold = totalAbsDeltaNotional * 0.5;
  const thresholdRound = (sum: number, cov: number): number | null =>
    netMarketValue > 0 && cov > threshold
      ? Math.round((sum / netMarketValue) * 1000) / 1000
      : null;

  return {
    ultraShort: thresholdRound(sumUS, covUS),
    week: thresholdRound(sumW, covW),
    short: thresholdRound(sumS, covS),
    medium: thresholdRound(sumM, covM),
    long: thresholdRound(sumL, covL),
  };
}

export function computeWeightedBetaForBenchmarks(
  byUnderlying: Record<string, { deltaNotionalDol?: number | null }>,
  allBenchmarkBetas: Map<string, Map<string, TickerBetaBundle>>,
  netMarketValue: number,
  totalAbsDeltaNotional: number,
): Record<string, WeightedBetaRow> {
  const result: Record<string, WeightedBetaRow> = {};
  for (const [benchmarkKey, betaMap] of allBenchmarkBetas) {
    result[benchmarkKey] =
      betaMap.size > 0
        ? computeWeightedBetaForOneBenchmark(
            byUnderlying,
            betaMap,
            netMarketValue,
            totalAbsDeltaNotional,
          )
        : { ...NULL_ROW };
  }
  for (const benchmarkKey of BETA_BENCHMARKS) {
    if (!result[benchmarkKey]) result[benchmarkKey] = { ...NULL_ROW };
  }
  return result;
}
function enrichAgg(
  agg: UnderlyingAggRow,
  bundle: TickerBetaBundle | undefined,
): void {
  const betaUS = bundle?.ultraShort?.beta ?? null;
  const betaW = bundle?.week?.beta ?? null;
  const betaS = bundle?.short?.beta ?? null;
  const betaM = bundle?.medium?.beta ?? null;
  const betaL = bundle?.long?.beta ?? null;

  agg.betaUltraShort = betaUS;
  agg.betaWeek = betaW;
  agg.betaShort = betaS;
  agg.betaMedium = betaM;
  agg.betaLong = betaL;

  const deltaN = agg.deltaNotionalDol;
  agg.betaNotionalDolUltraShort = deltaN != null && betaUS != null ? deltaN * betaUS : null;
  agg.betaNotionalDolWeek = deltaN != null && betaW != null ? deltaN * betaW : null;
  agg.betaNotionalDol = deltaN != null && betaS != null ? deltaN * betaS : null;
  agg.betaNotionalDolMedium = deltaN != null && betaM != null ? deltaN * betaM : null;
  agg.betaNotionalDolLong = deltaN != null && betaL != null ? deltaN * betaL : null;
}
// Use the active benchmark for per-underlying fields, but prefer SPX for portfolio snapshots.
export function enrichDerivedStateWithBeta(
  derived: DerivedState | null | undefined,
  betaData: Map<string, TickerBetaBundle> | null | undefined,
  touchedKeys?: string[] | null,
  spxBetaData?: Map<string, TickerBetaBundle> | null,
): void {
  if (!derived || !betaData || betaData.size === 0) return;

  const byUnderlying = derived.byUnderlying;
  if (!byUnderlying) return;

  // Refresh per-underlying beta fields first.
  if (touchedKeys != null && touchedKeys.length > 0) {
    for (const uk of touchedKeys) {
      const agg = byUnderlying[uk];
      if (agg) enrichAgg(agg, betaData.get(uk));
    }
  } else {
    for (const uk in byUnderlying) {
      enrichAgg(byUnderlying[uk], betaData.get(uk));
    }
  }

  // Concentration depends on the refreshed beta notionals.
  let totalAbs = 0;
  for (const uk in byUnderlying) {
    if (byUnderlying[uk].betaNotionalDol != null) {
      totalAbs += Math.abs(byUnderlying[uk].betaNotionalDol!);
    }
  }
  for (const uk in byUnderlying) {
    const agg = byUnderlying[uk];
    agg.betaNotionalConcentrationPct =
      agg.betaNotionalDol != null && totalAbs > 0
        ? Math.abs(agg.betaNotionalDol) / totalAbs
        : null;
  }

  // Keep portfolio weighted beta pinned to SPX data when available.
  const aggBetaSource =
    spxBetaData && spxBetaData.size > 0 ? spxBetaData : betaData;
  const netMV = Math.abs(derived.portfolioAgg?.netMarketValue ?? 0);
  const totalAbsDelta = derived.portfolioAgg?.totalAbsDeltaNotionalDol ?? 0;
  const weightedBeta = computeWeightedBetaForOneBenchmark(
    byUnderlying,
    aggBetaSource,
    netMV,
    totalAbsDelta,
  );

  if (derived.portfolioAgg) {
    derived.portfolioAgg.portfolioWeightedBetaUltraShort = weightedBeta.ultraShort;
    derived.portfolioAgg.portfolioWeightedBetaWeek = weightedBeta.week;
    derived.portfolioAgg.portfolioWeightedBetaShort = weightedBeta.short;
    derived.portfolioAgg.portfolioWeightedBetaMedium = weightedBeta.medium;
    derived.portfolioAgg.portfolioWeightedBetaLong = weightedBeta.long;
    derived.portfolioAgg.totalAbsBetaNotionalDol =
      totalAbs > 0 ? totalAbs : null;
  }
}
