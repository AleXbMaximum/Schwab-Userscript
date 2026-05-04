import type{ HoldingsResponse, QuotesResponse } from "../../../shared/types/holdings";
import type{ OptionsChainsResponse } from "../../../shared/types/options";
import type { OHLCVBar } from "shared/types/chartData";
import type { OptionCaptureExpiryMetricsRow } from "../../core/db/capture/optionMonitorTypes";
import type { ExpirySelectionContext } from "../options/monitor/etl/ExpiryMetricsETL";
import type {
  BetaResult,
  BetaHorizon,
  RollingBetaPoint,
  RollingBetaOptions,
} from "../beta/types";
import { parseHoldingsResponse } from "../../core/network/schwab/parsing/holdingsParser";
import { parseOptionChainsResponse } from "../../core/network/schwab/parsing/optionsParser";
import { parseQuotesResponse } from "../../core/network/schwab/parsing/quotesParser";
import { buildExpiryMetricsRows } from "../options/monitor/etl/ExpiryMetricsETL";
import {
  alignBarsByDate,
  computeLogReturns,
  computeBeta as computeBetaMain,
} from "../beta/singleFactor";
import { computeRollingBeta as computeRollingBetaMain } from "../beta/rolling";
import { WorkerHandle } from "./WorkerHandle";
import { COMPUTE_WORKER_CODE } from "./computeWorkerCode";
import { logService } from "../../../shared/log/core/LogService";

const log = logService.namespace("worker");

class ComputeWorkerPool {
  private worker: WorkerHandle | null = null;
  private supported: boolean | null = null;
  private initialized = false;

  get isAvailable(): boolean {
    if (this.supported === null) {
      try {
        this.supported =
          typeof Worker !== "undefined" &&
          typeof Blob !== "undefined" &&
          typeof URL !== "undefined" &&
          typeof URL.createObjectURL === "function";
      } catch {
        this.supported = false;
      }
    }
    return this.supported;
  }

  private ensureWorker(): boolean {
    if (this.initialized) return this.worker != null;
    this.initialized = true;

    if (!this.isAvailable) {
      log.info("worker.notSupported");
      return false;
    }

    try {
      this.worker = new WorkerHandle(COMPUTE_WORKER_CODE);
      log.info("worker.create.done");
      return true;
    } catch (err) {
      log.warn("worker.create.fail", {
        error: (err as Error)?.message ?? String(err),
      });
      this.supported = false;
      return false;
    }
  }

  private async runOrFallback<T>(
    task: string,
    payload: Record<string, unknown>,
    fallback: () => T | Promise<T>,
    fallbackLogKey: string,
  ): Promise<T> {
    if (!this.ensureWorker()) return fallback();
    try {
      return (await this.worker!.run(task, payload)) as T;
    } catch (err) {
      log.debug(fallbackLogKey, { error: (err as Error)?.message });
      return fallback();
    }
  }

  async parseHoldings(rawJson: unknown): Promise<HoldingsResponse> {
    return this.runOrFallback(
      "parseHoldings",
      { rawJson },
      () => parseHoldingsResponse(rawJson),
      "holdings.parse.fallback",
    );
  }

  async processOptionsChain(
    rawJson: unknown,
    openingId: string,
    symbol: string,
    selectionContext?: ExpirySelectionContext,
  ): Promise<{
    parsed: OptionsChainsResponse;
    etlRows: OptionCaptureExpiryMetricsRow[];
  }> {
    const selCtx = selectionContext
      ? {
          mode: selectionContext.mode,
          byRequestDate: selectionContext.byRequestDate
            ? Object.fromEntries(selectionContext.byRequestDate)
            : undefined,
        }
      : undefined;
    return this.runOrFallback(
      "processOptionsChain",
      { rawJson, openingId, symbol, selectionContext: selCtx },
      () => {
        const parsed = parseOptionChainsResponse(rawJson);
        const etlRows = buildExpiryMetricsRows(
          parsed,
          openingId,
          symbol,
          selectionContext,
        );
        return { parsed, etlRows };
      },
      "optionsChain.process.fallback",
    );
  }

  async buildExpiryMetrics(
    parsedResponse: OptionsChainsResponse,
    openingId: string,
    symbol: string,
    selectionContext?: ExpirySelectionContext,
  ): Promise<OptionCaptureExpiryMetricsRow[]> {
    const selCtx = selectionContext
      ? {
          mode: selectionContext.mode,
          byRequestDate: selectionContext.byRequestDate
            ? Object.fromEntries(selectionContext.byRequestDate)
            : undefined,
        }
      : undefined;
    return this.runOrFallback(
      "buildExpiryMetrics",
      { parsedResponse, openingId, symbol, selectionContext: selCtx },
      () =>
        buildExpiryMetricsRows(
          parsedResponse,
          openingId,
          symbol,
          selectionContext,
        ),
      "expiryMetrics.build.fallback",
    );
  }

  async parseOptionsChain(rawJson: unknown): Promise<OptionsChainsResponse> {
    return this.runOrFallback(
      "parseOptionsChain",
      { rawJson },
      () => parseOptionChainsResponse(rawJson),
      "optionsChain.parse.fallback",
    );
  }

  async parseQuotes(rawJson: unknown): Promise<QuotesResponse> {
    return this.runOrFallback(
      "parseQuotes",
      { rawJson },
      () => parseQuotesResponse(rawJson),
      "quotes.parse.fallback",
    );
  }

  async computeBeta(
    stockBars: OHLCVBar[],
    marketBars: OHLCVBar[],
    horizon: BetaHorizon,
  ): Promise<BetaResult | null> {
    return this.runOrFallback(
      "computeBeta",
      { stockBars, marketBars, horizon },
      () => {
        const { stockCloses, marketCloses } = alignBarsByDate(
          stockBars,
          marketBars,
        );
        return computeBetaMain(
          computeLogReturns(stockCloses),
          computeLogReturns(marketCloses),
          horizon,
        );
      },
      "beta.compute.fallback",
    );
  }

  async computeRollingBeta(
    stockBars: OHLCVBar[],
    marketBars: OHLCVBar[],
    windowSize: number,
    options?: RollingBetaOptions,
  ): Promise<RollingBetaPoint[]> {
    return this.runOrFallback(
      "computeRollingBeta",
      { stockBars, marketBars, windowSize, options },
      () => computeRollingBetaMain(stockBars, marketBars, windowSize, options),
      "rollingBeta.compute.fallback",
    );
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initialized = false;
  }
}

export const computeWorkerPool = new ComputeWorkerPool();
