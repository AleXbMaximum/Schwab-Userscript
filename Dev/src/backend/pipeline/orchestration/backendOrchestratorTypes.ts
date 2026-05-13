import type { HoldingsResponse } from "../../../shared/types/holdings";

export interface BackendOrchestratorOptions {
  refreshIntervalMs?: number;
  holdingsRefreshInterval?: number;
  quotesRefreshInterval?: number;
  betaRefreshIntervalMs?: number;
  enableStreamer: boolean;
  enableOvernightPrice: boolean;
  warningRulesJson?: string | null;
  balancesRefreshInterval?: number;
}

export type StorageLike = {
  set?: (
    key: string,
    value: unknown,
    options?: { immediate?: boolean; silent?: boolean },
  ) => unknown;
};

/** Minimal subset of AppContext that the backend needs. */
export interface BackendContext {
  authToken: string | null;
  accountId: string | null;
  customerId?: string | null;
  settings: Record<string, any>;
  rawHoldings?: HoldingsResponse | null;
  betaData?: unknown;
  lastUpdate?: string;
  storage?: StorageLike;
}

export const DEFAULT_BETA_RECALC_INTERVAL_MS = 7_200_000;

/** Dedupe a heterogeneous symbol list and uppercase it. Empty entries dropped. */
export function normalizeSymbolsUnique(symbols: unknown[]): string[] {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const item of symbols) {
    const symbol = typeof item === "string" ? item.toUpperCase().trim() : "";
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    next.push(symbol);
  }
  return next;
}
