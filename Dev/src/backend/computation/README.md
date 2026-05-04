# Backend Computation

## Purpose

`backend/computation/` contains reusable calculation logic for holdings, beta, options, risk, rebalance, and worker-backed CPU-heavy tasks.

## Owns

- holdings aggregation, derived metrics, and rendering helpers
- beta and factor calculations
- options analytics, monitor ETL helpers, Black–Scholes / IV math primitives
- risk and rebalance modeling
- worker wrappers for heavy computation

## Does Not Own

- network transport
- persistent storage
- long-lived orchestration state
- DOM rendering

## Subdirectory Map

| Subdir | Purpose |
| --- | --- |
| `holdings/aggregators/` | `HierarchyBuilder.ts`, `PortfolioAggregator.ts`, `UnderlyingAggregator.ts`, `ScenarioCalculator.ts` (now exported as module functions, no longer a class), `hierarchyTotals.ts` |
| `holdings/metrics/` | `derivedMetrics.ts` (formerly `computeDerivedMetrics.ts`), `accountOverviewMetrics.ts`, `valueExtractors.ts` |
| `holdings/rendering/` | `balancesOverlay.ts`, `hierarchyRowBuilders.ts`, `warningsEngine.ts` |
| `beta/` | `singleFactor.ts`, `threeFactor.ts`, `rolling.ts`, `alignment.ts`, `betaEnrichment.ts`, `linkedBenchmark.ts`, `types.ts` |
| `risk/` | `RiskMetricsCalculator.ts` (module of exported functions, not a class), `coreMetrics.ts`, `aggregateHelpers.ts` (`sumByField` shared with `coreMetrics`), `betaFactorScenario.ts`, `types.ts` |
| `rebalance/` | `RebalanceCalculator.ts` (module functions) |
| `math/` | `blackScholes.ts`, `impliedVolatility.ts`, `normalDist.ts` (math primitives consolidated from former duplicates) |
| `options/` | `gex.ts`, `bsGex.ts`, `greeks.ts`, `greeksValidation.ts`, `expectedMove.ts`, `volatility.ts`, `chainHelpers.ts`, `distribution.ts`, `quality.ts`, `summary.ts`, `types.ts` |
| `options/monitor/` | `StrikeLegs.ts` and `etl/` (`ExpiryMetricsETL.ts`, `LabelBackfill.ts`); the legacy `MetaETL` was inlined into `monitorCapture.ts` |
| `workers/` | `ComputeWorkerPool.ts` (uses the `runOrFallback` helper), `WorkerHandle.ts`, `computeWorkerCode.ts`, `computeCode/` |

## Key Entry Files

- [`holdings/metrics/derivedMetrics.ts`](holdings/metrics/derivedMetrics.ts)
- [`holdings/aggregators/HierarchyBuilder.ts`](holdings/aggregators/HierarchyBuilder.ts)
- [`holdings/aggregators/ScenarioCalculator.ts`](holdings/aggregators/ScenarioCalculator.ts)
- [`beta/singleFactor.ts`](beta/singleFactor.ts)
- [`risk/RiskMetricsCalculator.ts`](risk/RiskMetricsCalculator.ts)
- [`risk/aggregateHelpers.ts`](risk/aggregateHelpers.ts)
- [`rebalance/RebalanceCalculator.ts`](rebalance/RebalanceCalculator.ts)
- [`math/blackScholes.ts`](math/blackScholes.ts)
- [`workers/ComputeWorkerPool.ts`](workers/ComputeWorkerPool.ts)

## Dependency Direction

This layer should stay as pure as practical: consume `shared/` types, return deterministic results, and keep side effects isolated to worker bootstrapping or small integration helpers. Class-style entries (`ScenarioCalculator`, `RiskMetricsCalculator`, `RebalanceCalculator`) were converted to modules of pure functions; new code should follow that pattern.

## Related Topic Docs

- [`../pipeline/holdings-pipeline.md`](../pipeline/holdings-pipeline.md)
- [`../../frontend/ui-and-charting.md`](../../frontend/ui-and-charting.md)
- [`../core/db/STORAGE.md`](../core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`../pipeline/README.md`](../pipeline/README.md) when changing derived-state inputs or outputs.
- Read [`../../shared/README.md`](../../shared/README.md) before changing shared types or column semantics used by these calculations.
- Read the consumer page README for any model whose output is rendered directly.
