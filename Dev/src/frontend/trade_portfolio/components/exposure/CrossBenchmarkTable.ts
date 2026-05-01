import { ui_createElement } from "../../../components/core/createElement";
import { BETA_BENCHMARKS } from "../../../../backend/computation/beta/types";
import {
  type TableEntry,
  type SortKey,
  type RightMode,
  thStyle,
  tableStyle,
  cellBase,
  BENCHMARK_LABELS,
  HORIZONS,
  HORIZON_LABELS,
  betaColor,
  exposureColor,
  fmtBeta,
  fmtCorr,
  fmtR2,
  fmtDeltaDol,
  qualityDotHtml,
  corrQualityColor,
  qualityColor,
  getMaxAbsExposureAll,
} from "./betaExposureUtils";

export function buildCrossBenchmarkTable(
  entries: TableEntry[],
  rightMode: RightMode,
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
      text: "No data",
      styleString:
        "padding: 16px; color: var(--ios-text-secondary); font-size: 13px; text-align: center;",
    });
  }

  const MASKED_TEXT_RIGHT = "****";

  const table = ui_createElement("table", {
    styleString: tableStyle + " font-size: 12px; white-space: nowrap;",
  }) as HTMLTableElement;

  const thead = document.createElement("thead");

  if (rightMode === "beta") {
    // Group row: horizons
    const groupTr = document.createElement("tr");
    const cornerTh = document.createElement("th");
    cornerTh.style.cssText =
      thStyle +
      " padding: 4px 6px; border-bottom: 2px solid var(--ios-border);";
    groupTr.appendChild(cornerTh);
    for (const h of HORIZONS) {
      const th = document.createElement("th");
      th.colSpan = BETA_BENCHMARKS.length;
      th.textContent = HORIZON_LABELS[h];
      th.style.cssText =
        thStyle +
        " text-align: center; padding: 4px 6px; font-weight: 700; font-size: 12px; border-bottom: 2px solid var(--ios-border);";
      groupTr.appendChild(th);
    }
    thead.appendChild(groupTr);

    // Detail row: benchmark sub-columns
    const detailTr = document.createElement("tr");
    detailTr.appendChild(
      makeHeaderCell("Ticker", { kind: "common", field: "symbol" }, "left"),
    );
    for (const h of HORIZONS) {
      for (const bm of BETA_BENCHMARKS) {
        detailTr.appendChild(
          makeHeaderCell(BENCHMARK_LABELS[bm] || bm, {
            kind: "benchmark",
            benchmark: bm,
            field: "beta",
            horizon: h,
          }),
        );
      }
    }
    thead.appendChild(detailTr);
  } else if (rightMode === "exposure") {
    const maxExp = getMaxAbsExposureAll(entries);
    // Store on table for row renderer
    (table as any).__maxExp = maxExp;

    const groupTr = document.createElement("tr");
    const cornerTh = document.createElement("th");
    cornerTh.style.cssText =
      thStyle +
      " padding: 4px 6px; border-bottom: 2px solid var(--ios-border);";
    groupTr.appendChild(cornerTh);
    for (const h of HORIZONS) {
      const th = document.createElement("th");
      th.colSpan = BETA_BENCHMARKS.length;
      th.textContent = `\u0394$\u00D7\u03B2${HORIZON_LABELS[h]}`;
      th.style.cssText =
        thStyle +
        " text-align: center; padding: 4px 6px; font-weight: 700; font-size: 12px; border-bottom: 2px solid var(--ios-border);";
      groupTr.appendChild(th);
    }
    thead.appendChild(groupTr);

    const detailTr = document.createElement("tr");
    detailTr.appendChild(
      makeHeaderCell("Ticker", { kind: "common", field: "symbol" }, "left"),
    );
    for (const h of HORIZONS) {
      for (const bm of BETA_BENCHMARKS) {
        detailTr.appendChild(
          makeHeaderCell(BENCHMARK_LABELS[bm] || bm, {
            kind: "benchmark",
            benchmark: bm,
            field: "deltaBeta",
            horizon: h,
          }),
        );
      }
    }
    thead.appendChild(detailTr);
  } else {
    // Corr + R²
    const groupTr = document.createElement("tr");
    const cornerTh = document.createElement("th");
    cornerTh.style.cssText =
      thStyle +
      " padding: 4px 6px; border-bottom: 2px solid var(--ios-border);";
    groupTr.appendChild(cornerTh);
    for (const label of ["Corr", "R\u00B2"]) {
      const th = document.createElement("th");
      th.colSpan = BETA_BENCHMARKS.length;
      th.textContent = label;
      th.style.cssText =
        thStyle +
        " text-align: center; padding: 4px 6px; font-weight: 700; font-size: 12px; border-bottom: 2px solid var(--ios-border);";
      groupTr.appendChild(th);
    }
    thead.appendChild(groupTr);

    const detailTr = document.createElement("tr");
    detailTr.appendChild(
      makeHeaderCell("Ticker", { kind: "common", field: "symbol" }, "left"),
    );
    for (const bm of BETA_BENCHMARKS) {
      detailTr.appendChild(
        makeHeaderCell(BENCHMARK_LABELS[bm] || bm, {
          kind: "benchmark",
          benchmark: bm,
          field: "corr",
        }),
      );
    }
    for (const bm of BETA_BENCHMARKS) {
      detailTr.appendChild(
        makeHeaderCell(BENCHMARK_LABELS[bm] || bm, {
          kind: "benchmark",
          benchmark: bm,
          field: "rSquared",
        }),
      );
    }
    thead.appendChild(detailTr);
  }

  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const maxExp = (table as any).__maxExp ?? getMaxAbsExposureAll(entries);

  entries.forEach((entry, idx) => {
    const row = document.createElement("tr");
    row.style.cssText = idx % 2 === 1 ? "background: var(--ax-bg-glass-inset);" : "";

    // Ticker
    const tickerTd = document.createElement("td");
    tickerTd.textContent = entry.symbol;
    tickerTd.style.cssText =
      cellBase +
      " text-align: left; font-weight: 600; color: var(--ios-text-primary);";
    row.appendChild(tickerTd);

    if (rightMode === "beta") {
      for (const h of HORIZONS) {
        for (const bm of BETA_BENCHMARKS) {
          const bVal = entry.benchmarks[bm]?.beta[h] ?? null;
          const td = document.createElement("td");
          td.textContent = fmtBeta(bVal);
          td.style.cssText =
            cellBase + ` color: ${betaColor(bVal)}; font-weight: 500;`;
          row.appendChild(td);
        }
      }
    } else if (rightMode === "exposure") {
      for (const h of HORIZONS) {
        for (const bm of BETA_BENCHMARKS) {
          const dbVal = entry.benchmarks[bm]?.deltaBeta[h] ?? null;
          const displayVal =
            dbVal != null ? dbVal * displayMultiplier : null;
          const td = document.createElement("td");
          if (privacyMode) {
            td.textContent = MASKED_TEXT_RIGHT;
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
                (Math.abs(displayVal) / (maxExp * displayMultiplier)) * 28,
                28,
              );
              bar.style.cssText = `position: absolute; bottom: 2px; right: 6px; height: 2px; width: ${w.toFixed(1)}px; border-radius: 1px; background: ${displayVal >= 0 ? "rgba(32,169,69,0.35)" : "rgba(215,49,38,0.35)"};`;
              td.appendChild(bar);
            }
          }
          row.appendChild(td);
        }
      }
    } else {
      // Corr
      for (const bm of BETA_BENCHMARKS) {
        const corrVal = entry.benchmarks[bm]?.corr ?? null;
        const td = document.createElement("td");
        td.innerHTML =
          fmtCorr(corrVal) + qualityDotHtml(corrQualityColor(corrVal));
        td.style.cssText =
          cellBase + " color: var(--ios-text-secondary); font-weight: 400;";
        row.appendChild(td);
      }
      // R²
      for (const bm of BETA_BENCHMARKS) {
        const r2Val = entry.benchmarks[bm]?.rSquared ?? null;
        const td = document.createElement("td");
        td.innerHTML = fmtR2(r2Val) + qualityDotHtml(qualityColor(r2Val));
        td.style.cssText =
          cellBase + " color: var(--ios-text-secondary); font-weight: 400;";
        row.appendChild(td);
      }
    }

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}
