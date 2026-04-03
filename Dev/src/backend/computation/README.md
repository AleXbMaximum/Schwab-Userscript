# Backend Computation

## Purpose

`backend/computation/` contains reusable calculation logic for holdings, beta, options, risk, rebalance, and worker-backed CPU-heavy tasks.

## Owns

- holdings aggregation and hierarchy math
- beta and factor calculations
- options analytics and ETL helpers
- risk and rebalance modeling
- worker wrappers for heavy computation

## Does Not Own

- network transport
- persistent storage
- long-lived orchestration state
- DOM rendering

## Key Entry Files

- [`holdings/computeDerivedMetrics.ts`](holdings/computeDerivedMetrics.ts)
- [`holdings/HierarchyBuilder.ts`](holdings/HierarchyBuilder.ts)
- [`beta/singleFactor.ts`](beta/singleFactor.ts)
- [`risk/RiskMetricsCalculator.ts`](risk/RiskMetricsCalculator.ts)
- [`rebalance/RebalanceCalculator.ts`](rebalance/RebalanceCalculator.ts)

## Dependency Direction

This layer should stay as pure as practical: consume `shared/` types, return deterministic results, and keep side effects isolated to worker bootstrapping or small integration helpers.

## Related Topic Docs

- [`../pipeline/holdings-pipeline.md`](../pipeline/holdings-pipeline.md)
- [`../../frontend/ui-and-charting.md`](../../frontend/ui-and-charting.md)

## When Editing Here Also Read

- Read [`../pipeline/README.md`](../pipeline/README.md) when changing derived-state inputs or outputs.
- Read [`../../shared/README.md`](../../shared/README.md) before changing shared types or column semantics used by these calculations.
- Read the consumer page README for any model whose output is rendered directly.

