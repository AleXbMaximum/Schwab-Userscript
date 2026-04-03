import type { LinkedTargetValues } from "../../../../backend/computation/rebalance/RebalanceCalculator";
import { REBALANCE_MODES } from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type{ RebalanceAnchorMode, RebalanceModeId } from "../../../../shared/types/core";
import { DS_COLORS } from "../../../components/core/theme";
import {
  CURRENT_MODES,
  TARGET_MODES,
  DEVIATION_MODES,
  METRIC_GROUPS,
  GREEK_MODES,
  PRIVACY_HIDDEN_METRICS,
  PRIVACY_HIDDEN_GREEKS,
  thStyle,
  tdStyle,
  deviationColor,
} from "./rebalanceTypes";

// ── Mask config type ──

export interface MaskConfig {
  isMetricMasked: (m: RebalanceAnchorMode) => boolean;
  isGreekMasked: (m: RebalanceModeId) => boolean;
  /** Returns the display multiplier for a given mode (1 when no magnification). */
  getDisplayMultiplier: (m: RebalanceModeId) => number;
  MASKED_TEXT: string;
}

// ── Fixed-width cell styles ──

export const curSpanStyle =
  "display:inline-block; min-width:52px; text-align:right; font-size:12px; color:var(--ios-text-secondary); font-variant-numeric:tabular-nums;";
export const devSpanStyle = (color: string) =>
  `display:inline-block; min-width:52px; text-align:right; font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; color:${color};`;
export const groupBorderStyle = " border-left:2px solid var(--ios-border);";
export const curCellStyle = tdStyle + " padding:2px 4px; min-width:52px;";
export const tgtCellStyle =
  tdStyle + " padding:2px 3px; min-width:52px; text-align:right;";
export const devCellStyle = tdStyle + " padding:2px 4px; min-width:52px;";

// ── Repeated header rows for grouped sections ──

export function buildRepeatedHeaderRows(
  visMetrics: RebalanceAnchorMode[] = METRIC_GROUPS,
  visGreeks: RebalanceModeId[] = GREEK_MODES,
): [HTMLTableRowElement, HTMLTableRowElement] {
  const groupRow = document.createElement("tr");
  const emptyCell = document.createElement("td");
  emptyCell.colSpan = 2;
  emptyCell.style.cssText = thStyle + " padding:2px 4px;";
  groupRow.appendChild(emptyCell);

  visMetrics.forEach((mode) => {
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = REBALANCE_MODES[mode].shortLabel;
    td.style.cssText =
      thStyle +
      " text-align:center; font-size:11px; padding:2px 4px; letter-spacing:0.5px;" +
      groupBorderStyle;
    groupRow.appendChild(td);
  });

  const greekGroup = document.createElement("td");
  greekGroup.colSpan = visGreeks.length + 1;
  greekGroup.textContent = "Greeks";
  greekGroup.style.cssText =
    thStyle +
    " text-align:center; font-size:11px; padding:2px 4px; letter-spacing:0.5px;" +
    groupBorderStyle;
  groupRow.appendChild(greekGroup);

  const subRow = document.createElement("tr");
  const tickerCell = document.createElement("td");
  tickerCell.textContent = "ticker";
  tickerCell.style.cssText =
    thStyle + " width:60px; min-width:60px; font-size:11px; padding:3px 6px;";
  subRow.appendChild(tickerCell);

  const priceCell = document.createElement("td");
  priceCell.textContent = "price";
  priceCell.style.cssText =
    thStyle +
    " min-width:52px; font-size:11px; padding:3px 4px; text-align:right;";
  subRow.appendChild(priceCell);

  const subStyle =
    thStyle +
    " min-width:52px; font-size:11px; padding:3px 4px; text-align:right;";
  visMetrics.forEach(() => {
    const cur = document.createElement("td");
    cur.textContent = "current";
    cur.style.cssText = subStyle + groupBorderStyle;
    subRow.appendChild(cur);

    const tgt = document.createElement("td");
    tgt.textContent = "target";
    tgt.style.cssText = subStyle;
    subRow.appendChild(tgt);

    const dev = document.createElement("td");
    dev.textContent = "dev";
    dev.style.cssText = subStyle;
    subRow.appendChild(dev);
  });

  const betaCell = document.createElement("td");
  betaCell.textContent = "\u03B2";
  betaCell.style.cssText =
    thStyle +
    " min-width:42px; font-size:11px; padding:3px 4px; text-align:right;" +
    groupBorderStyle;
  subRow.appendChild(betaCell);

  visGreeks.forEach((mode) => {
    const td = document.createElement("td");
    td.textContent = REBALANCE_MODES[mode].shortLabel;
    td.style.cssText =
      thStyle +
      " min-width:48px; font-size:11px; padding:3px 4px; text-align:right;";
    subRow.appendChild(td);
  });

  return [groupRow, subRow];
}

