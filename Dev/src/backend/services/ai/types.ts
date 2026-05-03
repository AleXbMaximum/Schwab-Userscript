import type { AIDebateIntensity, AIProviderKind } from "shared/types/core";
import type { OHLCVBar } from "shared/types/chartData";
import type {
  FundamentalsData,
  NewsItem,
  BalanceSheetData,
  CashFlowData,
  IncomeStatementData,
  InsiderTransaction,
} from "shared/types/marketData";
import type { BarronsDataBundle } from "../../core/network/barrons/types";

// ── Agent roles ───────────────────────────────────────────────────────────────

export type AIAgentRole =
  | "market_analyst"
  | "fundamentals_analyst"
  | "technicals_analyst"
  | "financial_quality_analyst"
  | "sentiment_company"
  | "sentiment_macro"
  | "sellside_analyst"
  | "ownership_analyst"
  | "bull_debater"
  | "bear_debater"
  | "research_manager"
  | "trader"
  | "risk_analyst_aggressive"
  | "risk_analyst_conservative"
  | "risk_analyst_neutral"
  | "risk_manager";

export type AIStageStatus = "pending" | "running" | "done" | "error";

export type AIStageResult = {
  role: AIAgentRole;
  /** Display override — e.g. "Bull Advocate (Round 2)" */
  label?: string;
  status: AIStageStatus;
  content: string;
  tokensUsed?: number;
  durationMs?: number;
  errorMessage?: string;
  /** Number of tool calls executed during this agent's run */
  toolCallsMade?: number;
  /** System prompt sent to the LLM for this stage */
  systemPrompt?: string;
  /** Full input message history (user turns + any tool-call assistant/user exchanges) */
  inputMessages?: LLMMessage[];
  /** Machine-readable JSON summary parsed from end of analyst response (suggestion 8) */
  summaryJSON?: Record<string, unknown>;
  /** Accumulated thinking/reasoning content shown during streaming. */
  thinkingContent?: string;
  /** Web search citations collected during streaming. */
  citations?: Citation[];
};

// ── Data quality flags ──────────────────────────────────────────────────────

export type DataQualityFlags = {
  overallGrade: "high" | "medium" | "low" | "critical";
  missingFields: string[];
  staleFields: Record<string, number>;
  conflictFlags: string[];
  fundamentalsComplete: boolean;
  estimatesAvailable: boolean;
  holdersStale: boolean;
};

// ── Technical indicators ────────────────────────────────────────────────────

export type TechnicalIndicators = {
  sma20?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  ema12?: number | null;
  ema26?: number | null;
  rsi14?: number | null;
  macdLine?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;
  bollingerUpper?: number | null;
  bollingerMiddle?: number | null;
  bollingerLower?: number | null;
  atr14?: number | null;
  obvTrend?: "rising" | "falling" | "flat" | null;
  trendDirection?: "uptrend" | "downtrend" | "sideways" | null;
};

// ── Data integrity gate ───────────────────────────────────────────────────────

export type DataCompletenessResult = {
  missingFields: string[];
  criticalMissing: boolean;
};

// ── OHLCV feature bundle (pre-computed for technicals analyst) ────────────────

export type SwingPoint = { date: string; price: number; type: "high" | "low" };

export type VolumeProfileBucket = {
  priceFrom: number;
  priceTo: number;
  totalVolume: number;
};

export type GapStats = {
  totalGaps: number;
  upGaps: number;
  downGaps: number;
  avgMagnitudePct: number;
  recentGaps: Array<{
    date: string;
    direction: "up" | "down";
    magnitudePct: number;
  }>;
};

export type OHLCVFeatures = {
  rsiSeries: number[]; // last 20 RSI values
  swingHighs: SwingPoint[]; // last 5 swing highs
  swingLows: SwingPoint[]; // last 5 swing lows
  vwap: number | null;
  volumeProfile: VolumeProfileBucket[]; // top 3 zones by volume
  gapStats: GapStats;
};

export type MarketDataBundle = {
  symbol: string;
  currentPrice: number | null;
  ohlcv90d: OHLCVBar[];
  fundamentals: FundamentalsData;
  news: NewsItem[];
  technicals: TechnicalIndicators;
  /** Quarterly balance sheet data (last 4 quarters) */
  balanceSheet: BalanceSheetData | null;
  /** Quarterly cash flow data (last 4 quarters) */
  cashFlow: CashFlowData | null;
  /** Quarterly income statement data (last 4 quarters) */
  incomeStatement: IncomeStatementData | null;
  /** Recent insider buy/sell transactions */
  insiderTransactions: InsiderTransaction[] | null;
  /** Global market / macro news (not company-specific) */
  globalMacroNews: NewsItem[] | null;
  /** Barron's supplementary data (null if fetch failed or unavailable) */
  barrons: BarronsDataBundle | null;
  fetchedAt: string;
  dataSource:
    | "yahoo_finance"
    | "alpha_vantage"
    | "mixed"
    | "yahoo_barrons"
    | "mixed_barrons";
};

