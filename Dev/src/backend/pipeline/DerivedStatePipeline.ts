import type{ DerivedState, HierarchicalHoldings, WarningState } from "../../shared/types/derived";
import type{ HoldingsResponse } from "../../shared/types/holdings";
import { computeDerivedMetrics } from "../computation/holdings/derivedMetrics";
import type { HoldingsIndex } from "./ingestion/HoldingsIndexBuilder";
import { UnderlyingAggregator } from "../computation/holdings/UnderlyingAggregator";
import { PortfolioAggregator } from "../computation/holdings/PortfolioAggregator";
import { ScenarioCalculator } from "../computation/holdings/ScenarioCalculator";
import { HierarchyBuilder } from "../computation/holdings/HierarchyBuilder";
import { normalizeNumbersDeepInPlace } from "../../shared/utils/numberNormalizer";
import { logService } from "../../shared/log/core/LogService";

const log = logService.namespace("stats");

export class DerivedStatePipeline {
  private underlyingAgg: UnderlyingAggregator;
  private portfolioAgg: PortfolioAggregator;
  private scenarioCalc: ScenarioCalculator;
  private hierarchyBuilder: HierarchyBuilder;

  constructor() {
    this.underlyingAgg = new UnderlyingAggregator();
    this.portfolioAgg = new PortfolioAggregator();
    this.scenarioCalc = new ScenarioCalculator();
    this.hierarchyBuilder = new HierarchyBuilder();
  }

  buildHierarchicalHoldings(
    holdings: HoldingsResponse,
    holdingsIndex: HoldingsIndex,
    derivedState: DerivedState,
    warningState?: WarningState | null,
  ): HierarchicalHoldings {
    return this.hierarchyBuilder.buildHierarchy(
      holdings,
      holdingsIndex,
      derivedState,
      warningState,
    );
  }

  computeFullDerivedState(holdingsIndex: HoldingsIndex): DerivedState {
    const span = log.span("computeFullDerivedState", {
      holdingsCount: holdingsIndex.size,
    });
    const derivedState: DerivedState = {
      byHoldingsKey: {},
      byUnderlying: {},
      portfolioAgg: {},
      asOfTs: Date.now(),
    };

    for (const [holdingsKey, meta] of holdingsIndex.entries()) {
      derivedState.byHoldingsKey[holdingsKey] = computeDerivedMetrics(meta.row);
    }

    derivedState.byUnderlying = this.underlyingAgg.buildUnderlyingAgg(
      holdingsIndex,
      derivedState.byHoldingsKey,
    );

    this.scenarioCalc.enrichWithScenarios(
      holdingsIndex,
      derivedState.byHoldingsKey,
      derivedState.byUnderlying,
    );

    this.underlyingAgg.enrichWithScenarioPnL(
      derivedState.byUnderlying,
      holdingsIndex,
      derivedState.byHoldingsKey,
    );

    // computePortfolioAgg reads uPnlUp/Dn from underlyingAgg directly,
    // so we skip the intermediate refreshSummaryRows here.
    derivedState.portfolioAgg = this.portfolioAgg.computePortfolioAgg(
      holdingsIndex,
      derivedState.byHoldingsKey,
      derivedState.byUnderlying,
    );

    this.underlyingAgg.applyPortfolioContext(
      derivedState.byUnderlying,
      derivedState.portfolioAgg,
    );

    // Single pass: propagates all underlyingAgg data (PnL + portfolio context)
    // to summary rows after all upstream mutations are complete.
    this.scenarioCalc.refreshSummaryRowsFromUnderlyingAgg(
      holdingsIndex,
      derivedState.byHoldingsKey,
      derivedState.byUnderlying,
    );

    this.scenarioCalc.enrichWithConcentration(
      holdingsIndex,
      derivedState.byHoldingsKey,
      derivedState.portfolioAgg,
    );

    normalizeNumbersDeepInPlace(derivedState, 6);

    span.end(
      "ok",
      {
        holdingsKeys: Object.keys(derivedState.byHoldingsKey).length,
        underlyingKeys: Object.keys(derivedState.byUnderlying).length,
      },
      "info",
    );
    return derivedState;
  }

  computeIncrementalDerivedState(
    holdingsIndex: HoldingsIndex,
    existingDerivedState: DerivedState,
    touchedHoldingsKeys: Set<string>,
    touchedUnderlyingKeys: Set<string>,
  ): void {
    if (touchedHoldingsKeys.size === 0) {
      return;
    }
    log.trace("computeIncrementalDerivedState", {
      touchedHoldings: touchedHoldingsKeys.size,
      touchedUnderlying: touchedUnderlyingKeys.size,
    });

    for (const holdingsKey of touchedHoldingsKeys) {
      const meta = holdingsIndex.get(holdingsKey);
      if (meta) {
        existingDerivedState.byHoldingsKey[holdingsKey] = computeDerivedMetrics(
          meta.row,
        );
      }
    }

    if (touchedUnderlyingKeys.size > 0) {
      const rebuilt = this.underlyingAgg.buildUnderlyingAgg(
        holdingsIndex,
        existingDerivedState.byHoldingsKey,
        touchedUnderlyingKeys,
      );
      touchedUnderlyingKeys.forEach((uk) => {
        if (rebuilt[uk]) {
          existingDerivedState.byUnderlying[uk] = rebuilt[uk];
        } else {
          delete (existingDerivedState.byUnderlying as any)[uk];
        }
      });
    }

    for (const holdingsKey of touchedHoldingsKeys) {
      const meta = holdingsIndex.get(holdingsKey);
      if (!meta) continue;

      const derived = existingDerivedState.byHoldingsKey[holdingsKey];

      this.scenarioCalc.enrichWithScenarios(
        new Map([[holdingsKey, meta]]),
        { [holdingsKey]: derived },
        existingDerivedState.byUnderlying,
      );
    }

    this.underlyingAgg.enrichWithScenarioPnL(
      existingDerivedState.byUnderlying,
      holdingsIndex,
      existingDerivedState.byHoldingsKey,
    );

    existingDerivedState.portfolioAgg = this.portfolioAgg.computePortfolioAgg(
      holdingsIndex,
      existingDerivedState.byHoldingsKey,
      existingDerivedState.byUnderlying,
    );

    this.underlyingAgg.applyPortfolioContext(
      existingDerivedState.byUnderlying,
      existingDerivedState.portfolioAgg,
    );

    this.scenarioCalc.refreshSummaryRowsFromUnderlyingAgg(
      holdingsIndex,
      existingDerivedState.byHoldingsKey,
      existingDerivedState.byUnderlying,
    );

    this.scenarioCalc.enrichWithConcentration(
      holdingsIndex,
      existingDerivedState.byHoldingsKey,
      existingDerivedState.portfolioAgg,
    );

    existingDerivedState.asOfTs = Date.now();

    // Only normalize touched subtrees instead of the entire derived state
    for (const hk of touchedHoldingsKeys) {
      if (existingDerivedState.byHoldingsKey[hk]) {
        normalizeNumbersDeepInPlace(existingDerivedState.byHoldingsKey[hk], 6);
      }
    }
    for (const uk of touchedUnderlyingKeys) {
      if (existingDerivedState.byUnderlying[uk]) {
        normalizeNumbersDeepInPlace(existingDerivedState.byUnderlying[uk], 6);
      }
    }
    if (existingDerivedState.portfolioAgg) {
      normalizeNumbersDeepInPlace(existingDerivedState.portfolioAgg, 6);
    }
  }
}
