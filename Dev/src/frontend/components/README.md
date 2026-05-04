# Frontend Components

## Purpose

`frontend/components/` contains shared UI primitives and composition glue used by multiple pages, including the design system, layout shell, header rendering, composite UI primitives, company-detail card, and the backend-adapter glue that keeps the frontend decoupled from orchestration.

## Owns

- design tokens, theme controllers, and shared UI builders in `core/` (split into `axTheme/`, `axTokens/`, `behaviors/`, `builders/`, `styles/` plus root-level `settingsFramework.ts`, `settingsJsonEditorModal.ts`, `settingsPhaseMatrix.ts`)
- main layout shell in `mainContainer/`
- backend adapter glue in `DataPipelineCoordinator.ts`
- header widgets and status rendering in `header/`
- shared layout shell in `layout/PageShell.ts`
- composite UI primitives in `composite/` (`Modal.ts`, `Popover.ts`, `Toast.ts`, `EmptyState.ts`, `cx.ts`)
- company-detail card in `companyDetailsCard/` (`CompanyDataSections.ts`, `CompanyDetailsPanel.ts`)

## Does Not Own

- page-specific business workflows
- backend orchestration ownership
- chart rendering primitives in `../charts/`
- shared type definitions
- the floating account snapshot widget (now in [`../snapshot/FloatingSnapshot.ts`](../snapshot/FloatingSnapshot.ts), not in `components/`)

## Subdirectory Map

| Path | Role |
| --- | --- |
| `core/styles/` | `theme.ts` (DOM design tokens) and `ui_styles.ts` (global stylesheet helpers) |
| `core/builders/` | `ui_builders.ts`, `sectionLayout.ts`, `pillGroup.ts`, `createElement.ts` |
| `core/behaviors/` | `layoutMode.ts`, `clipboard.ts`, `windowBehaviors.ts` |
| `core/axTheme/` | canonical theme/render-mode/liquid-glass system; public entry `axTheme/index.ts` |
| `core/axTokens/` | typed primitive tokens (colors, spacing, radius, motion, opacity, surfaces, typography, glass, zIndex) |
| `core/settingsFramework.ts` | shared settings-panel scaffolding |
| `core/settingsJsonEditorModal.ts`, `core/settingsPhaseMatrix.ts` | shared settings-panel modules used across pages |
| `mainContainer/` | `MainContainer.ts`, `shareModeButton.ts` |
| `header/` | header widgets and rendering (e.g. `HeaderRenderer.ts`) |
| `layout/` | `PageShell.ts` |
| `composite/` | reusable composite UI: `Modal.ts`, `Popover.ts`, `Toast.ts`, `EmptyState.ts`, `cx.ts` |
| `companyDetailsCard/` | `CompanyDataSections.ts`, `CompanyDetailsPanel.ts` |
| `DataPipelineCoordinator.ts` | the backend adapter consumed by `AlexQuant.ts` and the `RenderEngine` |

## Key Entry Files

- [`core/styles/theme.ts`](core/styles/theme.ts)
- [`core/builders/ui_builders.ts`](core/builders/ui_builders.ts)
- [`core/axTheme/index.ts`](core/axTheme/index.ts)
- [`core/settingsFramework.ts`](core/settingsFramework.ts)
- [`DataPipelineCoordinator.ts`](DataPipelineCoordinator.ts)
- [`header/HeaderRenderer.ts`](header/HeaderRenderer.ts)
- [`mainContainer/MainContainer.ts`](mainContainer/MainContainer.ts)

## Dependency Direction

Shared components may depend on `shared/` and narrow backend-facing APIs, but page modules should depend on components rather than duplicating design-system or layout logic locally. Theme and render-mode access should flow through `core/axTheme/index.ts`, not individual files inside the `axTheme/` bucket.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../init-workflow.md`](../../init-workflow.md)
- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)

## When Editing Here Also Read

- Read [`../README.md`](../README.md) for page ownership boundaries.
- Read [`../../shared/README.md`](../../shared/README.md) before changing shared contracts or logging primitives consumed here.
- Read [`../ui-and-charting.md`](../ui-and-charting.md) before changing how components interact with shared chart rendering primitives.
