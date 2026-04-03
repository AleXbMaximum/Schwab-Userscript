export type OptionCapture = {
  version: 1;
  symbol: string;
  /** UTC ISO — when we initiated the fetch */
  capturedAt: string;
  /** UTC ISO — when Schwab generated the data snapshot */
  dataTimestamp: string;
  underlyingPrice: number | null;
  selectedExpiry: string;
  dte: number;
  atmIV: number | null;
  rr25: number | null;
  impliedMovePct: number | null;
  netGex: number | null;
  gammaFlip: number | null;
  callWall: number | null;
  putWall: number | null;
  maxPain: number | null;
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  pcRatioVolume: number | null;
  pcRatioOI: number | null;
  qualityScore: number;
  qualityGrade: string;
  isDelayed: boolean;
};

export interface OptionCaptureMetaRow {
  openingId: string;
  symbol: string;
  capturedAtUtc: string;
  marketTimeCt: string;
  dataTimestamp: string;
  underlyingPrice: number | null;
  interestRate: number | null;
  dividendYield: number | null;
  contractMultiplier: number;
  expirationsCount: number;
  isDelayed: boolean;
}

export interface OptionCaptureExpiryMetricsRow {
  openingId: string;
  symbol: string;
  expiryLabel: string;
  selectionMode?: "all" | "top_n" | "fixed_slots" | null;
  selectionSlot?: string | null;
  selectionRank?: number | null;
  dte: number;
  atmStrike: number | null;
  atmCallIV: number | null;
  atmPutIV: number | null;
  atmIV: number | null;
  rr25: number | null;
  expectedMove: number | null;
  expectedMovePct: number | null;
  totalCallVolume: number;
  totalPutVolume: number;
  pcRatioVolume: number | null;
  totalCallOI: number;
  totalPutOI: number;
  pcRatioOI: number | null;
  totalNetGex: number;
  grossGex: number;
  gammaFlip: number | null;
  callWallOIStrike: number | null;
  putWallOIStrike: number | null;
  callWallGexStrike: number | null;
  putWallGexStrike: number | null;
  maxPain: number | null;
  forwardPrice: number | null;
  qualityScore: number;
  missingQuotePct: number;
  missingIVPct: number;
}

export interface OptionCaptureStrikeLegRow {
  openingId: string;
  symbol: string;
  expiryLabel: string;
  dte: number;
  strike: number;
  optionType: "C" | "P";
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
  bidSize: number | null;
  askSize: number | null;
  spreadPct: number | null;
  midPrice: number | null;
  callGex: number | null;
  putGex: number | null;
  netGex: number | null;
}
export interface EmbeddedExpiryMetrics {
  expiryLabel: string;
  selectionMode?: "all" | "top_n" | "fixed_slots" | null;
  selectionSlot?: string | null;
  selectionRank?: number | null;
  dte: number;
  atmStrike: number | null;
  atmCallIV: number | null;
  atmPutIV: number | null;
  atmIV: number | null;
  rr25: number | null;
  expectedMove: number | null;
  expectedMovePct: number | null;
  totalCallVolume: number;
  totalPutVolume: number;
  pcRatioVolume: number | null;
  totalCallOI: number;
  totalPutOI: number;
  pcRatioOI: number | null;
  totalNetGex: number;
  grossGex: number;
  gammaFlip: number | null;
  callWallOIStrike: number | null;
  putWallOIStrike: number | null;
  callWallGexStrike: number | null;
  putWallGexStrike: number | null;
  maxPain: number | null;
  forwardPrice: number | null;
  qualityScore: number;
  missingQuotePct: number;
  missingIVPct: number;
}

export interface OptionCaptureSnapshotRow {
  openingId: string;
  symbol: string;
  capturedAtUtc: string;
  marketTimeCt: string;
  dataTimestamp: string;
  underlyingPrice: number | null;
  interestRate: number | null;
  dividendYield: number | null;
  contractMultiplier: number;
  expirationsCount: number;
  isDelayed: boolean;
  expiryMetrics: EmbeddedExpiryMetrics[];
}

export interface OptionCaptureStrikeAggregateRow {
  openingId: string;
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  callOI: number;
  putOI: number;
}

export type SessionSegment = "open" | "mid" | "close";

export interface OptionCaptureFeatureLabelRow {
  openingId: string;
  symbol: string;
  fwdRet10m: number | null;
  fwdRet30m: number | null;
  fwdRet60m: number | null;
  fwdAbsRet30m: number | null;
  fwdAbsRet60m: number | null;
  rv30m: number | null;
  rv60m: number | null;
  moveExceedsImplied30m: boolean | null;
  sessionSegment: SessionSegment | null;
  eventFlag: string | null;
}
