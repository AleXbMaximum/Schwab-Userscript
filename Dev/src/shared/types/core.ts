import type { HoldingsTableViewMode } from "../holdingsTableColumns";
import type { HoldingsResponse } from "./holdings";
import type {
  StreamerLike,
  StreamerUpdate,
} from "./streamer";

export type RiskLimits = {
  /** Ratio 0–1 (e.g. 0.75 = 75%) */
  maxMarginUtilizationPct?: number;
  maxBeta?: number; // e.g., 1.2

  /** Ratio 0–1 (e.g. 0.30 = 30% of total delta) */
  maxSingleUnderlyingDeltaPct?: number;
  /** Ratio 0–1 (e.g. 0.40 = 40% of portfolio) */
  maxSingleUnderlyingMarketValuePct?: number;

  maxNetDeltaShares?: number; // e.g., 5000
  maxAbsVegaPerVolPoint?: number; // e.g., 10000

  /** Ratio 0–1 (e.g. 0.05 = 5% of portfolio) */
  maxDailyLossPct?: number;
  maxDailyLossDollar?: number; // e.g., 5000
};

/** Per-underlying target allocation weight (underlyingKey -> target %, 0-100) */
export type TargetAllocations = Record<string, number>;

/** All rebalance display/evaluation dimensions */
export type RebalanceModeId =
  | "deltaDollarPct"
  | "betaPct"
  | "shares"
  | "deltaDollar"
  | "gamma"
  | "theta"
  | "vega";

/** Exposure modes that participate in the linked target system */
export type RebalanceAnchorMode =
  | "shares"
  | "deltaDollar"
  | "deltaDollarPct"
  | "betaPct";

/** Per-underlying target entry: anchor mode + user-set value */
export type RebalanceTargetEntry = {
  anchor: RebalanceAnchorMode;
  value: number;
};

/** Per-underlying anchor-based rebalance targets: { underlyingKey -> entry } */
export type RebalanceTargets = Record<string, RebalanceTargetEntry>;

export type RebalanceProfile = {
  id: string;
  name: string;
  createdAt: number;
  rebalanceTargets: RebalanceTargets;
};

export type AIProviderKind = "anthropic" | "openai" | "google";
export type OpenAIServiceTier = "auto" | "default" | "flex" | "priority";
export type OpenAIPricingTier = "standard" | "flex" | "batch";

/** Saved model profile with remembered parameters */
export type AIModelProfile = {
  id: string;
  name: string;
  provider: AIProviderKind;
  model: string;
  maxTokens?: number;
  temperature?: number;
  openAIServiceTier?: OpenAIServiceTier;
  openAIPricingTier?: OpenAIPricingTier;
};

export type AIDebateIntensity = "conservative" | "moderate" | "aggressive";

/** Tri-state override for a scheduler source (in-memory only, not persisted). */
export type SchedulerOverride = "auto" | "forceOn" | "forceOff";

export type Settings = {
  refreshInterval: number;
  holdingsRefreshInterval: number;
  quotesRefreshInterval: number;
  newsYahooMacroRefreshInterval?: number;
  newsYahooSymbolRefreshInterval?: number;
  newsBarronsRefreshInterval?: number;
  newsFinancialJuiceRefreshInterval?: number;
  newsSchwabRefreshInterval?: number;
  newsYahooMacroEnabled?: boolean;
  newsYahooSymbolEnabled?: boolean;
  newsBarronsEnabled?: boolean;
  newsFinancialJuiceEnabled?: boolean;
  newsSchwabEnabled?: boolean;
  isRefreshing: boolean;
  isHoldingsRefreshing: boolean;
  isQuotesRefreshing: boolean;
  enableStreamer: boolean;
  enableOvernightPrice?: boolean;
  enableBalances?: boolean;
  balancesRefreshInterval?: number;

  warningRulesJson?: string;

  holdingsTableViewModes: HoldingsTableViewMode[];
  holdingsTableActiveViewModeId: string;

  riskLimits?: RiskLimits;

  targetAllocations?: TargetAllocations;

  /** Multi-mode rebalance targets (independent per evaluation dimension) */
  rebalanceTargets?: RebalanceTargets;
  rebalanceProfiles?: RebalanceProfile[];

  accountSnapshotIntervalMs?: number;
  accountSnapshotRecordNight?: boolean;
  accountSnapshotAutoArchive?: boolean;
  accountSnapshotArchiveThreshold?: number;
  accountSnapshotRetentionDays?: number;

  /** Beta recalculation interval in ms. Default: 7_200_000 (2 hours). */
  betaRefreshIntervalMs?: number;

  /** Extra tickers to include in beta computation (not in holdings). */
  extraBetaTickers?: string[];
};

export type AppContext = {
  authToken: string | null;
  accountId: string | null;
  customerId?: string | null;
  settings: Settings;
  rawHoldings?: HoldingsResponse | null;
  storage?: unknown;
  streamer?: StreamerLike;
  lastUpdate: string;
  onUpdateSettings: (
    newSettings: Partial<Settings>,
    options?: { rerender?: boolean },
  ) => void;
};

export type HoldingsViewCtx = AppContext & {
  indicesContainer?: HTMLElement | null;
  totalsContainer?: HTMLElement | null;
  optionsStatus?: HTMLElement | null;
};

export type StreamerUpdates = StreamerUpdate[];

export type SettingsViewCtx = {
  settings: Settings;
  onUpdateSettings: (
    patch: Partial<Settings>,
    options?: { rerender?: boolean },
  ) => void;
};
