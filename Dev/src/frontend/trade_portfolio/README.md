# Frontend Trade Portfolio

## Purpose

`frontend/trade_portfolio/` owns the portfolio page for exposure, scenarios, governance, and rebalance-focused UI.

## Owns

- page layout and section orchestration in `page.ts`
- portfolio-specific control state and UI types
- scenario, governance, overview, and exposure panels in `components/`

## Does Not Own

- risk model implementation
- rebalance math and target computation
- holdings ingestion or beta transport

## Key Entry Files

- [`page.ts`](page.ts)
- [`types.ts`](types.ts)
- [`components/exposure/BetaExposurePanel.ts`](components/exposure/BetaExposurePanel.ts)
- [`components/exposure/GreeksRiskPanel.ts`](components/exposure/GreeksRiskPanel.ts)
- [`components/scenarios/ScenarioCardPanel.ts`](components/scenarios/ScenarioCardPanel.ts)
- [`components/governance/PortfolioControlBar.ts`](components/governance/PortfolioControlBar.ts)
- [`components/governance/RebalanceIdeasPanel.ts`](components/governance/RebalanceIdeasPanel.ts)

## Dependency Direction

This page depends on backend risk, beta, and rebalance computations plus shared holdings state. Keep portfolio modeling in backend computation unless a behavior is purely about presentation or interaction.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)

## When Editing Here Also Read

- Read [`../../backend/computation/README.md`](../../backend/computation/README.md) before changing risk or rebalance assumptions.
- Read [`../trade_holdings/README.md`](../trade_holdings/README.md) when portfolio behavior depends on holdings view state or shared settings.

