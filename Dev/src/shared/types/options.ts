export type OptionsUnderlyingData = {
  symbol: string;
  description: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  close: number | null;
  open: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  high52W: number | null;
  low52W: number | null;
  volume: number | null;
  netChange: number | null;
  percentChange: number | null;
};

/** Unavailable option metrics are normalized to null by the parser. */
export type OptionsLeg = {
  sym: string;
  optionType: "C" | "P";
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mark: number | null;
  vol: number | null;
  oi: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  intrinsic: number | null;
  extrinsic: number | null;
  theoVal: number | null;
  change: number | null;
  changePct: number | null;
  bidSize: number | null;
  askSize: number | null;
  high: number | null;
  low: number | null;
};

export type OptionsChain = {
  strike: number;
  symbolGroup: string;
  call: OptionsLeg | null;
  put: OptionsLeg | null;
};

export type OptionsExpiration = {
  rootSymbol: string;
  label: string;
  year: string;
  daysUntil: number;
  expirationType: string;
  chains: OptionsChain[];
};

export type OptionsChainsResponse = {
  underlying: OptionsUnderlyingData;
  expirations: OptionsExpiration[];
  underlyingPrice: number | null;
  interestRate: number | null;
  volatility: number | null;
  dividendYield: number | null;
  contractMultiplier: number;
  currentDateTime: string;
  isDelayed: boolean;
};