// ── Memory system ─────────────────────────────────────────────────────────────

export type MemoryEntry = {
  id: string;
  symbol: string;
  date: string;
  action: string;
  conviction: number;
  summary: string;
  keyBullPoints: string[];
  keyBearPoints: string[];
  priceAtAnalysis?: number | null;
};

// ── Tool-calling ──────────────────────────────────────────────────────────────

export type AIToolName =
  | "get_balance_sheet"
  | "get_cash_flow"
  | "get_income_statement"
  | "get_insider_transactions"
  | "get_global_macro_news"
  | "get_barrons_news"
  | "get_barrons_ratings"
  | "get_barrons_financials";

export type AIToolCall = {
  name: AIToolName;
};

// ── Per-phase model override ──────────────────────────────────────────────────

export type AIPipelinePhaseConfig = {
  /** AIModelProfile.id or built-in model key; undefined = use global default */
  modelProfileId?: string;
};

export type AIPipelinePhaseOverrides = {
  analysts?: AIPipelinePhaseConfig;
  debate?: AIPipelinePhaseConfig;
  trader?: AIPipelinePhaseConfig;
  risk?: AIPipelinePhaseConfig;
};

// ── Pipeline configuration ────────────────────────────────────────────────────

export type AIAnalysisConfig = {
  /** Number of bull/bear debate rounds (2–5, default 2) */
  maxDebateRounds?: number;
  /** Number of risk analyst debate rounds (1–3, default 2) */
  maxRiskRounds?: number;
  /** Which analyst agents to run (default: all eight) */
  selectedAnalysts?: (
    | "market"
    | "fundamentals"
    | "sentiment_company"
    | "sentiment_macro"
    | "technicals"
    | "financial_quality"
    | "sellside"
    | "ownership"
  )[];
  /** Inject past analysis memories into agent context (default true) */
  enableMemory?: boolean;
  /** Allow agents to call data-fetch tools mid-analysis (default true) */
  enableToolCalling?: boolean;
  /** Max tool call iterations per agent (1–3, default 2) */
  maxToolIterations?: number;
  /** Per-phase LLM provider+model overrides */
  pipelineConfig?: AIPipelinePhaseOverrides;
  /** Debate aggressiveness — affects bull/bear prompt tone */
  debateIntensity?: AIDebateIntensity;
  /** Temperature override for debate phase (0.0–1.0) */
  debateHeat?: number;
  /** Optional one-line investor focus topic (e.g. "Buy 180 call") — steers all agents */
  focusTopic?: string;
  /** Enable SSE streaming for real-time token display (default false). */
  enableStreaming?: boolean;
  /** Enable provider-native web search for grounding (OpenAI/Gemini only, default false). */
  enableWebSearch?: boolean;
};

// ── Final decision ────────────────────────────────────────────────────────────

export type AIFinalDecision = {
  action: "BUY" | "SELL" | "HOLD" | "STRONG_BUY" | "STRONG_SELL";
  conviction: number;
  targetPrice?: number | null;
  stopLoss?: number | null;
  timeHorizon: "short_term" | "medium_term" | "long_term";
  riskLevel: "low" | "medium" | "high";
  keyBullPoints: string[];
  keyBearPoints: string[];
  riskFactors: string[];
  summary: string;
  // ── Extended fields (suggestions 7 + 9) ──────────────────────────────────
  entryTriggers: Array<{
    trigger_type: "close" | "intraday";
    level: number;
    confirmations: string[];
  }>;
  invalidationLevel: number | null;
  scalePlan: Array<{
    condition: string;
    targetPositionPct: number;
    riskRationale: string;
  }>;
  hedgeSuggestion: string | null;
  watchlistPlan: string | null;
  gapRiskMitigation: string[];
  positionNowPct: number | null;

  // ── Composite scores aggregated from each analyst ────────────────────────
  compositeScores?: {
    // From market_analyst
    trend: "bullish" | "bearish" | "sideways";
    trendStrength: number;
    // From technicals_analyst
    technicalBias: "bullish" | "bearish" | "neutral";
    rsiState: "overbought" | "oversold" | "neutral";
    macdState: "bullish_cross" | "bearish_cross" | "converging" | "diverging";
    // From fundamentals_analyst (refactored)
    valuationGrade: "cheap" | "fair" | "expensive";
    growthTrajectory: "accelerating" | "stable" | "decelerating";
    // From financial_quality_analyst
    qualityScore: number;
    marginTrend: "expanding" | "stable" | "compressing";
    earningsStability: "high" | "medium" | "low";
    cashConversionScore: number;
    capitalReturnScore: number;
    // From sellside_analyst
    revisionMomentum: "strong_up" | "up" | "flat" | "down" | "strong_down";
    surpriseTrend: "consistent_beat" | "mixed" | "consistent_miss";
    targetDispersion: number;
    ratingMigration: number;
    expectationGap: number;
    nextCatalystDate: string | null;
    nextCatalystType: "earnings" | "guidance" | "ex_dividend" | "other";
    // From ownership_analyst
    shortInterestPctFloat: number;
    shortInterestChange: number;
    crowdingRisk: "high" | "medium" | "low";
    ownershipDataStaleness: "fresh" | "moderate" | "stale";
    topHolderConcentration: number;
    // From sentiment (split)
    companySentiment: "positive" | "neutral" | "negative";
    macroRegime: "risk_on" | "neutral" | "risk_off";
    catalystDensity: "high" | "medium" | "low";
  } | null;

  // ── Data quality transparency ────────────────────────────────────────────
  dataQuality?: {
    overallGrade: "high" | "medium" | "low" | "critical";
    convictionCeiling: number;
    staleDataWarnings: string[];
    missingAnalysis: string[];
  } | null;

  // ── Aggregate scores (weighted across dimensions) ────────────────────────
  aggregateScore?: {
    bullScore: number;
    bearScore: number;
    netScore: number;
    confidenceInterval: [number, number];
    dominantFactor: string;
  } | null;
};