// ── Summary row builder ──

export function buildSummaryRow(
  label: string,
  keysInGroup: string[],
  curValues: Map<RebalanceModeId, Map<string, number>>,
  linked: Map<string, LinkedTargetValues>,
  rowStyleExtra: string,
  curRefMap: Map<RebalanceModeId, HTMLElement>,
  tgtRefMap: Map<RebalanceAnchorMode, HTMLElement>,
  devRefMap: Map<RebalanceAnchorMode, HTMLElement>,
  maskConfig: MaskConfig,
  visMetrics: RebalanceAnchorMode[] = METRIC_GROUPS,
  visGreeks: RebalanceModeId[] = GREEK_MODES,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.style.cssText = rowStyleExtra;
  const keySet = new Set(keysInGroup);

  const tdLabel = document.createElement("td");
  tdLabel.textContent = label;
  tdLabel.colSpan = 2;
  tdLabel.style.cssText =
    tdStyle + " font-weight:700; font-size:13px; padding:3px 6px;";
  tr.appendChild(tdLabel);

  visMetrics.forEach((mode) => {
    const config = REBALANCE_MODES[mode];
    const curMap = curValues.get(mode)!;
    const isShares = mode === "shares";
    const masked = maskConfig.isMetricMasked(mode);
    const mul = maskConfig.getDisplayMultiplier(mode);

    let totalCur = 0;
    curMap.forEach((v, k) => {
      if (keySet.has(k)) totalCur += v;
    });

    // Current total cell
    const tdCur = document.createElement("td");
    tdCur.style.cssText =
      curCellStyle + " text-align:right;" + groupBorderStyle;
    const curEl = document.createElement("span");
    curEl.textContent = masked
      ? maskConfig.MASKED_TEXT
      : isShares
        ? "\u2014"
        : config.formatValue(totalCur * mul);
    curEl.style.cssText = curSpanStyle.replace(
      "color:var(--ios-text-secondary)",
      "color:var(--ios-text-secondary); font-weight:600",
    );
    curRefMap.set(mode, curEl);
    tdCur.appendChild(curEl);
    tr.appendChild(tdCur);

    // Target total cell
    const tdTgt = document.createElement("td");
    tdTgt.style.cssText = tgtCellStyle + " text-align:right;";
    const tgtEl = document.createElement("span");

    if (masked) {
      tgtEl.textContent = maskConfig.MASKED_TEXT;
      tgtEl.style.cssText =
        "display:inline-block; min-width:44px; text-align:right; font-size:12px; " +
        "font-weight:600; font-variant-numeric:tabular-nums; color:var(--ios-text-primary);";
    } else if (isShares) {
      tgtEl.textContent = "\u2014";
      tgtEl.style.cssText =
        "display:inline-block; min-width:44px; text-align:right; font-size:12px; " +
        "font-weight:600; font-variant-numeric:tabular-nums; color:var(--ios-text-primary);";
    } else {
      let totalTgt = 0;
      const seenKeys = new Set<string>();
      linked.forEach((lt, key) => {
        if (!keySet.has(key)) return;
        seenKeys.add(key);
        totalTgt += lt[mode];
      });
      curMap.forEach((v, key) => {
        if (!keySet.has(key)) return;
        if (!seenKeys.has(key)) totalTgt += v;
      });

      if (config.isPct) {
        const targetColor =
          Math.abs(totalTgt - 100) < 1
            ? DS_COLORS.positive
            : totalTgt > 100
              ? DS_COLORS.negative
              : DS_COLORS.neutral;
        tgtEl.style.cssText =
          `display:inline-block; min-width:44px; text-align:right; font-size:12px; ` +
          `font-weight:700; font-variant-numeric:tabular-nums; color:${targetColor};`;
      } else {
        tgtEl.style.cssText =
          "display:inline-block; min-width:44px; text-align:right; font-size:12px; " +
          "font-weight:600; font-variant-numeric:tabular-nums; color:var(--ios-text-primary);";
      }
      tgtEl.textContent = config.formatValue(totalTgt * mul);
    }
    tgtRefMap.set(mode, tgtEl);
    tdTgt.appendChild(tgtEl);
    tr.appendChild(tdTgt);

    // Deviation total cell
    const tdDev = document.createElement("td");
    tdDev.style.cssText = devCellStyle + " text-align:right;";
    const devEl = document.createElement("span");

    if (masked) {
      devEl.textContent = maskConfig.MASKED_TEXT;
      devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
    } else if (isShares) {
      devEl.textContent = "\u2014";
      devEl.style.cssText = devSpanStyle(DS_COLORS.textSecondary);
    } else {
      let totalTgt2 = 0;
      const seenKeys2 = new Set<string>();
      linked.forEach((lt, key) => {
        if (!keySet.has(key)) return;
        seenKeys2.add(key);
        totalTgt2 += lt[mode];
      });
      curMap.forEach((v, key) => {
        if (!keySet.has(key)) return;
        if (!seenKeys2.has(key)) totalTgt2 += v;
      });
      const dev = totalCur - totalTgt2;
      devEl.textContent = (dev >= 0 ? "+" : "") + config.formatValue(dev * mul);
      devEl.style.cssText = devSpanStyle(deviationColor(dev));
    }
    devRefMap.set(mode, devEl);
    tdDev.appendChild(devEl);
    tr.appendChild(tdDev);
  });

  // Beta total (empty) — first in Greeks group
  const tdBeta = document.createElement("td");
  tdBeta.style.cssText = curCellStyle + " text-align:right;" + groupBorderStyle;
  tr.appendChild(tdBeta);

  // Greek totals
  visGreeks.forEach((mode) => {
    const config = REBALANCE_MODES[mode];
    const curMap = curValues.get(mode)!;
    const mul = maskConfig.getDisplayMultiplier(mode);
    let totalCur = 0;
    curMap.forEach((v, k) => {
      if (keySet.has(k)) totalCur += v;
    });
    const td = document.createElement("td");
    td.style.cssText = curCellStyle + " text-align:right;";
    const curEl = document.createElement("span");
    curEl.textContent = maskConfig.isGreekMasked(mode)
      ? maskConfig.MASKED_TEXT
      : config.formatValue(totalCur * mul);
    curEl.style.cssText = curSpanStyle.replace(
      "color:var(--ios-text-secondary)",
      "color:var(--ios-text-secondary); font-weight:600",
    );
    curRefMap.set(mode, curEl);
    td.appendChild(curEl);
    tr.appendChild(td);
  });

  return tr;
}

