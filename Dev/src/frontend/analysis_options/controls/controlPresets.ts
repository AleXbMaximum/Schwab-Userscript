import type { GreeksBasis, GexGammaSource } from "backend/computation/options/types";
import type { LocalWindowMode, LiquidityPreset, ScopeMode } from "../types";

export type LocalWindowOption = {
  value: string;
  label: string;
  mode: LocalWindowMode;
  pct?: number;
  delta?: [number, number];
};

export const LOCAL_WINDOW_OPTIONS: readonly LocalWindowOption[] = [
  { value: "all", label: "Global", mode: "all" },
  { value: "pct:5", label: "\u00b15%", mode: "pct", pct: 5 },
  { value: "pct:10", label: "\u00b110%", mode: "pct", pct: 10 },
  { value: "pct:15", label: "\u00b115%", mode: "pct", pct: 15 },
  { value: "pct:20", label: "\u00b120%", mode: "pct", pct: 20 },
  { value: "delta:0.2-0.8", label: "\u039420-80", mode: "delta", delta: [0.2, 0.8] },
  { value: "delta:0.25-0.75", label: "\u039425-75", mode: "delta", delta: [0.25, 0.75] },
  { value: "delta:0.3-0.7", label: "\u039430-70", mode: "delta", delta: [0.3, 0.7] },
] as const;

export const STRIKE_COUNT_BASE = [20, 30, 48, 60, 80, 0] as const;
export const STRIKE_WIDTH_BASE = [10, 25, 50, 100] as const;

export const LIQUIDITY_SPREAD_BASE = [10, 15, 20, 25, 30, 40, 50] as const;
export const LIQUIDITY_MIN_VOL_BASE = [0, 10, 25, 50, 100, 250] as const;
export const LIQUIDITY_MIN_OI_BASE = [0, 50, 100, 250, 500, 1000] as const;

export const SCOPE_LABELS: Record<ScopeMode, string> = {
  single: "Single",
  multi: "Multi",
  all: "All",
};

export const LIQUIDITY_LABELS: Record<LiquidityPreset, string> = {
  strict: "Strict",
  normal: "Normal",
  loose: "Loose",
  advanced: "Advanced",
};

export const BASIS_LABELS: Record<GreeksBasis, string> = {
  mid: "Mid",
  mark: "Mark",
};

export const GAMMA_SOURCE_LABELS: Record<GexGammaSource, string> = {
  schwab: "Market",
  bs: "BS Model",
};
