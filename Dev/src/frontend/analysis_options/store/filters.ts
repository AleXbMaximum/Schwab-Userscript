import type{ OptionsChain, OptionsExpiration, OptionsLeg } from "shared/types/options";
import { weightedAverage } from "shared/utils/math/statistics";
import { sumFinite } from "shared/utils/math/guards";
import type {
  OptionsViewState,
  LocalWindowMode,
  LiquidityPreset,
  LiquidityAdvanced,
} from "../types";

const legKeysToAverage: ReadonlyArray<keyof OptionsLeg> = [
  "bid",
  "ask",
  "last",
  "mark",
  "iv",
  "delta",
  "gamma",
  "theta",
  "vega",
  "rho",
  "intrinsic",
  "extrinsic",
  "theoVal",
  "change",
  "changePct",
  "high",
  "low",
] as const;

const legKeysToSum: ReadonlyArray<keyof OptionsLeg> = [
  "vol",
  "oi",
  "bidSize",
  "askSize",
] as const;

function mergeLegs(
  legs: OptionsLeg[] | null,
  optionType: "C" | "P",
  strike: number,
): OptionsLeg | null {
  if (!legs || legs.length === 0) return null;
  const weights = legs.map((l) => l.oi ?? l.vol ?? 0);
  const base = legs[0];

  const merged: OptionsLeg = {
    sym: base.sym,
    optionType,
    strike,
    bid: null,
    ask: null,
    last: null,
    mark: null,
    vol: null,
    oi: null,
    iv: null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    rho: null,
    intrinsic: null,
    extrinsic: null,
    theoVal: null,
    change: null,
    changePct: null,
    bidSize: null,
    askSize: null,
    high: null,
    low: null,
  };

  for (const key of legKeysToAverage) {
    const vals = legs.map((l) => l[key] as number | null | undefined);
    (merged[key] as number | null) = weightedAverage(vals, weights);
  }
  for (const key of legKeysToSum) {
    const vals = legs.map((l) => l[key] as number | null | undefined);
    (merged[key] as number | null) = sumFinite(vals);
  }

  return merged;
}

function aggregateChains(expirations: OptionsExpiration[]): OptionsChain[] {
  const byStrike = new Map<
    number,
    {
      strike: number;
      symbolGroup: string;
      calls: OptionsLeg[];
      puts: OptionsLeg[];
    }
  >();

  for (const exp of expirations) {
    for (const chain of exp.chains) {
      const row = byStrike.get(chain.strike) ?? {
        strike: chain.strike,
        symbolGroup: chain.symbolGroup,
        calls: [],
        puts: [],
      };
      if (chain.call) row.calls.push(chain.call);
      if (chain.put) row.puts.push(chain.put);
      byStrike.set(chain.strike, row);
    }
  }

  return [...byStrike.values()]
    .sort((a, b) => a.strike - b.strike)
    .map((row) => ({
      strike: row.strike,
      symbolGroup: row.symbolGroup,
      call: mergeLegs(row.calls, "C", row.strike),
      put: mergeLegs(row.puts, "P", row.strike),
    }));
}

function spreadPct(
  bid: number | null | undefined,
  ask: number | null | undefined,
): number | null {
  if (bid == null || ask == null || bid <= 0 || ask <= 0) return null;
  const mid = (bid + ask) / 2;
  if (mid <= 0) return null;
  return (ask - bid) / mid;
}

function liquidityFromPreset(
  preset: LiquidityPreset,
  advanced: LiquidityAdvanced,
): { spreadPct: number; minVol: number; minOI: number; excludeStale: boolean } {
  switch (preset) {
    case "strict":
      return { spreadPct: 0.15, minVol: 10, minOI: 50, excludeStale: true };
    case "normal":
      return { spreadPct: 0.25, minVol: 0, minOI: 0, excludeStale: false };
    case "loose":
      return { spreadPct: 0.40, minVol: 0, minOI: 0, excludeStale: false };
    case "advanced":
      return { ...advanced };
  }
}

function passLiquidity(
  chain: OptionsChain,
  params: {
    spreadPct: number;
    minVol: number;
    minOI: number;
    excludeStale: boolean;
  },
): boolean {
  if (
    params.spreadPct <= 0 &&
    params.minVol <= 0 &&
    params.minOI <= 0 &&
    !params.excludeStale
  )
    return true;

  if (params.spreadPct > 0) {
    const cSpread = spreadPct(chain.call?.bid, chain.call?.ask);
    const pSpread = spreadPct(chain.put?.bid, chain.put?.ask);
    const passCall = cSpread == null || cSpread <= params.spreadPct;
    const passPut = pSpread == null || pSpread <= params.spreadPct;
    if (!passCall && !passPut) return false;
  }

  if (params.minVol > 0) {
    const callVol = chain.call?.vol ?? 0;
    const putVol = chain.put?.vol ?? 0;
    if (callVol < params.minVol && putVol < params.minVol) return false;
  }

  if (params.minOI > 0) {
    const callOI = chain.call?.oi ?? 0;
    const putOI = chain.put?.oi ?? 0;
    if (callOI < params.minOI && putOI < params.minOI) return false;
  }

  if (params.excludeStale) {
    const callVol = chain.call?.vol ?? 0;
    const putVol = chain.put?.vol ?? 0;
    if (callVol === 0 && putVol === 0) return false;
  }

  return true;
}

