import type{ DerivedState, HoldingsFrame } from "../../../shared/types/derived";
import type { TickerBetaBundle, ThreeFactorBundle } from "../../computation/beta/types";
import type { AllBenchmarkBetaData } from "../beta/BetaService";
import type { SymbolDelta } from "../ingestion/IngestionCoordinator";
import type { BalancesSnapshot } from "../../core/network/schwab/endpoints/balances";
import type { OrchestratorPhase } from "../../../shared/utils/time";

// ── Event map ────────────────────────────────────────────────────────────────

export type BackendEvents = {
  /** Full portfolio snapshot (holdings + derived + warnings + hierarchy). */
  "holdings:frame": HoldingsFrame;

  /** Account balances snapshot (1/s high-frequency polling). */
  balances: BalancesSnapshot;

  /** Current benchmark's beta data (switches instantly on setBenchmark). */
  "beta:updated": Map<string, TickerBetaBundle>;

  /** All benchmarks' beta data after a recalculation cycle. */
  "beta:allBenchmarks": AllBenchmarkBetaData;

  /** Three-factor orthogonal decomposition for scenario analysis. */
  "threeFactor:updated": Map<string, ThreeFactorBundle>;

  /** Holdings symbol delta after ingestion (added/removed/all). */
  "symbols:changed": SymbolDelta;

  /** DerivedState enriched with beta (emitted after beta enrichment). */
  "derived:enriched": DerivedState;

  /** Orchestrator phase changed (market/afterHours/preMarket/overnight/closed). */
  phaseChange: OrchestratorPhase;
};

