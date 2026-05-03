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

type TaskStats = {
  workerCalls: number;
  fallbackCalls: number;
  totalWorkerMs: number;
};

class ComputeWorkerPool {
  private worker: WorkerHandle | null = null;
  private supported: boolean | null = null;
  private initialized = false;
  private stats = new Map<string, TaskStats>();

  private recordWorker(task: string, elapsedMs: number): void {
    const s = this.stats.get(task) ?? {
      workerCalls: 0,
      fallbackCalls: 0,
      totalWorkerMs: 0,
    };
    s.workerCalls += 1;
    s.totalWorkerMs += elapsedMs;
    this.stats.set(task, s);
    if (s.workerCalls === 1) {
      log.info("worker.task.done", { task, elapsedMs: Math.round(elapsedMs) });
    }
  }

  private recordFallback(task: string): void {
    const s = this.stats.get(task) ?? {
      workerCalls: 0,
      fallbackCalls: 0,
      totalWorkerMs: 0,
    };
    s.fallbackCalls += 1;
    this.stats.set(task, s);
  }

  getStats(): Record<string, TaskStats & { avgWorkerMs: number }> {
    const result: Record<string, TaskStats & { avgWorkerMs: number }> = {};
    for (const [task, s] of this.stats) {
      result[task] = {
        ...s,
        avgWorkerMs:
          s.workerCalls > 0 ? Math.round(s.totalWorkerMs / s.workerCalls) : 0,
      };
    }
    return result;
  }

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

  async parseHoldings(rawJson: unknown): Promise<HoldingsResponse> {
    if (!this.ensureWorker()) {
      this.recordFallback("parseHoldings");
      return parseHoldingsResponse(rawJson);
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("parseHoldings", {
        rawJson,
      })) as HoldingsResponse;
      this.recordWorker("parseHoldings", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("holdings.parse.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("parseHoldings");
      return parseHoldingsResponse(rawJson);
    }
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
    // Convert Map to plain object for structured clone transfer
    const selCtx = selectionContext
      ? {
          mode: selectionContext.mode,
          byRequestDate: selectionContext.byRequestDate
            ? Object.fromEntries(selectionContext.byRequestDate)
            : undefined,
        }
      : undefined;

    if (!this.ensureWorker()) {
      this.recordFallback("processOptionsChain");
      const parsed = parseOptionChainsResponse(rawJson);
      const etlRows = buildExpiryMetricsRows(
        parsed,
        openingId,
        symbol,
        selectionContext,
      );
      return { parsed, etlRows };
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("processOptionsChain", {
        rawJson,
        openingId,
        symbol,
        selectionContext: selCtx,
      })) as {
        parsed: OptionsChainsResponse;
        etlRows: OptionCaptureExpiryMetricsRow[];
      };
      this.recordWorker("processOptionsChain", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("optionsChain.process.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("processOptionsChain");
      const parsed = parseOptionChainsResponse(rawJson);
      const etlRows = buildExpiryMetricsRows(
        parsed,
        openingId,
        symbol,
        selectionContext,
      );
      return { parsed, etlRows };
    }
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

    if (!this.ensureWorker()) {
      this.recordFallback("buildExpiryMetrics");
      return buildExpiryMetricsRows(
        parsedResponse,
        openingId,
        symbol,
        selectionContext,
      );
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("buildExpiryMetrics", {
        parsedResponse,
        openingId,
        symbol,
        selectionContext: selCtx,
      })) as OptionCaptureExpiryMetricsRow[];
      this.recordWorker("buildExpiryMetrics", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("expiryMetrics.build.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("buildExpiryMetrics");
      return buildExpiryMetricsRows(
        parsedResponse,
        openingId,
        symbol,
        selectionContext,
      );
    }
  }

  async parseOptionsChain(rawJson: unknown): Promise<OptionsChainsResponse> {
    if (!this.ensureWorker()) {
      this.recordFallback("parseOptionsChain");
      return parseOptionChainsResponse(rawJson);
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("parseOptionsChain", {
        rawJson,
      })) as OptionsChainsResponse;
      this.recordWorker("parseOptionsChain", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("optionsChain.parse.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("parseOptionsChain");
      return parseOptionChainsResponse(rawJson);
    }
  }

  async parseQuotes(rawJson: unknown): Promise<QuotesResponse> {
    if (!this.ensureWorker()) {
      this.recordFallback("parseQuotes");
      return parseQuotesResponse(rawJson);
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("parseQuotes", {
        rawJson,
      })) as QuotesResponse;
      this.recordWorker("parseQuotes", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("quotes.parse.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("parseQuotes");
      return parseQuotesResponse(rawJson);
    }
  }

  async computeBeta(
    stockBars: OHLCVBar[],
    marketBars: OHLCVBar[],
    horizon: BetaHorizon,
  ): Promise<BetaResult | null> {
    if (!this.ensureWorker()) {
      this.recordFallback("computeBeta");
      const { stockCloses, marketCloses } = alignBarsByDate(
        stockBars,
        marketBars,
      );
      return computeBetaMain(
        computeLogReturns(stockCloses),
        computeLogReturns(marketCloses),
        horizon,
      );
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("computeBeta", {
        stockBars,
        marketBars,
        horizon,
      })) as BetaResult | null;
      this.recordWorker("computeBeta", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("beta.compute.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("computeBeta");
      const { stockCloses, marketCloses } = alignBarsByDate(
        stockBars,
        marketBars,
      );
      return computeBetaMain(
        computeLogReturns(stockCloses),
        computeLogReturns(marketCloses),
        horizon,
      );
    }
  }

  async computeRollingBeta(
    stockBars: OHLCVBar[],
    marketBars: OHLCVBar[],
    windowSize: number,
    options?: RollingBetaOptions,
  ): Promise<RollingBetaPoint[]> {
    if (!this.ensureWorker()) {
      this.recordFallback("computeRollingBeta");
      return computeRollingBetaMain(stockBars, marketBars, windowSize, options);
    }

    const t0 = performance.now();
    try {
      const result = (await this.worker!.run("computeRollingBeta", {
        stockBars,
        marketBars,
        windowSize,
        options,
      })) as RollingBetaPoint[];
      this.recordWorker("computeRollingBeta", performance.now() - t0);
      return result;
    } catch (err) {
      log.debug("rollingBeta.compute.fallback", {
        error: (err as Error)?.message,
      });
      this.recordFallback("computeRollingBeta");
      return computeRollingBetaMain(stockBars, marketBars, windowSize, options);
    }
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