// ── Update summary refs (incremental) ──

export function updateSummaryRefs(
  keysInGroup: string[],
  curValues: Map<RebalanceModeId, Map<string, number>>,
  linked: Map<string, LinkedTargetValues>,
  curRefMap: Map<RebalanceModeId, HTMLElement>,
  tgtRefMap: Map<RebalanceAnchorMode, HTMLElement>,
  devRefMap: Map<RebalanceAnchorMode, HTMLElement>,
  maskConfig: MaskConfig,
): void {
  const keySet = new Set(keysInGroup);

  CURRENT_MODES.forEach((mode) => {
    const curEl = curRefMap.get(mode);
    if (!curEl) return;
    if (mode === "shares") {
      curEl.textContent = "\u2014";
      return;
    }
    const masked = PRIVACY_HIDDEN_METRICS.has(mode as RebalanceAnchorMode)
      ? maskConfig.isMetricMasked(mode as RebalanceAnchorMode)
      : PRIVACY_HIDDEN_GREEKS.has(mode)
        ? maskConfig.isGreekMasked(mode)
        : false;
    if (masked) {
      curEl.textContent = maskConfig.MASKED_TEXT;
      return;
    }
    const mul = maskConfig.getDisplayMultiplier(mode);
    const curMap = curValues.get(mode)!;
    let totalCur = 0;
    curMap.forEach((v, k) => {
      if (keySet.has(k)) totalCur += v;
    });
    curEl.textContent = REBALANCE_MODES[mode].formatValue(totalCur * mul);
  });

  TARGET_MODES.forEach((mode) => {
    const tgtEl = tgtRefMap.get(mode);
    if (!tgtEl) return;
    if (mode === "shares") {
      tgtEl.textContent = "\u2014";
      return;
    }
    if (maskConfig.isMetricMasked(mode)) {
      tgtEl.textContent = maskConfig.MASKED_TEXT;
      return;
    }

    const config = REBALANCE_MODES[mode];
    const mul = maskConfig.getDisplayMultiplier(mode);
    const curMap = curValues.get(mode)!;
    let totalTgt = 0;
    const seenKeys = new Set<string>();
    linked.forEach((lt, key) => {
      if (!keySet.has(key)) return;
      seenKeys.add(key);
      totalTgt += lt[mode];
    });
    curMap.forEach((v, key) => {
      if (!keySet.has(key)) return;
      if (!seenKeys.has(key)) totalTgt += v;
    });

    if (config.isPct) {
      const targetColor =
        Math.abs(totalTgt - 100) < 1
          ? DS_COLORS.positive
          : totalTgt > 100
            ? DS_COLORS.negative
            : DS_COLORS.neutral;
      tgtEl.style.cssText =
        `display:inline-block; min-width:44px; text-align:right; font-size:12px; ` +
        `font-weight:700; font-variant-numeric:tabular-nums; color:${targetColor};`;
    } else {
      tgtEl.style.cssText =
        "display:inline-block; min-width:44px; text-align:right; font-size:12px; " +
        "font-weight:600; font-variant-numeric:tabular-nums; color:var(--ios-text-primary);";
    }
    tgtEl.textContent = config.formatValue(totalTgt * mul);
  });

  DEVIATION_MODES.forEach((mode) => {
    const devEl = devRefMap.get(mode);
    if (!devEl) return;
    if (mode === "shares") {
      devEl.textContent = "\u2014";
      return;
    }
    if (maskConfig.isMetricMasked(mode)) {
      devEl.textContent = maskConfig.MASKED_TEXT;
      devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
      return;
    }

    const config = REBALANCE_MODES[mode];
    const mul = maskConfig.getDisplayMultiplier(mode);
    const curMap = curValues.get(mode)!;
    let totalCur = 0;
    curMap.forEach((v, k) => {
      if (keySet.has(k)) totalCur += v;
    });
    let totalTgt = 0;
    const seenKeys = new Set<string>();
    linked.forEach((lt, key) => {
      if (!keySet.has(key)) return;
      seenKeys.add(key);
      totalTgt += lt[mode];
    });
    curMap.forEach((v, key) => {
      if (!keySet.has(key)) return;
      if (!seenKeys.has(key)) totalTgt += v;
    });
    const dev = totalCur - totalTgt;
    devEl.textContent = (dev >= 0 ? "+" : "") + config.formatValue(dev * mul);
    devEl.style.cssText = devSpanStyle(deviationColor(dev));
  });
}
