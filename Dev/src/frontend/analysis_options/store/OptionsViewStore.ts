import type { GreeksBasis, GexGammaSource, ExpectedMoveMode } from "backend/computation/options/types";
import type {
  OptionsViewState,
  ScopeMode,
  SectionId,
  LocalWindowMode,
  StrikeMode,
  LiquidityPreset,
  LiquidityAdvanced,
  IVMetric,
  IVSlice,
} from "../types";
import { normalizeScopeMode } from "../savedView/savedViewSerializer";
import { deriveFilteredChains } from "./filters";

export type Listener = (
  state: OptionsViewState,
  prev: OptionsViewState,
) => void;

export type OptionsStore = {
  getState: () => OptionsViewState;
  setState: (patch: Partial<OptionsViewState>) => void;
  subscribe: (fn: Listener) => () => void;
};

export function createOptionsStore(
  initial?: Partial<OptionsViewState>,
): OptionsStore {
  let state: OptionsViewState = {
    response: null,
    selectedExpirationIdx: 0,
    selectedStrikeCount: 48,
    customExpirationIdxs: [],
    isLoading: false,
    scopeMode: "single" as ScopeMode,
    greeksBasis: "mid" as GreeksBasis,
    gammaSource: "schwab" as GexGammaSource,
    liquidityThreshold: 25,
    localWindowMode: "pct" as LocalWindowMode,
    localWindowPct: 10,
    localWindowDeltaRange: [0.25, 0.75] as [number, number],
    strikeMode: "count" as StrikeMode,
    strikeDollarWidth: 50,
    liquidityPreset: "normal" as LiquidityPreset,
    liquidityAdvanced: {
      spreadPct: 0.25,
      minVol: 0,
      minOI: 0,
      excludeStale: false,
    } as LiquidityAdvanced,
    expectedMoveMode: "straddle" as ExpectedMoveMode,
    ivMetric: "iv" as IVMetric,
    ivSlice: "atm" as IVSlice,
    expandedSections: new Set<SectionId>(["signal", "iv", "diagnostics"]),
    filteredChains: [],
    timestamp: "",
    ...initial,
  };
  state.scopeMode = normalizeScopeMode(state.scopeMode as any);

  const listeners = new Set<Listener>();

  return {
    getState: () => state,

    setState: (patch: Partial<OptionsViewState>) => {
      const prev = state;
      const nextPatch = { ...patch };
      if ("scopeMode" in nextPatch) {
        (nextPatch as any).scopeMode = normalizeScopeMode(
          (nextPatch as any).scopeMode,
        );
      }
      state = { ...state, ...nextPatch };

      const needsRefilter =
        patch.response !== undefined ||
        patch.selectedExpirationIdx !== undefined ||
        patch.customExpirationIdxs !== undefined ||
        patch.scopeMode !== undefined ||
        patch.selectedStrikeCount !== undefined ||
        patch.localWindowMode !== undefined ||
        patch.localWindowPct !== undefined ||
        patch.localWindowDeltaRange !== undefined ||
        patch.strikeMode !== undefined ||
        patch.strikeDollarWidth !== undefined ||
        patch.liquidityPreset !== undefined ||
        patch.liquidityAdvanced !== undefined ||
        patch.liquidityThreshold !== undefined;

      if (needsRefilter) {
        state.filteredChains = deriveFilteredChains(state);
      }

      listeners.forEach((fn) => fn(state, prev));
    },

    subscribe: (fn: Listener) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
