/**
 * MonitorRuntime — the state surface that scheduler/fetch helpers operate on.
 *
 * MonitorController implements this interface; the extracted free functions
 * (in monitorScheduler.ts, monitorFetchPipeline.ts) take a `MonitorRuntime`
 * rather than the full class so they can be tested and reasoned about
 * independently.
 */

import type { OptionsChainsResponse } from "shared/types/options";
import type { MonitorSettings } from "./monitorSettings";
import type { SymbolUniverseCacheEntry } from "./monitorUniverse";

export type MonitorSymbolUpdate = {
  symbol: string;
  capturedAt: string;
  dataTimestamp: string;
  localStored: boolean;
  /** True when a fresh (non-duplicate) snapshot was written to IndexedDB. */
  dbPersisted: boolean;
};

export type MonitorResponseCacheEntry = {
  response: OptionsChainsResponse;
  capturedAt: string;
};

export interface MonitorRuntime {
  /** Live auth token (mutated by setAuthToken). */
  readonly authToken: string | null;
  /** Live settings — same object on every read, mutated in place. */
  readonly settings: Readonly<MonitorSettings>;
  /** Symbol → most recent fetch response (mutable). */
  readonly responseCache: Map<string, MonitorResponseCacheEntry>;
  /** Symbol → cached universe-selection state (mutable). */
  readonly universeBySymbol: Map<string, SymbolUniverseCacheEntry>;
  /** Set of symbols currently being persisted to IndexedDB (mutable). */
  readonly dbWriteInProgress: Set<string>;

  isEnabled(): boolean;
  isRunning(): boolean;
  setRunning(value: boolean): void;
  getTopNForSymbol(symbol: string): number;

  refreshSymbol(symbol: string): Promise<OptionsChainsResponse | null>;
  scheduleNext(): void;
  broadcast(text: string, color?: string): void;
  broadcastSymbolUpdate(update: MonitorSymbolUpdate): void;
}
