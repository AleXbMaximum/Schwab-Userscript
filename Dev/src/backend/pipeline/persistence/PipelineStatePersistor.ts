import type{ HoldingsResponse } from "../../../shared/types/holdings";
import type { Logger } from "../../../shared/log/Logger";

type StorageLike = {
  set?: (
    key: string,
    value: unknown,
    options?: { immediate?: boolean; silent?: boolean },
  ) => unknown;
};

const RAW_HOLDINGS_PERSIST_MIN_INTERVAL_MS = 15_000;

export class PipelineStatePersistor {
  private readonly logger: Logger;
  private readonly getStorage: () => StorageLike | undefined;

  private lastRawHoldingsPersistAt = 0;
  private pendingRawHoldingsPersist: HoldingsResponse | null = null;
  private pendingRawHoldingsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(logger: Logger, getStorage: () => StorageLike | undefined) {
    this.logger = logger;
    this.getStorage = getStorage;
  }

  persistRawHoldings(data: HoldingsResponse): void {
    try {
      this.scheduleRawHoldingsPersist(data);
    } catch (err) {
      this.logger.error("persistRawHoldingsFailed", {
        error: (err as Error)?.message ?? String(err),
      });
    }
  }

  private scheduleRawHoldingsPersist(data: HoldingsResponse): void {
    this.pendingRawHoldingsPersist = data;
    const elapsed = Date.now() - this.lastRawHoldingsPersistAt;
    const dueNow =
      this.lastRawHoldingsPersistAt === 0 ||
      elapsed >= RAW_HOLDINGS_PERSIST_MIN_INTERVAL_MS;

    if (dueNow && this.pendingRawHoldingsTimer === null) {
      this.flushRawHoldingsPersist();
      return;
    }

    if (this.pendingRawHoldingsTimer !== null) {
      return;
    }

    const delay = Math.max(0, RAW_HOLDINGS_PERSIST_MIN_INTERVAL_MS - elapsed);
    this.pendingRawHoldingsTimer = setTimeout(() => {
      this.pendingRawHoldingsTimer = null;
      this.flushRawHoldingsPersist();
    }, delay);
  }

  flushRawHoldingsPersist(): void {
    const pending = this.pendingRawHoldingsPersist;
    if (!pending) return;

    try {
      const storage = this.getStorage();
      if (!storage || typeof storage.set !== "function") return;
      storage.set("rawHoldings", pending, { silent: true });
      storage.set("lastUpdate", new Date().toISOString(), { silent: true });
      this.lastRawHoldingsPersistAt = Date.now();
      this.pendingRawHoldingsPersist = null;
    } catch (err) {
      this.logger.error("persistRawHoldingsFailed", {
        error: (err as Error)?.message ?? String(err),
      });
    }
  }

  persistBetaData(serialized: Record<string, unknown>): void {
    try {
      const storage = this.getStorage();
      if (storage && typeof storage.set === "function") {
        storage.set("betaData", serialized, { immediate: true, silent: true });
      }
    } catch (err) {
      this.logger.error("persistBetaDataFailed", {
        error: (err as Error)?.message ?? String(err),
      });
    }
  }

  dispose(): void {
    if (this.pendingRawHoldingsTimer) {
      clearTimeout(this.pendingRawHoldingsTimer);
      this.pendingRawHoldingsTimer = null;
    }
    this.flushRawHoldingsPersist();
  }
}
