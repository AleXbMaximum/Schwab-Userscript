import type{ OptionsChain, OptionsChainsResponse } from "shared/types/options";
import type {
  GreeksBasis as GreeksBasisType,
  GexGammaSource as GexGammaSourceType,
  ExpectedMoveMode as ExpectedMoveModeType,
} from "backend/computation/options/types";

// Component lifecycle types
export type ComponentRef = HTMLElement & {
  cleanup?: () => void;
  update?: (...args: any[]) => void;
};
export type ResizableComponentRef = ComponentRef & { resize?: () => void };
export type StatusDotState = "active" | "refreshing" | "error" | "inactive";

// UI-specific types (frontend only)
export type ScopeMode = "single" | "multi" | "all";
export type SectionId = "signal" | "iv" | "diagnostics";
export type ColumnId = SectionId;

export type CardSpan = 1 | 2 | 3;
export type CardNature = "chart" | "text" | "interactive";
export type AlertSeverity = "P0" | "P1";
export type AlertItem = {
  severity: AlertSeverity;
  reason: string;
  cardId: string;
  sectionId: SectionId;
};
export type LocalWindowMode = "all" | "pct" | "delta";

export type StrikeMode = "auto" | "count" | "dollarWidth";

export type LiquidityPreset = "strict" | "normal" | "loose" | "advanced";
export type LiquidityAdvanced = {
  spreadPct: number;
  minVol: number;
  minOI: number;
  excludeStale: boolean;
};

export type IVMetric = "iv" | "totalVariance" | "forwardVariance";
export type IVSlice = "atm" | "25delta" | "10delta";

export type ActiveFilterState = {
  scopeMode: ScopeMode;
  localWindowMode: LocalWindowMode;
  localWindowPct: number;
  localWindowDeltaRange: [number, number];
  liquidityPreset: LiquidityPreset;
  greeksBasis: GreeksBasisType;
  gammaSource: GexGammaSourceType;
  strikeMode: StrikeMode;
  selectedStrikeCount: number;
  strikeDollarWidth: number;
};

export type StateVectorFilterCallbacks = {
  onResetScope?: () => void;
  onResetLocalWindow?: () => void;
  onResetLiquidity?: () => void;
  onResetGreeks?: () => void;
  onResetStrikes?: () => void;
};

export type FocusStrikePopupData = {
  strike: number;
  callOI: number | null;
  putOI: number | null;
  callVol: number | null;
  putVol: number | null;
  callIV: number | null;
  putIV: number | null;
  callSpreadPct: number | null;
  putSpreadPct: number | null;
  callDelta: number | null;
  putDelta: number | null;
  callGamma: number | null;
  putGamma: number | null;
  netGex: number | null;
};

export type OptionsViewState = {
  response: OptionsChainsResponse | null;
  selectedExpirationIdx: number;
  selectedStrikeCount: number; // 0 = All
  customExpirationIdxs: number[];
  isLoading: boolean;

  scopeMode: ScopeMode;
  greeksBasis: GreeksBasisType;
  gammaSource: GexGammaSourceType;
  liquidityThreshold: number; // effective bid-ask spread %, derived from preset
  localWindowMode: LocalWindowMode;
  localWindowPct: number;
  localWindowDeltaRange: [number, number]; // e.g. [0.25, 0.75] for 25D-75D
  strikeMode: StrikeMode;
  strikeDollarWidth: number;
  liquidityPreset: LiquidityPreset;
  liquidityAdvanced: LiquidityAdvanced;
  expectedMoveMode: ExpectedMoveModeType;

  ivMetric: IVMetric;
  ivSlice: IVSlice;

  expandedSections: Set<SectionId>;

  filteredChains: OptionsChain[];
  timestamp: string;
};
