# UI And Charting

## Scope

This document defines the shared UI design-system boundary, chart rendering lifecycle, and the contracts that keep DOM styling and canvas rendering in sync.

## Owner Directory

`Dev/src/frontend/`

## Recommended Read Order

1. [`../README.md`](../README.md)
2. [`components/README.md`](components/README.md)
3. [`components/core/theme.ts`](components/core/theme.ts)
4. [`charts/ChartManager.ts`](charts/ChartManager.ts)

## Source Of Truth

| File | Role |
| --- | --- |
| [`components/core/theme.ts`](components/core/theme.ts) | exported design tokens, typography presets, layout helpers, and component style presets |
| [`components/core/ui_styles.ts`](components/core/ui_styles.ts) | runtime CSS variable injection |
| [`components/core/ui_builders.ts`](components/core/ui_builders.ts) | shared DOM builders and reusable UI fragments |
| [`components/core/settingsFramework.ts`](components/core/settingsFramework.ts) | shared settings-panel scaffolding |
| [`charts/ChartTheme.ts`](charts/ChartTheme.ts) | canvas and Chart.js colors, `CHART_FONTS`, animation/tooltip/legend presets |
| [`charts/ChartUtils.ts`](charts/ChartUtils.ts) | `setupCanvas` (hi-DPI helper), `ladderValue` (key-level lookup), `traceRoundRect`, validation |
| [`charts/ChartManager.ts`](charts/ChartManager.ts) | chart-instance lifecycle and update coordination |
| [`charts/chartPanel.ts`](charts/chartPanel.ts) | shared 4-zone chart panel (header → controls → info → canvas) and legacy compat wrapper |
| [`components/core/sectionLayout.ts`](components/core/sectionLayout.ts) | unit-based responsive section grid with collapsible sections, sticky nav, and autoHeight support |

## Design-System Contracts

- `DS_*` exports are the primary shared token surfaces.
- `ds_*()` helpers return style strings or derived token values and should be preferred over local inline style constants.
- Shared UI builders belong in `components/core/ui_builders.ts`; page-local one-off DOM creation belongs in the page directory.
  - `ui_formRow({ label, control, helper? })` — settings panel form row (label left, control right, optional helper text below).
  - `ui_badge(text, variant)` — semantic badge/chip with color variants (`positive`, `negative`, `neutral`, `info`, `muted`).
  - `createEventManager()` — auto-tracking event listener manager; call `.add(el, event, handler)` to register, `.removeAll()` to bulk-cleanup on teardown.
- Shared settings layouts should extend `settingsFramework.ts` instead of re-inventing form-card patterns.

## Token Families

The important token groups are:

- `DS_COLORS` for semantic and raw colors
  - Includes `cyan` / `raw.cyan` (`#5AC8FA`) and `purple` / `raw.purple` (`#5856D6`).
- `DS_TYPOGRAPHY` for reusable text presets
- `DS_SPACING`, `DS_RADIUS`, `DS_LINE_HEIGHT`, and `DS_OPACITY` for layout consistency
- `DS_COMPONENTS` and `DS_BUTTONS` for common shell and control styling
  - `DS_BUTTONS` includes size presets: `sizeSm` (4px 10px, 11px font), `sizeMd` (6px 12px, 12px font), `sizeLg` (8px 16px, 13px font).

**Typography scale rule**: The canonical DOM font sizes are: 9, 10, 11, 12, 13, 15, 20px. Avoid 14px and 16px.

**Border-radius rule**: All `border-radius` values must use `DS_RADIUS` tokens. No arbitrary values (especially not 9px or 7px).

When a new token or pattern becomes shared across pages, it should move into the design-system layer instead of remaining page-local.

## Markdown Rendering

`shared/utils/markdown.ts` provides a lightweight markdown-to-HTML renderer for AI output. CSS classes are injected once via `injectStylesheet("alexquant-md-styles", ...)` in `StageCard.ts`.

| Class | Purpose |
| --- | --- |
| `.md-h1`, `.md-h2`, `.md-h3` | Heading levels (15px/13px/12px) |
| `.md-li`, `.md-li2` | List items (nested = `.md-li2`) |
| `.md-code` | Inline code (monospace, subtle bg) |
| `.md-hr` | Horizontal rule |
| `.md-spacer` | Paragraph separator |
| `.ai-thinking-wrap`, `.ai-thinking-toggle`, `.ai-thinking-body` | Collapsible thinking visualization (purple accent) |
| `.ai-streaming-cursor` | Blinking cursor during streaming |
| `.ai-citation-list` | Web search citation footnotes |

## Chart Lifecycle

- `charts/chartPanel.ts` provides two APIs:
  - `createChartPanel<TData>` — new 4-zone layout (header → controls → info → canvas flex-fill). Used by `analysis_options` Chart.js charts.
  - `createLegacyChartPanel<TData>` — backward-compat wrapper for `analysis_optionFlow` and `analysis_visualize` charts.
