# Frontend Analysis AI

## Purpose

`frontend/analysis_ai/` owns the AI analysis page: page shell, settings UI, stage rendering, pipeline visualization, and report export surfaces.

## Owns

- page assembly in `page.ts`
- analysis run orchestration glue in `orchestration/` (`analysisRunner.ts`, `reportComparison.ts`, `symbolInput.ts`)
- pipeline configuration UI in `pipeline/` (`pipelineConfigPanel.ts`, `pipelineFlow.ts`, `agentSelector.ts`, `debateConfig.ts`)
- stage cards, live results panel, decision summary, and history list in `components/`
- AI settings UI in `setting_panel/` (`settingsPanel.ts`, `providerSection.ts`, `modelSection.ts`, `customModelSection.ts`, `connectivitySection.ts`)

## Does Not Own

- multi-agent execution policy (lives in `backend/services/ai/service/`)
- provider/network transport
- AI persistence schema

## Key Entry Files

- [`page.ts`](page.ts)
- [`orchestration/analysisRunner.ts`](orchestration/analysisRunner.ts)
- [`pipeline/pipelineConfigPanel.ts`](pipeline/pipelineConfigPanel.ts)
- [`pipeline/pipelineFlow.ts`](pipeline/pipelineFlow.ts)
- [`components/StageCard.ts`](components/StageCard.ts)
- [`components/LiveResultsPanel.ts`](components/LiveResultsPanel.ts)
- [`components/DecisionSummary.ts`](components/DecisionSummary.ts)
- [`components/reportList.ts`](components/reportList.ts)
- [`setting_panel/settingsPanel.ts`](setting_panel/settingsPanel.ts)

## Dependency Direction

This page depends on the backend AI service contract, shared UI primitives, and persisted model configuration. Keep stage semantics and persistence ownership in `backend/services/ai/`.

## Related Topic Docs

- [`../../backend/services/ai/ai-workflow.md`](../../backend/services/ai/ai-workflow.md)
- [`../ui-and-charting.md`](../ui-and-charting.md)

## When Editing Here Also Read

- Read [`../../backend/services/ai/README.md`](../../backend/services/ai/README.md) before changing stage fields or settings contracts.
- Read [`../components/README.md`](../components/README.md) before introducing new shared UI patterns.

