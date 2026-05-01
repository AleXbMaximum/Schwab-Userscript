import { ui_createElement } from "../../../components/core/createElement";
import { DS_BUTTONS, DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import { BETA_BENCHMARKS } from "../../../../backend/computation/beta/types";
import { logService } from "../../../../shared/log/core/LogService";
import {
  getShareMode,
  getCustomMultiplier,
  onShareModeChange,
} from "../../../../shared/utils/globalShareMode";

import {
  type BetaPanelPayload,
  type PanelResult,
  type SortKey,
  type RightMode,
  type ExposureMode,
  thStyle,
  tableStyle,
  cellBase,
  BENCHMARK_LABELS,
  HORIZONS,
  HORIZON_LABELS,
  buildEntries,
  betaColor,
  betaBgColor,
  fmtBeta,
  fmtTime,
  pickLatestComputedAt,
  sortEntries,
  buildSegmentControl,
} from "./betaExposureUtils";
import { buildBenchmarkDetailTable } from "./BenchmarkDetailTable";
import { buildCrossBenchmarkTable } from "./CrossBenchmarkTable";

const log = logService.namespace("render");
const panelTitleStyle = DS_TYPOGRAPHY.panelTitle + " margin-bottom: 4px;";

// ── Main render ──────────────────────────────────────────────────────────────────

export function renderBetaExposurePanel(
  payload: BetaPanelPayload,
): PanelResult {
  const container = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as PanelResult;

  let activeBenchmark = payload.currentBenchmark || "$SPX";
  let rightMode: RightMode = "beta";
  let exposureMode: ExposureMode = "current";
  // Share mode is now global — derive local helpers from global state
  let sortKey: SortKey = {
    kind: "benchmark",
    benchmark: activeBenchmark,
    field: "deltaBeta",
    horizon: "medium",
  };
  let sortAsc = false;
  let entries = buildEntries(payload, exposureMode);
  entries = sortEntries(entries, sortKey, sortAsc);

  // ── Shared exposure mode switch ─────────────────────────────────────────
  const switchExposureMode = (key: string) => {
    exposureMode = key as ExposureMode;
    mainModeTabs.setActive(key);
    rightModeTabs.setActive(key);
    entries = buildEntries(payload, exposureMode);
    entries = sortEntries(entries, sortKey, sortAsc);
    refreshAll();
    refreshHeaderStatus(payload);
  };

  // ── Top-level Header ────────────────────────────────────────────────────
  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;",
  });
  headerRow.appendChild(
    ui_createElement("h3", {
      text: "Beta Exposure",
      styleString: panelTitleStyle,
    }),
  );

  const rightHeaderWrap = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 8px;",
  });

  // Privacy button removed — share mode is now global (header button)
  // Subscribe for re-render on share mode change
  const unsubShareMode = onShareModeChange(() => {
    const mode = getShareMode();
    if (mode === "dollarOff") {
      if (
        (sortKey.kind === "common" && sortKey.field === "deltaDol") ||
        (sortKey.kind === "benchmark" && sortKey.field === "deltaBeta")
      ) {
        sortKey = {
          kind: "benchmark",
          benchmark: activeBenchmark,
          field: "beta",
          horizon: "medium",
        };
        sortAsc = false;
      }
    }
    refreshAll();
  });

  const recalcBtn = ui_createElement("button", {
    text: "Recalculate",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " font-size: 11px; padding: 3px 10px; border-radius: 6px; cursor: pointer; margin-left: 12px;",
  }) as HTMLButtonElement;
  recalcBtn.addEventListener("click", () => {
    if (payload.onRecalculate) payload.onRecalculate();
  });
  rightHeaderWrap.appendChild(recalcBtn);

  const statusSpan = ui_createElement("span", {
    styleString: DS_TYPOGRAPHY.caption + " white-space: nowrap;",
  });
  rightHeaderWrap.appendChild(statusSpan);
  headerRow.appendChild(rightHeaderWrap);
  container.appendChild(headerRow);

  const refreshHeaderStatus = (p: BetaPanelPayload) => {
    const isFetching = p.betaCalcStatus?.isFetching ?? false;
    if (isFetching) {
      statusSpan.textContent = "Calculating\u2026";
      statusSpan.style.color = "var(--ios-blue)";
      recalcBtn.disabled = true;
      recalcBtn.style.opacity = "0.5";
    } else {
      const latest = pickLatestComputedAt(p.allBenchmarkBetas);
      let count = 0;
      for (const [, m] of p.allBenchmarkBetas) count = Math.max(count, m.size);
      const calcText = latest
        ? `Last calculation: ${fmtTime(latest)}`
        : "Last calculation: --";
      statusSpan.textContent = `${calcText}  \u00B7  ${count} symbol(s) with beta data`;
      statusSpan.style.color = "";
      recalcBtn.disabled = false;
      recalcBtn.style.opacity = "";
    }
  };
  refreshHeaderStatus(payload);

  // ── Three-column body ────────────────────────────────────────────────────
  const bodyRow = ui_createElement("div", {
    styleString: "display: flex; gap: 12px; align-items: stretch;",
  });

  // ── LEFT: Summary Matrix ─────────────────────────────────────────────────
  const summaryWrap = ui_createElement("div", {
    // Keep left column width bounded so extra ticker tags cannot expand the whole row.
    styleString:
      "flex: 0 0 auto; min-width: 180px; max-width: 280px;",
  });
  const summaryInner = ui_createElement("div", {});

  const buildSummaryMatrix = (): HTMLElement => {
    const isTarget = exposureMode === "target";
    const matrixLabel = ui_createElement("div", {
      text: isTarget ? "Targeted Weighted Beta" : "Portfolio Weighted Beta",
      styleString: DS_TYPOGRAPHY.heading + " margin-bottom: 6px;",
    });
    if (isTarget) matrixLabel.style.color = "var(--ios-orange, #FF9500)";

    const tbl = ui_createElement("table", {
      styleString:
        tableStyle +
        " font-size: 13px; white-space: nowrap;" +
        (isTarget ? " border-left: 3px solid var(--ios-orange, #FF9500);" : ""),
    }) as HTMLTableElement;

    const thead = document.createElement("thead");

    // Empty group row to align with the 2-row headers in main/right tables
    const grpTr = document.createElement("tr");
    const grpTh = document.createElement("th");
    grpTh.colSpan = 1 + BETA_BENCHMARKS.length;
    grpTh.style.cssText =
      thStyle + " padding: 6px 10px; font-size: 12px; border-bottom: none;";
    grpTr.appendChild(grpTh);
    thead.appendChild(grpTr);

    // Column headers: corner + benchmark labels (SPX, NDX, DJI)
    const headTr = document.createElement("tr");
    const cornerTh = document.createElement("th");
    cornerTh.style.cssText = thStyle + " padding: 6px 10px; font-size: 12px;";
    headTr.appendChild(cornerTh);
    for (const bm of BETA_BENCHMARKS) {
      const th = document.createElement("th");
      const isActiveBm = bm === activeBenchmark;
      th.textContent = BENCHMARK_LABELS[bm] || bm;
      th.style.cssText =
        thStyle +
        ` text-align: center; padding: 6px 10px; font-size: 12px; font-weight: 700;${isActiveBm ? " border-bottom: 2px solid var(--ios-blue);" : ""}`;
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    tbl.appendChild(thead);

    // Rows: one per horizon (1D, 1W, 1M, 6M, 2Y)
    const tbody = document.createElement("tbody");
    const wbSource = isTarget
      ? (payload.targetPortfolioWeightedBeta ?? payload.portfolioWeightedBeta)
      : payload.portfolioWeightedBeta;
    for (const h of HORIZONS) {
      const tr = document.createElement("tr");
      tr.style.cssText = "cursor: default;";

      const labelTd = document.createElement("td");
      labelTd.textContent = HORIZON_LABELS[h];
      labelTd.style.cssText =
        cellBase +
        " text-align: left; font-weight: 700; font-size: 13px; padding: 6px 10px; border-left: 3px solid transparent;";
      tr.appendChild(labelTd);

      for (const bm of BETA_BENCHMARKS) {
        const wb = wbSource[bm];
        const val = wb?.[h] ?? null;
        const isActiveBm = bm === activeBenchmark;
        const td = document.createElement("td");
        td.textContent = fmtBeta(val);
        td.style.cssText =
          cellBase +
          ` text-align: center; font-weight: 700; font-size: 13px; padding: 6px 10px; color: ${betaColor(val)}; background: ${betaBgColor(val)};` +
          (isActiveBm ? " cursor: pointer;" : "");
        td.addEventListener("click", () => {
          activeBenchmark = bm;
          sortKey = { ...sortKey, benchmark: bm } as SortKey;
          bmTabs.setActive(bm);
          refreshAll();
        });
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);

    const wrap = document.createElement("div");
    wrap.appendChild(matrixLabel);
    wrap.appendChild(tbl);
    return wrap;
  };

  const refreshSummaryMatrix = () => {
    summaryInner.innerHTML = "";
    summaryInner.appendChild(buildSummaryMatrix());
  };
  refreshSummaryMatrix();
  summaryWrap.appendChild(summaryInner);

  // ── Add Ticker input ──────────────────────────────────────────────────
  const tickerSection = ui_createElement("div", {
    styleString: "margin-top: 10px; width: 100%; min-width: 0;",
  });

  const tickerInputRow = ui_createElement("div", {
    styleString:
      "display: flex; gap: 4px; align-items: center; width: 100%; min-width: 0;",
  });
  const tickerInput = ui_createElement("input", {
    props: { type: "text", placeholder: "Add ticker\u2026" },
    styleString:
      "flex: 1; min-width: 0; padding: 4px 8px; font-size: var(--ax-fs-md); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-sm); background: var(--ax-bg-input); color: var(--ax-fg); font-family: var(--ax-font-body); outline: none;",
  }) as HTMLInputElement;
  const tickerAddBtn = ui_createElement("button", {
    text: "+",
    props: { type: "button" },
    styleString:
      DS_BUTTONS.secondary +
      " font-size: 12px; padding: 3px 10px; border-radius: 6px; cursor: pointer; font-weight: 700; line-height: 1;",
  }) as HTMLButtonElement;
  const normalizeTickerSymbol = (value: string): string =>
    value.toUpperCase().trim();
  const hasKnownTickerSymbol = (symbol: string): boolean => {
    if (!symbol) return false;
    if (
      (payload.extraTickers ?? []).some(
        (existing) => normalizeTickerSymbol(existing) === symbol,
      )
    )
      return true;
    if (
      Object.keys(payload.byUnderlying ?? {}).some(
        (existing) => normalizeTickerSymbol(existing) === symbol,
      )
    )
      return true;
    return entries.some(
      (entry) => normalizeTickerSymbol(entry.symbol) === symbol,
    );
  };
  const doAddTicker = () => {
    const val = normalizeTickerSymbol(tickerInput.value);
    if (!val || hasKnownTickerSymbol(val)) {
      tickerInput.value = "";
      return;
    }
    tickerInput.value = "";
    if (payload.onAddTicker) payload.onAddTicker(val);
  };
  tickerAddBtn.addEventListener("click", doAddTicker);
  tickerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAddTicker();
  });
  tickerInputRow.appendChild(tickerInput);
  tickerInputRow.appendChild(tickerAddBtn);
  tickerSection.appendChild(tickerInputRow);

  const extraTagsWrap = ui_createElement("div", {
    styleString:
      "display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4px; margin-top: 6px; width: 100%; max-width: 100%; min-width: 0; overflow-x: hidden;",
  });
  const refreshExtraTags = () => {
    extraTagsWrap.innerHTML = "";
    const extras = payload.extraTickers ?? [];
    for (const sym of extras) {
      const tag = ui_createElement("span", {
        styleString:
          "display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; font-size: 11px; font-weight: 600; background: rgba(0,122,255,0.08); color: var(--ios-blue); border-radius: 4px;",
      });
      tag.appendChild(document.createTextNode(sym));
      const removeBtn = ui_createElement("span", {
        text: "\u00D7",
        styleString:
          "cursor: pointer; font-size: 13px; line-height: 1; margin-left: 2px; color: var(--ios-text-secondary);",
      });
      removeBtn.addEventListener("click", () => {
        if (payload.onRemoveTicker) payload.onRemoveTicker(sym);
      });
      tag.appendChild(removeBtn);
      extraTagsWrap.appendChild(tag);
    }
  };
  refreshExtraTags();
  tickerSection.appendChild(extraTagsWrap);
  summaryWrap.appendChild(tickerSection);

  bodyRow.appendChild(summaryWrap);

  // ── MIDDLE: Benchmark Detail Table ───────────────────────────────────────
  const mainWrap = ui_createElement("div", {
    styleString: "flex: 1 1 0; min-width: 0;",
  });

  const mainHeader = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; margin-bottom: 6px;",
  });
  mainHeader.appendChild(
    ui_createElement("div", {
      text: "Benchmark Detail",
      styleString: DS_TYPOGRAPHY.heading,
    }),
  );

  const bmTabs = buildSegmentControl(
    BETA_BENCHMARKS.map((bm) => ({
      key: bm,
      label: BENCHMARK_LABELS[bm] || bm,
    })),
    activeBenchmark,
    (key) => {
      activeBenchmark = key;
      sortKey = { ...sortKey, benchmark: key } as SortKey;
      bmTabs.setActive(key);
      refreshAll();
    },
  );
  mainHeader.appendChild(bmTabs.el);

  // Current / Target toggle on Benchmark Detail header
  const mainModeTabs = buildSegmentControl(
    [
      { key: "current", label: "Current" },
      { key: "target", label: "Target" },
    ],
    exposureMode,
    switchExposureMode,
  );
  const hasTargets =
    payload.rebalanceTargets &&
    Object.keys(payload.rebalanceTargets).length > 0;
  if (hasTargets) mainHeader.appendChild(mainModeTabs.el);

  mainWrap.appendChild(mainHeader);

  const mainTableWrap = ui_createElement("div", {
    styleString: "overflow-x: auto;",
  });
  mainWrap.appendChild(mainTableWrap);
  bodyRow.appendChild(mainWrap);

  // ── RIGHT: Cross-Benchmark Table ─────────────────────────────────────────
  const rightWrap = ui_createElement("div", {
    styleString: "flex: 1 1 0; min-width: 0;",
  });

  const rightHeader = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; margin-bottom: 6px;",
  });
  rightHeader.appendChild(
    ui_createElement("div", {
      text: "Cross-Benchmark",
      styleString: DS_TYPOGRAPHY.heading,
    }),
  );

  const rightTabs = buildSegmentControl(
    [
      { key: "beta", label: "Beta" },
      { key: "exposure", label: "Exposure" },
      { key: "corrR2", label: "Corr+R\u00B2" },
    ],
    rightMode,
    (key) => {
      if (getShareMode() === "dollarOff" && key === "exposure") return;
      rightMode = key as RightMode;
      rightTabs.setActive(key);
      refreshRightTable();
    },
  );
  rightHeader.appendChild(rightTabs.el);

  // Current / Target toggle on Cross-Benchmark header
  const rightModeTabs = buildSegmentControl(
    [
      { key: "current", label: "Current" },
      { key: "target", label: "Target" },
    ],
    exposureMode,
    switchExposureMode,
  );
  if (hasTargets) rightHeader.appendChild(rightModeTabs.el);

  rightWrap.appendChild(rightHeader);

  const rightTableWrap = ui_createElement("div", {
    styleString: "overflow-x: auto;",
  });
  rightWrap.appendChild(rightTableWrap);
  bodyRow.appendChild(rightWrap);

  container.appendChild(bodyRow);

  // ── Sort helper for headers ──────────────────────────────────────────────
  const makeHeaderCell = (
    label: string,
    sk: SortKey,
    align: "left" | "right" = "right",
  ): HTMLTableCellElement => {
    const th = document.createElement("th");
    const isSorted = JSON.stringify(sk) === JSON.stringify(sortKey);
    const arrow = isSorted ? (sortAsc ? " \u25B2" : " \u25BC") : "";
    th.textContent = label + arrow;
    th.style.cssText =
      thStyle +
      ` text-align: ${align}; cursor: pointer; user-select: none; padding: 4px 6px; font-size: 11px;`;
    th.addEventListener("click", () => {
      const same = JSON.stringify(sk) === JSON.stringify(sortKey);
      if (same) sortAsc = !sortAsc;
      else {
        sortKey = sk;
        sortAsc = sk.kind === "common" && sk.field === "symbol";
      }
      entries = sortEntries(entries, sortKey, sortAsc);
      refreshMainTable();
      refreshRightTable();
      refreshSummaryMatrix();
    });
    return th;
  };

  const getDisplayMul = (): number => {
    const mode = getShareMode();
    if (mode === "10x") return 10;
    if (mode === "custom") return getCustomMultiplier();
    return 1;
  };

  const buildMainTable = (): HTMLElement =>
    buildBenchmarkDetailTable(
      entries,
      activeBenchmark,
      getShareMode() === "dollarOff",
      makeHeaderCell,
      getDisplayMul(),
    );

  const buildRightTable = (): HTMLElement =>
    buildCrossBenchmarkTable(
      entries,
      rightMode,
      getShareMode() === "dollarOff",
      makeHeaderCell,
      getDisplayMul(),
    );

  // ── Refresh functions ────────────────────────────────────────────────────

  const refreshMainTable = () => {
    mainTableWrap.innerHTML = "";
    mainTableWrap.appendChild(buildMainTable());
  };

  const refreshRightTable = () => {
    rightTableWrap.innerHTML = "";
    rightTableWrap.appendChild(buildRightTable());
  };

  const refreshAll = () => {
    refreshSummaryMatrix();
    refreshMainTable();
    refreshRightTable();
  };

  // Initial render
  refreshMainTable();
  refreshRightTable();

  // ── Update method ────────────────────────────────────────────────────────

  container.update = (next: BetaPanelPayload) => {
    payload = next;
    entries = buildEntries(next, exposureMode);
    entries = sortEntries(entries, sortKey, sortAsc);

    // Show/hide Current/Target toggle on both sub-table headers
    const nowHasTargets =
      next.rebalanceTargets && Object.keys(next.rebalanceTargets).length > 0;
    if (nowHasTargets) {
      if (!mainModeTabs.el.parentElement)
        mainHeader.appendChild(mainModeTabs.el);
      if (!rightModeTabs.el.parentElement)
        rightHeader.appendChild(rightModeTabs.el);
    } else {
      if (mainModeTabs.el.parentElement) mainModeTabs.el.remove();
      if (rightModeTabs.el.parentElement) rightModeTabs.el.remove();
      if (exposureMode !== "current") {
        exposureMode = "current";
        mainModeTabs.setActive("current");
        rightModeTabs.setActive("current");
        entries = buildEntries(next, exposureMode);
        entries = sortEntries(entries, sortKey, sortAsc);
      }
    }

    refreshAll();
    refreshExtraTags();
    refreshHeaderStatus(next);
  };

  container.cleanup = () => {
    unsubShareMode();
    log.debug("betaExposure.cleanup.done");
  };

  return container;
}