// ── Analysis record (persisted in IndexedDB via KVStore) ──────────────────────

export type AIAnalysisStatus =
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type AIAnalysisRecord = {
  id: string;
  symbol: string;
  /** Optional investor focus topic that steered this analysis */
  focusTopic?: string;
  requestedAt: string;
  completedAt: string | null;
  status: AIAnalysisStatus;
  provider: AIProviderKind;
  model: string;
  marketData: MarketDataBundle | null;
  stages: AIStageResult[];
  finalDecision: AIFinalDecision | null;
  totalTokensUsed: number;
  totalDurationMs: number;
  errorMessage?: string;
  /** Reserved for future calibration system */
  outcome?: {
    priceAt1w?: number;
    priceAt1m?: number;
    priceAt3m?: number;
    outcomeGrade?: "correct" | "partially_correct" | "incorrect";
  };
};

// ── Orchestrator state (passed to progress callbacks) ────────────────────────

export type AIAnalysisPhase =
  | "idle"
  | "fetching_data"
  | "running_analysts"
  | "running_debate"
  | "running_trader"
  | "running_risk"
  | "finalizing"
  | "complete"
  | "error";

export type AIAnalysisState = {
  recordId: string;
  symbol: string;
  phase: AIAnalysisPhase;
  progress: number;
  progressLabel: string;
  stages: AIStageResult[];
  finalDecision: AIFinalDecision | null;
  error: string | null;
  startedAt: number;
};

export type AIProgressCallback = (state: AIAnalysisState) => void;

// ── LLM client types ──────────────────────────────────────────────────────────

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMRequestOptions = {
  messages: LLMMessage[];
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Enable provider-native web search (OpenAI/Gemini only). */
  webSearch?: boolean;
  /** Cancellation signal for streaming requests. */
  signal?: AbortSignal;
};

export type LLMResponse = {
  content: string;
  tokensUsed: number;
  model: string;
  /** Provider-specific finish reason when available (e.g., 'stop', 'length'). */
  finishReason?: string;
  /** Provider-specific reasoning token usage when available. */
  reasoningTokens?: number;
};

// ── Streaming types ──────────────────────────────────────────────────────────

export type StreamChunkType =
  | "text"
  | "thinking"
  | "annotation"
  | "done"
  | "error";

export type Citation = {
  url: string;
  title: string;
  startIndex: number;
  endIndex: number;
};

export type StreamChunk = {
  type: StreamChunkType;
  /** Incremental text (for 'text' | 'thinking'). */
  delta?: string;
  /** Web search citation (for 'annotation'). */
  annotation?: Citation;
  /** Final token count (on 'done'). */
  tokensUsed?: number;
  /** Reasoning token count (on 'done'). */
  reasoningTokens?: number;
  /** Provider finish reason (on 'done'). */
  finishReason?: string;
  /** Error message (on 'error'). */
  error?: string;
};

// ── Stream event types (orchestrator -> frontend) ────────────────────────────

export type AIStreamEvent =
  | {
      type: "stage_text";
      role: AIAgentRole;
      label?: string;
      delta: string;
      accumulated: string;
    }
  | {
      type: "stage_thinking";
      role: AIAgentRole;
      label?: string;
      delta: string;
      accumulated: string;
    }
  | {
      type: "stage_annotation";
      role: AIAgentRole;
      label?: string;
      annotation: Citation;
    }
  | { type: "stage_done"; role: AIAgentRole; label?: string };

export type AIStreamCallback = (event: AIStreamEvent) => void;
