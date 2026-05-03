import { CHART_COLORS } from "../ChartTheme";
import { formatPct } from "shared/utils/format/formatters";
import type { HeatmapOptions } from "./HeatmapTypes";

export function positionHeatmapTooltip(
  tooltip: HTMLDivElement,
  clientX: number,
  clientY: number,
): void {
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = clientX + 10;
  let top = clientY + 10;

  if (left + tooltipRect.width > window.innerWidth) {
    left = clientX - tooltipRect.width - 10;
  }
  if (top + tooltipRect.height > window.innerHeight) {
    top = clientY - tooltipRect.height - 10;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.display = "block";
}

export function showCellTooltip(
  tooltip: HTMLDivElement | null,
  options: Required<HeatmapOptions>,
  maxValue: number,
  clientX: number,
  clientY: number,
  cell: { row: number; col: number },
): void {
  if (!tooltip) return;

  const { rows, columns, valueFormatter, tooltipFormatter } = options;
  const value = options.data[cell.row][cell.col];

  const rowLabel = rows[cell.row];
  const colLabel = columns[cell.col];

  if (tooltipFormatter) {
    tooltip.innerHTML = tooltipFormatter(rowLabel, colLabel, value);
  } else {
    tooltip.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">${rowLabel} × ${colLabel}</div>
                <div style="color: ${value >= 0 ? CHART_COLORS.success : CHART_COLORS.danger};">
                    Expected P&L: ${valueFormatter(value)}
                </div>
                <div style="font-size: 11px; color: ${CHART_COLORS.textSecondary}; margin-top: 4px;">
                    ${formatPct(maxValue > 0 ? value / maxValue : 0)} of max scenario
                </div>
            `;
  }

  positionHeatmapTooltip(tooltip, clientX, clientY);
}

export function showSummaryRowTooltipImpl(
  tooltip: HTMLDivElement | null,
  options: Required<HeatmapOptions>,
  formatCompactValue: (value: number) => string,
  clientX: number,
  clientY: number,
  col: number,
): void {
  if (!tooltip) return;
  const value = options.summaryRow[col];
  const timeLabel = options.columns[col];
  tooltip.innerHTML =
    `<div style="font-weight: 600; margin-bottom: 2px;">${timeLabel}</div>` +
    `<div>Σ GEX: ${formatCompactValue(value)}</div>`;
  positionHeatmapTooltip(tooltip, clientX, clientY);
}

export function hideHeatmapTooltip(tooltip: HTMLDivElement | null): void {
  if (tooltip) {
    tooltip.style.display = "none";
  }
}
