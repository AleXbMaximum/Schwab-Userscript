# Frontend Trade Portfolio

## Purpose

`frontend/trade_portfolio/` owns the portfolio page for exposure, scenarios, governance, and rebalance-focused UI.

## Owns

- page layout and section orchestration in `page.ts`
- portfolio-specific control state and UI types in `types.ts`
- exposure panels in `components/exposure/`
- scenario panels in `components/scenarios/`
- portfolio overview panels in `components/overview/`
- governance / rebalance panels in `components/governance/`
- portfolio data lifecycle helpers in `data/`
- portfolio settings UI in `setting_panel/`
- shared portfolio section layout in `components/layout/PortfolioSectionLayout.ts`

## Does Not Own

- risk model implementation
- rebalance math and target computation (formulas live in `backend/computation/rebalance/`)
- holdings ingestion or beta transport

## Component Map

| Subdir | Files |
| --- | --- |
| `components/exposure/` | `BetaExposurePanel.ts`, `GreeksRiskPanel.ts`, `BenchmarkDetailTable.ts`, `BreakdownPanelFactory.ts`, `CrossBenchmarkTable.ts`, `betaExposureUtils.ts` |
| `components/scenarios/` | `ScenarioCardPanel.ts`, `CustomScenarioBuilder.ts`, `ModelExplanation.ts`, `PositionDrillDown.ts`, `scenarioCurves.ts` |
| `components/overview/` | `PortfolioHealthScore.ts`, `PortfolioStateVector.ts` |
| `components/governance/` | `PortfolioControlBar.ts`, `RebalanceIdeasPanel.ts` (thin orchestrator) plus the split rebalance modules below |
| `components/layout/` | `PortfolioSectionLayout.ts` |
| `data/` | `portfolioLifecycle.ts`, `portfolioPayloads.ts` |
| `setting_panel/` | `settingsPanel.ts` |

`components/governance/RebalanceIdeasPanel.ts` is now a thin coordinator that delegates to:

- `rebalanceTableBuilder.ts` (initial table render)
- `rebalanceTableHelpers.ts` (shared row/cell helpers)
- `rebalanceIncrementalUpdate.ts` (in-place updates after holdings/quote changes)
- `rebalanceTargetEditing.ts` (inline target-edit UX)
- `rebalanceProfileActions.ts` (profile add/remove/select actions)
- `rebalanceProfileIO.ts` (profile import/export and KV I/O)
- `rebalanceSuggestions.ts` (suggestion text + reason generation)
- `rebalanceTypes.ts` (panel-local types)

## Key Entry Files

- [`page.ts`](page.ts)
- [`types.ts`](types.ts)
- [`components/exposure/BetaExposurePanel.ts`](components/exposure/BetaExposurePanel.ts)
- [`components/exposure/GreeksRiskPanel.ts`](components/exposure/GreeksRiskPanel.ts)
- [`components/scenarios/ScenarioCardPanel.ts`](components/scenarios/ScenarioCardPanel.ts)
- [`components/overview/PortfolioStateVector.ts`](components/overview/PortfolioStateVector.ts)
- [`components/governance/PortfolioControlBar.ts`](components/governance/PortfolioControlBar.ts)
- [`components/governance/RebalanceIdeasPanel.ts`](components/governance/RebalanceIdeasPanel.ts) and its sibling `rebalance*.ts` modules

## Dependency Direction

This page depends on backend risk, beta, and rebalance computations plus shared holdings state. Keep portfolio modeling in backend computation unless a behavior is purely about presentation or interaction.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)

## When Editing Here Also Read

- Read [`../../backend/computation/README.md`](../../backend/computation/README.md) before changing risk or rebalance assumptions.
- Read [`../trade_holdings/README.md`](../trade_holdings/README.md) when portfolio behavior depends on holdings view state or shared settings.