function localWindowPctValue(
  mode: LocalWindowMode,
  pct: number,
): number | null {
  if (mode === "all") return null;
  if (mode === "pct") return Math.max(1, Math.min(50, pct));
  return null;
}

export function applyLocalWindowFilter(
  chains: OptionsChain[],
  underlyingPrice: number | null,
  mode: LocalWindowMode,
  pct: number,
  deltaRange: [number, number],
): OptionsChain[] {
  if (chains.length === 0 || mode === "all") return chains;

  if (mode === "pct") {
    const pctValue = localWindowPctValue("pct", pct);
    if (pctValue == null || underlyingPrice == null || underlyingPrice <= 0)
      return chains;
    const lower = underlyingPrice * (1 - pctValue / 100);
    const upper = underlyingPrice * (1 + pctValue / 100);
    return chains.filter((c) => c.strike >= lower && c.strike <= upper);
  }

  const rawLow = Number.isFinite(deltaRange[0]) ? deltaRange[0] : 0;
  const rawHigh = Number.isFinite(deltaRange[1]) ? deltaRange[1] : 1;
  const dLow = Math.max(0, Math.min(rawLow, rawHigh));
  const dHigh = Math.min(1, Math.max(rawLow, rawHigh));

  return chains.filter((c) => {
    const absDelta =
      c.call?.delta != null
        ? Math.abs(c.call.delta)
        : c.put?.delta != null
          ? 1 - Math.abs(c.put.delta)
          : null;
    if (absDelta == null) return true;
    return absDelta >= dLow && absDelta <= dHigh;
  });
}

function scopedExpirations(state: OptionsViewState): OptionsExpiration[] {
  if (!state.response || state.response.expirations.length === 0) return [];
  const exps = state.response.expirations;
  if (state.scopeMode === "all") return exps;
  if (state.scopeMode === "multi") {
    const idxs = state.customExpirationIdxs.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < exps.length,
    );
    if (idxs.length > 0) return idxs.map((i) => exps[i]);
  }
  return [exps[state.selectedExpirationIdx] ?? exps[0]];
}

export function deriveFilteredChains(state: OptionsViewState): OptionsChain[] {
  if (!state.response || state.response.expirations.length === 0) return [];

  const exps = scopedExpirations(state);
  if (exps.length === 0) return [];
  let chains = exps.length === 1 ? exps[0].chains : aggregateChains(exps);
  const spot = state.response.underlyingPrice;
  chains = applyLocalWindowFilter(
    chains,
    spot,
    state.localWindowMode,
    state.localWindowPct,
    state.localWindowDeltaRange,
  );

  const liqParams = liquidityFromPreset(
    state.liquidityPreset,
    state.liquidityAdvanced,
  );
  chains = chains.filter((c) => passLiquidity(c, liqParams));

  if (state.strikeMode === "count") {
    if (
      state.selectedStrikeCount > 0 &&
      spot != null &&
      chains.length > state.selectedStrikeCount
    ) {
      const sorted = [...chains].sort((a, b) => a.strike - b.strike);
      const atmIdx = sorted.reduce(
        (best, c, i) =>
          Math.abs(c.strike - spot) < Math.abs(sorted[best].strike - spot)
            ? i
            : best,
        0,
      );
      const half = Math.floor(state.selectedStrikeCount / 2);
      const start = Math.max(
        0,
        Math.min(atmIdx - half, sorted.length - state.selectedStrikeCount),
      );
      chains = sorted.slice(start, start + state.selectedStrikeCount);
    }
  } else if (state.strikeMode === "dollarWidth") {
    if (state.strikeDollarWidth > 0 && spot != null) {
      const lower = spot - state.strikeDollarWidth;
      const upper = spot + state.strikeDollarWidth;
      chains = chains.filter((c) => c.strike >= lower && c.strike <= upper);
    }
  } else if (state.strikeMode === "auto") {
    if (state.localWindowMode === "all" && spot != null && chains.length > 48) {
      const sorted = [...chains].sort((a, b) => a.strike - b.strike);
      const atmIdx = sorted.reduce(
        (best, c, i) =>
          Math.abs(c.strike - spot) < Math.abs(sorted[best].strike - spot)
            ? i
            : best,
        0,
      );
      const half = 24;
      const start = Math.max(0, Math.min(atmIdx - half, sorted.length - 48));
      chains = sorted.slice(start, start + 48);
    }
  }

  return chains;
}
