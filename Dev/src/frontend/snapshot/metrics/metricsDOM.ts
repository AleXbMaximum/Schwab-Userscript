import { ui_createElement } from "../../components/core/builders/createElement";
import type { AccountOverviewMetrics } from "backend/computation/holdings/metrics/accountOverviewMetrics";
import type { BalancesSnapshot } from "../../../backend/core/network/schwab/endpoints/balances";
import type { MetricEntry } from "./metricDefinitions";
import {
  computePrimaryMetrics,
  computeDetailMetrics,
} from "./metricDefinitions";

const FONT_FAMILY =
  'var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';

function measureTextWidth(text: string, cssText: string): number {
  const span = document.createElement("span");
  span.style.cssText =
    cssText +
    "; position:absolute; visibility:hidden; white-space:nowrap; pointer-events:none;";
  span.textContent = text;
  document.body.appendChild(span);
  const w = span.getBoundingClientRect().width;
  span.remove();
  return Math.ceil(w);
}

const SNAP_CELL_GAP = 4;
const SNAP_LABELS = [
  "Day:", "Total:", "Acc:", "Mkt:", "Cash:", "Δ$:", "Long:", "Short:",
  "β:", "θ:", "ν:", "ρ:", "↑1%:", "↓1%:", "BuyPwr:", "MgnEq:",
  "Eq%:", "OptReq:", "Settled:", "SMA:", "Borrow:", "Wdraw:", "MTDInt:", "MgnRt:",
];
let _snapLabelW = 0;

function ensureSnapLabelWidth(): void {
  if (_snapLabelW) return;
  const css = `font-family:${FONT_FAMILY}; font-weight:600; font-size:13px`;
  for (const lbl of SNAP_LABELS) {
    const w = measureTextWidth(lbl, css);
    if (w > _snapLabelW) _snapLabelW = w;
  }
}

export type BuiltMetricsResult = {
  element: HTMLElement;
  primarySpans: HTMLSpanElement[];
  detailSpans: HTMLSpanElement[];
  detailWrap: HTMLElement | null;
};

export function buildSnapshotMetricsDOM(
  overview: AccountOverviewMetrics,
  containerEl: HTMLElement,
  balances: BalancesSnapshot | null,
): BuiltMetricsResult {
  ensureSnapLabelWidth();

  const containerW = containerEl.offsetWidth || 300;
  const valCss = `font-family:${FONT_FAMILY}; font-weight:600; font-size:14px`;
  const wrap = ui_createElement("div", {
    styleString: `display:flex; flex-direction:column; gap:4px; font-weight:600; font-family:${FONT_FAMILY};`,
  });

  const buildRow = (
    metrics: MetricEntry[],
  ): { row: HTMLElement; spans: HTMLSpanElement[] } => {
    const row = ui_createElement("div", {
      styleString: "display:flex; flex-wrap:wrap; row-gap:4px;",
    });
    const spans: HTMLSpanElement[] = [];
    for (const m of metrics) {
      const cell = ui_createElement("div", {
        styleString:
          `display:flex; gap:${SNAP_CELL_GAP}px;` +
          " white-space:nowrap; align-items:baseline; overflow:hidden;",
      });
      cell.appendChild(
        ui_createElement("span", {
          text: m.label,
          styleString:
            `width:${_snapLabelW}px; flex-shrink:0; overflow:hidden;` +
            " color:var(--ios-gray); font-size:13px;",
        }),
      );
      const valText = m.valueFn();
      const valSpan = ui_createElement("span", {
        text: valText,
        styleString:
          `color:${m.colorFn()}; font-size:14px;` +
          " overflow:hidden; text-overflow:ellipsis; min-width:0;",
      }) as HTMLSpanElement;
      cell.appendChild(valSpan);
      spans.push(valSpan);

      const naturalW =
        _snapLabelW + SNAP_CELL_GAP + measureTextWidth(valText, valCss);
      let basis: string;
      if (naturalW > containerW / 2) basis = "100%";
      else if (naturalW > containerW / 3) basis = "50%";
      else basis = "33.33%";
      cell.style.flex = `1 0 ${basis}`;
      row.appendChild(cell);
    }
    return { row, spans };
  };

  const primary = buildRow(computePrimaryMetrics(overview));
  wrap.appendChild(primary.row);

  let detailSpans: HTMLSpanElement[] = [];
  let detailWrap: HTMLElement | null = null;

  if (balances) {
    const detail = buildRow(computeDetailMetrics(overview, balances));
    detailWrap = ui_createElement("div", { styleString: "display:none;" });
    detailWrap.appendChild(detail.row);
    detailSpans = detail.spans;

    const toggleBtn = ui_createElement("button", {
      text: "▶ Account Details",
      props: { type: "button" },
      styleString:
        "background:none; border:none; cursor:pointer; padding:2px 0; margin-top:2px;" +
        " color:var(--ios-text-secondary); font-size:11px; font-weight:600;" +
        ` font-family:${FONT_FAMILY}; user-select:none; align-self:flex-start;`,
    }) as HTMLButtonElement;

    let detailExpanded = false;
    toggleBtn.addEventListener("click", () => {
      detailExpanded = !detailExpanded;
      detailWrap!.style.display = detailExpanded ? "block" : "none";
      toggleBtn.textContent = detailExpanded
        ? "▼ Account Details"
        : "▶ Account Details";
    });

    wrap.appendChild(toggleBtn);
    wrap.appendChild(detailWrap);
  }

  return {
    element: wrap,
    primarySpans: primary.spans,
    detailSpans,
    detailWrap,
  };
}

export function patchSnapshotMetricsDOM(
  overview: AccountOverviewMetrics,
  balances: BalancesSnapshot | null,
  primarySpans: HTMLSpanElement[],
  detailSpans: HTMLSpanElement[],
): void {
  const primaryMetrics = computePrimaryMetrics(overview);
  for (let i = 0; i < primaryMetrics.length && i < primarySpans.length; i++) {
    const m = primaryMetrics[i];
    const span = primarySpans[i];
    const newText = m.valueFn();
    if (span.textContent !== newText) span.textContent = newText;
    const newColor = m.colorFn();
    if (span.style.color !== newColor) span.style.color = newColor;
  }

  if (balances && detailSpans.length > 0) {
    const detailMetrics = computeDetailMetrics(overview, balances);
    for (let i = 0; i < detailMetrics.length && i < detailSpans.length; i++) {
      const m = detailMetrics[i];
      const span = detailSpans[i];
      const newText = m.valueFn();
      if (span.textContent !== newText) span.textContent = newText;
      const newColor = m.colorFn();
      if (span.style.color !== newColor) span.style.color = newColor;
    }
  }
}
