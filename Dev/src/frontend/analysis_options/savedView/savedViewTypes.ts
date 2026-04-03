import type{ OptionsChainsResponse } from "shared/types/options";
import type { GreeksBasis, GexGammaSource, ExpectedMoveMode } from "backend/computation/options/types";
import type {
  ScopeMode,
  LocalWindowMode,
  StrikeMode,
  LiquidityPreset,
  LiquidityAdvanced,
  IVMetric,
  IVSlice,
} from "../types";

export type SavedViewState = {
  selectedExpirationIdx: number;
  selectedStrikeCount: number;
  customExpirationIdxs: number[];
  scopeMode: ScopeMode;
  greeksBasis: GreeksBasis;
  gammaSource: GexGammaSource;
  liquidityThreshold: number;
  localWindowMode: LocalWindowMode;
  localWindowPct: number;
  localWindowDeltaRange: [number, number];
  strikeMode: StrikeMode;
  strikeDollarWidth: number;
  liquidityPreset: LiquidityPreset;
  liquidityAdvanced: LiquidityAdvanced;
  expectedMoveMode: ExpectedMoveMode;
  ivMetric: IVMetric;
  ivSlice: IVSlice;
};

export type OptionsSavedView = {
  version: 1;
  createdAt: string;
  ticker: string;
  selectedExpirationIdx: number;
  selectedStrikeCount: number;
  customExpirationIdxs: number[];
  scopeMode: ScopeMode;
  greeksBasis: GreeksBasis;
  gammaSource: GexGammaSource;
  liquidityThreshold: number;
  localWindowMode: LocalWindowMode;
  localWindowPct: number;
  localWindowDeltaRange: [number, number];
  strikeMode: StrikeMode;
  strikeDollarWidth: number;
  liquidityPreset: LiquidityPreset;
  liquidityAdvanced: LiquidityAdvanced;
  expectedMoveMode: ExpectedMoveMode;
  ivMetric: IVMetric;
  ivSlice: IVSlice;
  timestamp: string;
  keyLevels: Record<string, number | null>;
  quality: { score: number; grade: string };
};

export type TimestampSavedView = {
  version: 1;
  symbol: string;
  savedAt: string;
  dataTimestamp: string;
  response: OptionsChainsResponse;
  view: SavedViewState;
};
