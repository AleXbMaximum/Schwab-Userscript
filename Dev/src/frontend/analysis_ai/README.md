# Frontend Analysis AI

## Purpose

`frontend/analysis_ai/` owns the AI analysis page: page shell, settings UI, stage rendering, pipeline visualization, and report export surfaces.

## Owns

- page assembly in `page.ts`
- pipeline configuration UI
- stage cards and decision summary components
- history/report list presentation

## Does Not Own

- multi-agent execution policy
- provider/network transport
- AI persistence schema

## Key Entry Files

- [`page.ts`](page.ts)
- [`pipelineConfigPanel.ts`](pipelineConfigPanel.ts)
- [`pipelineFlow.ts`](pipelineFlow.ts)
- [`reportList.ts`](reportList.ts)
- [`setting_panel/settingsPanel.ts`](setting_panel/settingsPanel.ts)

## Dependency Direction

This page depends on the backend AI service contract, shared UI primitives, and persisted model configuration. Keep stage semantics and persistence ownership in `backend/services/ai/`.

## Related Topic Docs

- [`../../backend/services/ai/ai-workflow.md`](../../backend/services/ai/ai-workflow.md)
- [`../ui-and-charting.md`](../ui-and-charting.md)

## When Editing Here Also Read

- Read [`../../backend/services/ai/README.md`](../../backend/services/ai/README.md) before changing stage fields or settings contracts.
- Read [`../components/README.md`](../components/README.md) before introducing new shared UI patterns.

