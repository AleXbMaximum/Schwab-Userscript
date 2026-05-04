import type { BetaHorizon } from "../../../../backend/computation/beta/types";
import {
  extractModeCurrentValues,
  REBALANCE_MODES,
} from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type {
  RebalanceAnchorMode,
  RebalanceModeId,
} from "../../../../shared/types/core";
import { DS_COLORS } from "../../../components/core/styles/theme";
import {
  type Payload,
  type SortKey,
  CURRENT_MODES,
  thStyle,
  tdStyle,
  tableStyle,
  cellInputStyle,
  deviationColor,
  formatTargetInputValue,
  resolveQuoteLastPrice,
  resolveAllLinkedTargets,
} from "./rebalanceTypes";
import {
  type MaskConfig,
  buildRepeatedHeaderRows,
  buildSummaryRow,
  curSpanStyle,
  devSpanStyle,
  groupBorderStyle,
  curCellStyle,
  tgtCellStyle,
  devCellStyle,
} from "./rebalanceTableHelpers";

export type BuildTableState = {
  tableContainer: HTMLElement;

  curRefs: Map<string, HTMLElement>;
  tgtRefs: Map<string, HTMLElement>;
  devRefs: Map<string, HTMLElement>;
  priceRefs: Map<string, HTMLElement>;
  totalCurRefs: Map<RebalanceModeId, HTMLElement>;
  totalTgtRefs: Map<RebalanceAnchorMode, HTMLElement>;
  totalDevRefs: Map<RebalanceAnchorMode, HTMLElement>;
  eqTotalCurRefs: Map<RebalanceModeId, HTMLElement>;
  eqTotalTgtRefs: Map<RebalanceAnchorMode, HTMLElement>;
  eqTotalDevRefs: Map<RebalanceAnchorMode, HTMLElement>;
  etfTotalCurRefs: Map<RebalanceModeId, HTMLElement>;
  etfTotalTgtRefs: Map<RebalanceAnchorMode, HTMLElement>;
  etfTotalDevRefs: Map<RebalanceAnchorMode, HTMLElement>;
  watchlistTotalCurRefs: Map<RebalanceModeId, HTMLElement>;
  watchlistTotalTgtRefs: Map<RebalanceAnchorMode, HTMLElement>;
  watchlistTotalDevRefs: Map<RebalanceAnchorMode, HTMLElement>;
  inputsByKey: Map<string, Map<RebalanceAnchorMode, HTMLInputElement>>;
  anchorByKey: Map<string, RebalanceAnchorMode>;

  setLastEquityKeys: (keys: string[]) => void;
  setLastEtfKeys: (keys: string[]) => void;
  setLastWatchlistKeys: (keys: string[]) => void;
  setRenderedKeyList: (s: string) => void;
  setLastTargetsHash: (s: string) => void;

  getBetaHorizon: () => BetaHorizon;
  getSortKey: () => SortKey | null;
  getSortAsc: () => boolean;

  maskConfig: MaskConfig;
  MASKED_TEXT: string;

  getAllKeys: (p: Payload) => string[];
  getVisibleMetricGroups: () => RebalanceAnchorMode[];
  getVisibleGreekModes: () => RebalanceModeId[];
  isMetricMasked: (m: RebalanceAnchorMode) => boolean;
  isGreekMasked: (m: RebalanceModeId) => boolean;
  getDisplayMultiplier: (m: RebalanceModeId) => number;
  handleSort: (key: SortKey) => void;
  handleTargetInput: (key: string, mode: RebalanceAnchorMode) => void;
  saveUnderlyingTarget: (key: string) => void;
  updateAnchorVisuals: (key: string) => void;
};