- `ChartManager.ts` owns chart instance creation, update scheduling, and teardown.
- Shared chart helpers and plugins live in `charts/`. Chart.js overlay plugins for spot price and focus-strike lines live in `analysis_options/components/spotPricePlugin.ts` and `analysis_options/focus/focusStrikeOverlayPlugin.ts`.
- Page modules should keep chart orchestration local, but chart setup and theme constants should reuse the shared chart layer.
- Custom canvas charts (OptionsWalls, ExpectedMove, VolatilitySurface, UnusualActivity) must use `setupCanvas()` for hi-DPI init and `CHART_FONTS.*` for text rendering.

### CHART_FONTS Reference

`CHART_FONTS` in `ChartTheme.ts` provides the full set of canvas font constants:

| Constant | Size | Weight | Use case |
| --- | --- | --- | --- |
| `label` | 9px | 600 | Standard chart labels |
| `labelBold` | 9px | 700 | Emphasized chart labels |
| `labelSmall` | 9px | 500 | Secondary chart labels |
| `tick` | 10px | 400 | Axis tick values |
| `tickSmall` | 9px | 400 | Compact axis ticks |
| `axis` | 10px | 500 | Axis titles |
| `dense` | 8px | 600 | Contour labels, event badges, compact cells |
| `denseBold` | 8px | 700 | Emphasized dense text |
| `denseLight` | 8px | 500 | Secondary dense text |
| `axisSemibold` | 10px | 600 | Heatmap axis, summary headers, spot labels |
| `axisBold` | 10px | 700 | Bold axis labels |
| `heatmap` | 11px | 600 | Heatmap headers and cell values |
| `heatmapBold` | 11px | 700 | Emphasized heatmap text |
| `heatmapLight` | 11px | 500 | Secondary heatmap text |
| `rowLabel` | 12px | 500 | Row labels for large heatmaps |

## Chart Theme Sync Contract

- Base semantic colors in `components/core/theme.ts`, `components/core/ui_styles.ts`, and `charts/ChartTheme.ts` must stay aligned.
- When a base semantic color changes, update both the DOM token layer and the chart theme layer in the same change.
- Chart components should consume shared theme constants instead of embedding duplicated raw color literals.
- Canvas font strings must use `CHART_FONTS.*` from `ChartTheme.ts` instead of inline font literals. All `ctx.font` assignments MUST use `CHART_FONTS` constants; no inline font strings.
- Canvas hi-DPI setup (dpr, sizing, clearRect) must use `setupCanvas()` from `ChartUtils.ts`.
- Key-level ladder lookups must use the shared `ladderValue()` from `ChartUtils.ts`.

## Layout And Responsiveness

- `components/core/layoutMode.ts` is the shared source for layout-mode detection.
- `components/core/sectionLayout.ts` provides the unit-based responsive grid used by `analysis_options` and `trade_portfolio` pages.
  - Grid rows use `minmax(unitH, auto)` — charts fill exactly one unit height, while text/table panels can grow beyond it.
  - `unitHeight` option sets a fixed pixel height per grid row, overriding the default `unitAspectRatio`-based calculation. Use this when charts need a consistent height regardless of column width.
  - `getCardSlot(sectionId, cardId, span, nature, rowSpan?, autoHeight?)` — set `autoHeight: true` for full-width panels (tables, heatmaps) whose height should be driven by content instead of the fixed unit grid.
- Shared responsive shell behavior belongs in components or page-level wrappers, not ad hoc scattered media checks.
- Pages may add local responsive tweaks, but should only do so after checking whether an existing shared helper already covers the pattern.

## Settings Panel Pattern

- Shared settings scaffolding belongs in `components/core/settingsFramework.ts`.
- Dense settings UIs should reuse the shared grouped-card and form-row patterns rather than inventing a new visual language per page.
- Page-specific settings panels should compose shared builders and tokens, then keep only the truly local business fields in the page directory.

## Interactive States

Global CSS (`ui_styles.ts`) provides default interactive states for form controls:

- `:focus` on inputs, selects, and textareas: blue border + `box-shadow` ring.
- `:disabled` on interactive elements: `opacity: 0.6` + `cursor: not-allowed`.

Do not override these unless a component has a specific design reason.

## Critical Invariants

- `theme.ts` is the source of truth for DOM-facing design tokens.
- `ChartTheme.ts` must remain semantically aligned with the raw token colors used by canvas and Chart.js.
- Shared UI patterns should graduate into `components/` when more than one page depends on them.
- UI code must not patch over backend unit or normalization issues that belong in adapter or shared layers.

## Related Local Docs

- [`README.md`](README.md)
- [`components/README.md`](components/README.md)
- [`analysis_ai/README.md`](analysis_ai/README.md)
- [`analysis_optionFlow/README.md`](analysis_optionFlow/README.md)
- [`analysis_options/README.md`](analysis_options/README.md)
- [`analysis_visualize/README.md`](analysis_visualize/README.md)
- [`trade_holdings/README.md`](trade_holdings/README.md)
- [`trade_portfolio/README.md`](trade_portfolio/README.md)
