import { toFiniteNumberOrNull } from "./numberParsers";
import type{
  OptionsChain,
  OptionsChainsResponse,
  OptionsExpiration,
  OptionsLeg,
  OptionsUnderlyingData,
} from "shared/types/options";

// Schwab uses large negative sentinels for unavailable quote and Greek fields.
const SENTINEL_MIN = -900;

function parseNullableMetric(v: unknown): number | null {
  const n = toFiniteNumberOrNull(v);
  if (n == null || n <= SENTINEL_MIN) return null;
  return n;
}

function parseNonNegativeMetric(v: unknown): number | null {
  const n = toFiniteNumberOrNull(v);
  if (n == null || n <= SENTINEL_MIN || n < 0) return null;
  return n;
}

function parseLeg(raw: any, optionType: "C" | "P"): OptionsLeg | null {
  if (!raw || typeof raw !== "object") return null;
  const strike = toFiniteNumberOrNull(raw.Strk);
  if (strike == null) return null;

  return {
    sym: raw.Sym == null ? "" : String(raw.Sym),
    optionType,
    strike,
    bid: parseNullableMetric(raw.Bid),
    ask: parseNullableMetric(raw.Ask),
    last: parseNullableMetric(raw.Lst),
    mark: parseNullableMetric(raw.Mark),
    vol: parseNonNegativeMetric(raw.Vol),
    oi: parseNonNegativeMetric(raw.OI),
    iv: parseNonNegativeMetric(raw.IV),
    delta: parseNullableMetric(raw.Delta),
    gamma: parseNullableMetric(raw.Gamma),
    theta: parseNullableMetric(raw.Theta),
    vega: parseNullableMetric(raw.Vega),
    rho: parseNullableMetric(raw.Rho),
    intrinsic: parseNullableMetric(raw.Intrinsic),
    extrinsic: parseNullableMetric(raw.Extrinsic),
    theoVal: parseNullableMetric(raw.TheoVal),
    change: parseNullableMetric(raw.Chg),
    changePct: parseNullableMetric(raw.ChgPct),
    bidSize: parseNonNegativeMetric(raw.BidSize),
    askSize: parseNonNegativeMetric(raw.AskSize),
    high: parseNullableMetric(raw.High),
    low: parseNullableMetric(raw.Low),
  };
}

function parseChain(raw: any): OptionsChain | null {
  if (!raw || typeof raw !== "object") return null;

  const legs: any[] = Array.isArray(raw.Legs) ? raw.Legs : [];
  let call: OptionsLeg | null = null;
  let put: OptionsLeg | null = null;

  for (let i = 0; i < legs.length; i++) {
    const legRaw = legs[i];
    if (!legRaw || typeof legRaw !== "object") continue;

    if (legRaw.OptionType === "P") {
      if (put == null) put = parseLeg(legRaw, "P");
    } else {
      if (call == null) call = parseLeg(legRaw, "C");
    }

    if (call != null && put != null) break;
  }

  const strike = call?.strike ?? put?.strike;
  if (strike == null) return null;

  return {
    strike,
    symbolGroup: raw.SymbolGroup == null ? "" : String(raw.SymbolGroup),
    call,
    put,
  };
}

function parseExpiration(raw: any): OptionsExpiration | null {
  if (!raw || typeof raw !== "object") return null;

  const group = raw.ExpirationGroup;
  if (!group) return null;

  const daysUntil = toFiniteNumberOrNull(group.DaysUntil);
  const monthAndDay = String(group.MonthAndDay ?? "");
  const year = String(group.Year ?? "");
  const day = String(group.Day ?? "");
  const label = `${monthAndDay}, ${year} (${day})`;

  const rawChains: any[] = Array.isArray(raw.Chains) ? raw.Chains : [];
  const chains: OptionsChain[] = new Array(rawChains.length);
  let chainCount = 0;
  for (let i = 0; i < rawChains.length; i++) {
    const parsed = parseChain(rawChains[i]);
    if (parsed) {
      chains[chainCount] = parsed;
      chainCount += 1;
    }
  }

  if (chainCount === 0) return null;
  chains.length = chainCount;

  return {
    rootSymbol: String(group.RootSymbol ?? ""),
    label,
    year,
    daysUntil: daysUntil ?? 0,
    expirationType: String(group.ExpirationType ?? ""),
    chains,
  };
}

function parseUnderlyingData(raw: any): OptionsUnderlyingData {
  const u = raw?.UnderlyingData ?? {};
  return {
    symbol: String(u.Symbol ?? ""),
    description: String(u.Description ?? ""),
    bid: toFiniteNumberOrNull(u.Bid),
    ask: toFiniteNumberOrNull(u.Ask),
    last: toFiniteNumberOrNull(u.Last),
    close: toFiniteNumberOrNull(u.Close),
    open: toFiniteNumberOrNull(u.Open),
    dailyHigh: toFiniteNumberOrNull(u.DailyHigh),
    dailyLow: toFiniteNumberOrNull(u.DailyLow),
    high52W: toFiniteNumberOrNull(u.High52W),
    low52W: toFiniteNumberOrNull(u.Low52W),
    volume: toFiniteNumberOrNull(u.CumulativeVolume),
    netChange: toFiniteNumberOrNull(u.NetChange),
    percentChange: toFiniteNumberOrNull(u.PercentChange),
  };
}

export function parseOptionChainsResponse(raw: unknown): OptionsChainsResponse {
  const data = raw as any;
  if (!data || typeof data !== "object") {
    return createEmptyResponse();
  }

  const underlying = parseUnderlyingData(data);

  const rawExpirations: any[] = Array.isArray(data.Expirations)
    ? data.Expirations
    : [];
  const expirations: OptionsExpiration[] = new Array(rawExpirations.length);
  let expirationCount = 0;
  for (let i = 0; i < rawExpirations.length; i++) {
    const parsed = parseExpiration(rawExpirations[i]);
    if (parsed) {
      expirations[expirationCount] = parsed;
      expirationCount += 1;
    }
  }
  expirations.length = expirationCount;

  const multi = toFiniteNumberOrNull(data.ContractSpecs?.Multi);

  return {
    underlying,
    expirations,
    underlyingPrice: toFiniteNumberOrNull(data.UnderlyingPrice),
    interestRate: toFiniteNumberOrNull(data.InterestRate),
    volatility: toFiniteNumberOrNull(data.Volatility),
    dividendYield: toFiniteNumberOrNull(data.DividendYield),
    contractMultiplier: multi ?? 100,
    currentDateTime: String(data.CurrentDateTime ?? ""),
    isDelayed: Boolean(data.IsDelayed),
  };
}

function createEmptyResponse(): OptionsChainsResponse {
  return {
    underlying: {
      symbol: "",
      description: "",
      bid: null,
      ask: null,
      last: null,
      close: null,
      open: null,
      dailyHigh: null,
      dailyLow: null,
      high52W: null,
      low52W: null,
      volume: null,
      netChange: null,
      percentChange: null,
    },
    expirations: [],
    underlyingPrice: null,
    interestRate: null,
    volatility: null,
    dividendYield: null,
    contractMultiplier: 100,
    currentDateTime: "",
    isDelayed: false,
  };
}