export function buildRebalanceTable(
  state: BuildTableState,
  p: Payload,
): void {
  const {
    tableContainer,
    curRefs,
    tgtRefs,
    devRefs,
    priceRefs,
    totalCurRefs,
    totalTgtRefs,
    totalDevRefs,
    eqTotalCurRefs,
    eqTotalTgtRefs,
    eqTotalDevRefs,
    etfTotalCurRefs,
    etfTotalTgtRefs,
    etfTotalDevRefs,
    watchlistTotalCurRefs,
    watchlistTotalTgtRefs,
    watchlistTotalDevRefs,
    inputsByKey,
    anchorByKey,
    maskConfig,
    MASKED_TEXT,
    isMetricMasked,
    isGreekMasked,
    getDisplayMultiplier,
    handleSort,
    handleTargetInput,
    saveUnderlyingTarget,
    updateAnchorVisuals,
  } = state;
  const betaHorizon = state.getBetaHorizon();
  const sortKey = state.getSortKey();
  const sortAsc = state.getSortAsc();

  tableContainer.innerHTML = "";
  curRefs.clear();
  tgtRefs.clear();
  devRefs.clear();
  priceRefs.clear();
  totalCurRefs.clear();
  totalTgtRefs.clear();
  totalDevRefs.clear();
  eqTotalCurRefs.clear();
  eqTotalTgtRefs.clear();
  eqTotalDevRefs.clear();
  etfTotalCurRefs.clear();
  etfTotalTgtRefs.clear();
  etfTotalDevRefs.clear();
  watchlistTotalCurRefs.clear();
  watchlistTotalTgtRefs.clear();
  watchlistTotalDevRefs.clear();

  const keys = state.getAllKeys(p);
  state.setRenderedKeyList(keys.join(","));
  state.setLastTargetsHash(JSON.stringify(p.rebalanceTargets ?? {}));

  const curValues = new Map<RebalanceModeId, Map<string, number>>();
  CURRENT_MODES.forEach((m) =>
    curValues.set(
      m,
      extractModeCurrentValues(m, p.derived, p.betaData, betaHorizon),
    ),
  );

  const linked = resolveAllLinkedTargets(p.rebalanceTargets, p, betaHorizon);

  anchorByKey.clear();
  if (p.rebalanceTargets) {
    for (const [key, entry] of Object.entries(p.rebalanceTargets)) {
      anchorByKey.set(key, entry.anchor);
    }
  }

  const sortedKeys = [...keys];
  if (sortKey) {
    const sk = sortKey;
    const dir = sortAsc ? 1 : -1;
    if (sk === "underlying") {
      sortedKeys.sort((a, b) => a.localeCompare(b) * dir);
    } else if (sk.startsWith("tgt:")) {
      const mode = sk.slice(4) as RebalanceAnchorMode;
      sortedKeys.sort(
        (a, b) =>
          ((linked.get(a)?.[mode] ?? 0) - (linked.get(b)?.[mode] ?? 0)) * dir,
      );
    } else if (sk.startsWith("dev:")) {
      const mode = sk.slice(4) as RebalanceAnchorMode;
      sortedKeys.sort((a, b) => {
        const curA = curValues.get(mode)?.get(a) ?? 0;
        const curB = curValues.get(mode)?.get(b) ?? 0;
        const devA = (linked.get(a)?.[mode] ?? curA) - curA;
        const devB = (linked.get(b)?.[mode] ?? curB) - curB;
        return (devA - devB) * dir;
      });
    } else if (sk === "_beta") {
      sortedKeys.sort((a, b) => {
        const bA = p.betaData?.get(a)?.[betaHorizon]?.beta ?? 0;
        const bB = p.betaData?.get(b)?.[betaHorizon]?.beta ?? 0;
        return (bA - bB) * dir;
      });
    } else {
      const vals = curValues.get(sk as RebalanceModeId);
      sortedKeys.sort(
        (a, b) => ((vals?.get(a) ?? 0) - (vals?.get(b) ?? 0)) * dir,
      );
    }
  }

  const table = document.createElement("table");
  table.style.cssText =
    tableStyle +
    " border-collapse:collapse; table-layout:auto; width:max-content; min-width:100%;";

  const thead = document.createElement("thead");

  const visibleMetrics = state.getVisibleMetricGroups();
  const visibleGreeks = state.getVisibleGreekModes();

  const groupRow = document.createElement("tr");
  const emptyTh = document.createElement("th");
  emptyTh.colSpan = 2;
  emptyTh.style.cssText = thStyle + " padding:2px 4px;";
  groupRow.appendChild(emptyTh);

  visibleMetrics.forEach((m) => {
    const gh = document.createElement("th");
    gh.colSpan = 3;
    gh.textContent = REBALANCE_MODES[m].shortLabel;
    gh.style.cssText =
      thStyle +
      " text-align:center; font-size:11px; padding:2px 4px; letter-spacing:0.5px;" +
      groupBorderStyle;
    groupRow.appendChild(gh);
  });

  const greekGroupTh = document.createElement("th");
  greekGroupTh.colSpan = visibleGreeks.length + 1;
  greekGroupTh.textContent = "Greeks";
  greekGroupTh.style.cssText =
    thStyle +
    " text-align:center; font-size:11px; padding:2px 4px; letter-spacing:0.5px;" +
    groupBorderStyle;
  groupRow.appendChild(greekGroupTh);

  thead.appendChild(groupRow);

  const lr = document.createElement("tr");
  const ulTh = document.createElement("th");
  const ulArrow =
    sortKey === "underlying" ? (sortAsc ? " ▲" : " ▼") : "";
  ulTh.textContent = "Ticker" + ulArrow;
  ulTh.style.cssText =
    thStyle +
    " width:60px; min-width:60px; font-size:11px; padding:3px 6px; cursor:pointer; user-select:none;";
  ulTh.addEventListener("click", () => handleSort("underlying"));
  lr.appendChild(ulTh);

  const priceTh = document.createElement("th");
  priceTh.textContent = "Price";
  priceTh.style.cssText =
    thStyle +
    " min-width:52px; font-size:11px; padding:3px 4px; text-align:right;";
  lr.appendChild(priceTh);

  const sortableThStyle =
    thStyle +
    " min-width:52px; font-size:11px; padding:3px 4px; text-align:right; cursor:pointer; user-select:none;";
  visibleMetrics.forEach((m) => {
    const cArrow = sortKey === m ? (sortAsc ? " ▲" : " ▼") : "";
    const cTh = document.createElement("th");
    cTh.textContent = "current" + cArrow;
    cTh.title = REBALANCE_MODES[m].label + " current (click to sort)";
    cTh.style.cssText = sortableThStyle + groupBorderStyle;
    cTh.addEventListener("click", () => handleSort(m));
    lr.appendChild(cTh);

    const tKey: SortKey = `tgt:${m}`;
    const tArrow = sortKey === tKey ? (sortAsc ? " ▲" : " ▼") : "";
    const tTh = document.createElement("th");
    tTh.textContent = "target" + tArrow;
    tTh.title = REBALANCE_MODES[m].label + " target (click to sort)";
    tTh.style.cssText = sortableThStyle;
    tTh.addEventListener("click", () => handleSort(tKey));
    lr.appendChild(tTh);

    const dKey: SortKey = `dev:${m}`;
    const dArrow = sortKey === dKey ? (sortAsc ? " ▲" : " ▼") : "";
    const dTh = document.createElement("th");
    dTh.textContent = "dev" + dArrow;
    dTh.title = REBALANCE_MODES[m].label + " deviation (click to sort)";
    dTh.style.cssText = sortableThStyle;
    dTh.addEventListener("click", () => handleSort(dKey));
    lr.appendChild(dTh);
  });

  const betaArrow =
    sortKey === "_beta" ? (sortAsc ? " ▲" : " ▼") : "";
  const betaTh = document.createElement("th");
  betaTh.textContent = "β" + betaArrow;
  betaTh.title = "Beta (click to sort)";
  betaTh.style.cssText =
    thStyle +
    " min-width:42px; font-size:11px; padding:3px 4px; text-align:right; cursor:pointer; user-select:none;" +
    groupBorderStyle;
  betaTh.addEventListener("click", () => handleSort("_beta"));
  lr.appendChild(betaTh);

  visibleGreeks.forEach((m) => {
    const arrow = sortKey === m ? (sortAsc ? " ▲" : " ▼") : "";
    const th = document.createElement("th");
    th.textContent = REBALANCE_MODES[m].shortLabel + arrow;
    th.title = REBALANCE_MODES[m].label + " (click to sort)";
    th.style.cssText =
      thStyle +
      " min-width:48px; font-size:11px; padding:3px 4px; text-align:right; cursor:pointer; user-select:none;";
    th.addEventListener("click", () => handleSort(m));
    lr.appendChild(th);
  });

  thead.appendChild(lr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const byU = p.derived.byUnderlying ?? {};

  const etfSet = p.etfUnderlyingKeys ?? new Set<string>();
  const holdingKeys = new Set<string>(Object.keys(byU));
  const equityKeys: string[] = [];
  const etfKeys: string[] = [];
  const watchlistKeys: string[] = [];
  for (const key of sortedKeys) {
    if (!holdingKeys.has(key)) {
      watchlistKeys.push(key);
    } else if (etfSet.has(key)) {
      etfKeys.push(key);
    } else {
      equityKeys.push(key);
    }
  }
  state.setLastEquityKeys(equityKeys);
  state.setLastEtfKeys(etfKeys);
  state.setLastWatchlistKeys(watchlistKeys);
  const hasBothGroups = equityKeys.length > 0 && etfKeys.length > 0;
  const hasWatchlist = watchlistKeys.length > 0;

  function appendDataRow(key: string, zebraIdx: number) {
    const tr = document.createElement("tr");
    if (zebraIdx % 2 === 1) tr.style.background = "var(--ax-bg-glass-inset)";

    const tdSym = document.createElement("td");
    tdSym.textContent = key;
    tdSym.style.cssText =
      tdStyle +
      " width:60px; min-width:60px; font-weight:600; font-size:13px; padding:3px 6px; white-space:nowrap;";
    tr.appendChild(tdSym);

    const priceVal = resolveQuoteLastPrice(key, p);
    const priceText =
      typeof priceVal === "number" && Number.isFinite(priceVal)
        ? "$" + priceVal.toFixed(2)
        : "-";
    const tdPrice = document.createElement("td");
    tdPrice.textContent = priceText;
    tdPrice.style.cssText =
      curCellStyle +
      " text-align:right; font-size:12px; color:var(--ios-text-secondary); font-variant-numeric:tabular-nums;";
    priceRefs.set(key, tdPrice);
    tr.appendChild(tdPrice);

    const lt = linked.get(key);
    const hasTarget = !!lt;
    const keyInputs = new Map<RebalanceAnchorMode, HTMLInputElement>();

    visibleMetrics.forEach((mode) => {
      const config = REBALANCE_MODES[mode];
      const masked = isMetricMasked(mode);
      const mul = getDisplayMultiplier(mode);

      const cur = curValues.get(mode)?.get(key) ?? 0;
      const tdCur = document.createElement("td");
      tdCur.style.cssText =
        curCellStyle + " text-align:right;" + groupBorderStyle;
      const curEl = document.createElement("span");
      curEl.textContent = masked
        ? MASKED_TEXT
        : config.formatValue(cur * mul);
      curEl.style.cssText = curSpanStyle;
      curRefs.set(`${mode}:${key}`, curEl);
      tdCur.appendChild(curEl);
      tr.appendChild(tdCur);

      const tdTgt = document.createElement("td");
      tdTgt.style.cssText = tgtCellStyle;

      if (masked) {
        const maskedSpan = document.createElement("span");
        maskedSpan.textContent = MASKED_TEXT;
        maskedSpan.style.cssText =
          "font-size:12px; color:var(--ios-text-secondary);";
        tdTgt.appendChild(maskedSpan);
      } else {
        let input = inputsByKey.get(key)?.get(mode);
        if (!input) {
          input = document.createElement("input");
          input.type = "number";
          input.step = config.isPct ? "0.5" : "any";
          if (config.isPct) {
            input.min = "0";
            input.max = "100";
          }
          input.placeholder = "—";

          const capturedMode = mode;
          const capturedKey = key;
          input.addEventListener("input", () => {
            handleTargetInput(capturedKey, capturedMode);
          });
          input.addEventListener("change", () => {
            saveUnderlyingTarget(capturedKey);
          });
        }

        if (hasTarget) {
          input.value = formatTargetInputValue(lt[mode] * mul, config.isPct);
        } else {
          input.value = "";
        }
        input.style.cssText = cellInputStyle;
        keyInputs.set(mode, input);
        tdTgt.appendChild(input);
      }
      tr.appendChild(tdTgt);

      const tdDev = document.createElement("td");
      tdDev.style.cssText = devCellStyle + " text-align:right;";
      const devEl = document.createElement("span");

      if (masked) {
        devEl.textContent = MASKED_TEXT;
        devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
      } else if (hasTarget) {
        const tgt = lt[mode];
        const dev = cur - tgt;
        devEl.textContent =
          (dev >= 0 ? "+" : "") + config.formatValue(dev * mul);
        devEl.style.cssText = devSpanStyle(deviationColor(dev));
      } else {
        devEl.textContent = "-";
        devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
      }
      devRefs.set(`${mode}:${key}`, devEl);
      tdDev.appendChild(devEl);
      tr.appendChild(tdDev);
    });
    inputsByKey.set(key, keyInputs);
    updateAnchorVisuals(key);

    const betaRaw = p.betaData?.get(key)?.[betaHorizon]?.beta;
    const betaVal =
      typeof betaRaw === "number" && Number.isFinite(betaRaw) ? betaRaw : null;
    const tdBeta = document.createElement("td");
    tdBeta.textContent = betaVal != null ? betaVal.toFixed(2) : "-";
    tdBeta.style.cssText =
      curCellStyle +
      " text-align:right; font-size:12px; color:var(--ios-text-secondary); font-variant-numeric:tabular-nums;" +
      groupBorderStyle;
    curRefs.set(`_beta:${key}`, tdBeta);
    tr.appendChild(tdBeta);

    visibleGreeks.forEach((mode) => {
      const config = REBALANCE_MODES[mode];
      const cur = curValues.get(mode)?.get(key) ?? 0;
      const td = document.createElement("td");
      td.style.cssText = curCellStyle + " text-align:right;";
      const curEl = document.createElement("span");
      curEl.textContent = isGreekMasked(mode)
        ? MASKED_TEXT
        : config.formatValue(cur * getDisplayMultiplier(mode));
      curEl.style.cssText = curSpanStyle;
      curRefs.set(`${mode}:${key}`, curEl);
      td.appendChild(curEl);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  if (hasBothGroups || hasWatchlist) {
    let hasRenderedSection = false;

    const appendGroupedSection = (
      sectionKeys: string[],
      summaryLabel: string,
      curRefMap: Map<RebalanceModeId, HTMLElement>,
      tgtRefMap: Map<RebalanceAnchorMode, HTMLElement>,
      devRefMap: Map<RebalanceAnchorMode, HTMLElement>,
    ) => {
      if (sectionKeys.length === 0) return;
      if (hasRenderedSection) {
        const [repeatGroupRow, repeatSubRow] = buildRepeatedHeaderRows(
          visibleMetrics,
          visibleGreeks,
        );
        tbody.appendChild(repeatGroupRow);
        tbody.appendChild(repeatSubRow);
      }
      sectionKeys.forEach((key, i) => appendDataRow(key, i));
      tbody.appendChild(
        buildSummaryRow(
          summaryLabel,
          sectionKeys,
          curValues,
          linked,
          "border-top:2px solid var(--ios-border); background:var(--ax-bg-glass-inset); font-weight:700;",
          curRefMap,
          tgtRefMap,
          devRefMap,
          maskConfig,
          visibleMetrics,
          visibleGreeks,
        ),
      );
      hasRenderedSection = true;
    };

    if (equityKeys.length > 0) {
      appendGroupedSection(
        equityKeys,
        "Equities Summary",
        eqTotalCurRefs,
        eqTotalTgtRefs,
        eqTotalDevRefs,
      );
    }

    if (etfKeys.length > 0) {
      appendGroupedSection(
        etfKeys,
        "ETFs Summary",
        etfTotalCurRefs,
        etfTotalTgtRefs,
        etfTotalDevRefs,
      );
    }

    if (hasWatchlist) {
      appendGroupedSection(
        watchlistKeys,
        "Watchlist Summary",
        watchlistTotalCurRefs,
        watchlistTotalTgtRefs,
        watchlistTotalDevRefs,
      );
    }
  } else {
    sortedKeys.forEach((key, i) => appendDataRow(key, i));
  }

  table.appendChild(tbody);

  const tfoot = document.createElement("tfoot");
  const totalTr = buildSummaryRow(
    "Total",
    sortedKeys,
    curValues,
    linked,
    "border-top:2px solid var(--ios-border);",
    totalCurRefs,
    totalTgtRefs,
    totalDevRefs,
    maskConfig,
    visibleMetrics,
    visibleGreeks,
  );
  tfoot.appendChild(totalTr);
  table.appendChild(tfoot);
  tableContainer.appendChild(table);
}
