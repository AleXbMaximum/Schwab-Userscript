import { ui_createElement } from "../../../components/core/createElement";
import {
  type TableEntry,
  type SortKey,
  thStyle,
  tableStyle,
  cellBase,
  HORIZONS,
  HORIZON_LABELS,
  betaColor,
  exposureColor,
  fmtBeta,
  fmtCorr,
  fmtR2,
  fmtDeltaDol,
  trendArrow,
  qualityDotHtml,
  corrQualityColor,
  qualityColor,
  getMaxAbsExposure,
} from "./betaExposureUtils";

export function buildBenchmarkDetailTable(
  entries: TableEntry[],
  activeBenchmark: string,
  privacyMode: boolean,
  makeHeaderCell: (
    label: string,
    sk: SortKey,
    align?: "left" | "right",
  ) => HTMLTableCellElement,
  displayMultiplier = 1,
): HTMLElement {
  if (entries.length === 0) {
    return ui_createElement("div", {
      text: "No beta data available. Waiting for first calculation\u2026",
      styleString:
        "padding: 16px; color: var(--ios-text-secondary); font-size: 13px; text-align: center;",
    });
  }

  const bm = activeBenchmark;
  const maxExp = getMaxAbsExposure(entries, bm);

  const table = ui_createElement("table", {
    styleString: tableStyle + " font-size: 12px; white-space: nowrap;",
  }) as HTMLTableElement;

  const thead = document.createElement("thead");
  const grpStyle =
    thStyle +
    " text-align: center; padding: 4px 6px; font-weight: 700; font-size: 12px; border-bottom: 2px solid var(--ios-border);";

  const MASKED_TEXT = "****";

  // Row 1: group headers
  const groupTr = document.createElement("tr");
  const emptyTh = document.createElement("th");
  emptyTh.colSpan = 2;
  emptyTh.style.cssText = grpStyle;
  groupTr.appendChild(emptyTh);

  const betaGrp = document.createElement("th");
  betaGrp.colSpan = 4;
  betaGrp.textContent = "Beta";
  betaGrp.style.cssText = grpStyle;
  groupTr.appendChild(betaGrp);

  const expGrp = document.createElement("th");
  expGrp.colSpan = 4;
  expGrp.textContent = "Exposure (\u0394$\u00D7\u03B2)";
  expGrp.style.cssText = grpStyle;
  groupTr.appendChild(expGrp);

  const qualGrp = document.createElement("th");
  qualGrp.colSpan = 2;
  qualGrp.textContent = "Quality";
  qualGrp.style.cssText = grpStyle;
  groupTr.appendChild(qualGrp);

  thead.appendChild(groupTr);

  // Row 2: detail column headers
  const tr = document.createElement("tr");

  tr.appendChild(
    makeHeaderCell("Ticker", { kind: "common", field: "symbol" }, "left"),
  );
  tr.appendChild(
    makeHeaderCell("Delta $", { kind: "common", field: "deltaDol" }),
  );
  for (const h of HORIZONS) {
    tr.appendChild(
      makeHeaderCell(HORIZON_LABELS[h], {
        kind: "benchmark",
        benchmark: bm,
        field: "beta",
        horizon: h,
      }),
    );
  }
  for (const h of HORIZONS) {
    tr.appendChild(
      makeHeaderCell(HORIZON_LABELS[h], {
        kind: "benchmark",
        benchmark: bm,
        field: "deltaBeta",
        horizon: h,
      }),
    );
  }
  tr.appendChild(
    makeHeaderCell("Corr", { kind: "benchmark", benchmark: bm, field: "corr" }),
  );
  tr.appendChild(
    makeHeaderCell("R\u00B2", {
      kind: "benchmark",
      benchmark: bm,
      field: "rSquared",
    }),
  );

  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  entries.forEach((entry, idx) => {
    const row = document.createElement("tr");
    row.style.cssText = idx % 2 === 1 ? "background: rgba(0,0,0,0.02);" : "";

    const bmData = entry.benchmarks[bm];

    // Ticker
    const tickerTd = document.createElement("td");
    tickerTd.textContent = entry.symbol;
    tickerTd.style.cssText =
      cellBase +
      " text-align: left; font-weight: 600; color: var(--ios-text-primary);";
    row.appendChild(tickerTd);

    // Delta $
    {
      const deltaTd = document.createElement("td");
      deltaTd.textContent = privacyMode
        ? MASKED_TEXT
        : fmtDeltaDol(
            entry.deltaDol != null
              ? entry.deltaDol * displayMultiplier
              : entry.deltaDol,
          );
      deltaTd.style.cssText =
        cellBase + " color: var(--ios-text-secondary); font-weight: 400;";
      row.appendChild(deltaTd);
    }

    // Beta × 4 horizons with inline trend arrows
    for (let hi = 0; hi < HORIZONS.length; hi++) {
      const h = HORIZONS[hi];
      const bVal = bmData?.beta[h] ?? null;
      const td = document.createElement("td");
      td.style.cssText =
        cellBase + ` color: ${betaColor(bVal)}; font-weight: 500;`;

      const numSpan = document.createElement("span");
      numSpan.textContent = fmtBeta(bVal);
      td.appendChild(numSpan);

      // Arrow comparing this horizon to the next longer one
      if (hi < HORIZONS.length - 1) {
        const nextVal = bmData?.beta[HORIZONS[hi + 1]] ?? null;
        const arrow = trendArrow(bVal, nextVal);
        if (arrow) {
          const arrowSpan = document.createElement("span");
          arrowSpan.textContent = arrow.text;
          arrowSpan.style.cssText = `color: ${arrow.color}; font-size: 10px; margin-left: 2px;`;
          td.appendChild(arrowSpan);
        }
      }

      row.appendChild(td);
    }

    // Exposure × 4 horizons with contribution bar overlay
    for (const h of HORIZONS) {
      const dbVal = bmData?.deltaBeta[h] ?? null;
      const displayVal =
        dbVal != null ? dbVal * displayMultiplier : null;
      const td = document.createElement("td");
      if (privacyMode) {
        td.textContent = MASKED_TEXT;
        td.style.cssText =
          cellBase + " color: var(--ios-text-secondary); font-weight: 400;";
      } else {
        td.textContent = fmtDeltaDol(displayVal);
        td.style.cssText =
          cellBase +
          ` color: ${exposureColor(displayVal)}; font-weight: 500; position: relative;`;

        if (displayVal != null && maxExp > 0) {
          const bar = document.createElement("div");
          const w = Math.min(
            (Math.abs(displayVal) / (maxExp * displayMultiplier)) * 36,
            36,
          );
          bar.style.cssText = `position: absolute; bottom: 2px; right: 6px; height: 2px; width: ${w.toFixed(1)}px; border-radius: 1px; background: ${displayVal >= 0 ? "rgba(32,169,69,0.35)" : "rgba(215,49,38,0.35)"};`;
          td.appendChild(bar);
        }
      }
      row.appendChild(td);
    }

    // Corr with quality dot
    const corrTd = document.createElement("td");
    const corrVal = bmData?.corr ?? null;
    corrTd.innerHTML =
      fmtCorr(corrVal) + qualityDotHtml(corrQualityColor(corrVal));
    corrTd.style.cssText =
      cellBase + " color: var(--ios-text-secondary); font-weight: 400;";
    row.appendChild(corrTd);

    // R² with quality dot
    const r2Td = document.createElement("td");
    const r2Val = bmData?.rSquared ?? null;
    r2Td.innerHTML = fmtR2(r2Val) + qualityDotHtml(qualityColor(r2Val));
    r2Td.style.cssText =
      cellBase + " color: var(--ios-text-secondary); font-weight: 400;";
    row.appendChild(r2Td);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}
