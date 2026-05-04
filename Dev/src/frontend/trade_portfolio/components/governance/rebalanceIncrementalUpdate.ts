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
  CURRENT_MODES,
  TARGET_MODES,
  DEVIATION_MODES,
  PRIVACY_HIDDEN_METRICS,
  PRIVACY_HIDDEN_GREEKS,
  deviationColor,
  formatTargetInputValue,
  resolveQuoteLastPrice,
  resolveAllLinkedTargets,
} from "./rebalanceTypes";
import {
  type MaskConfig,
  updateSummaryRefs,
  devSpanStyle,
} from "./rebalanceTableHelpers";

export type IncrementalUpdateState = {
  priceRefs: Map<string, HTMLElement>;
  curRefs: Map<string, HTMLElement>;
  devRefs: Map<string, HTMLElement>;
  anchorByKey: Map<string, RebalanceAnchorMode>;
  inputsByKey: Map<string, Map<RebalanceAnchorMode, HTMLInputElement>>;
  dirtyKeys: Set<string>;

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

  getBetaHorizon: () => BetaHorizon;
  getLastEquityKeys: () => string[];
  getLastEtfKeys: () => string[];
  getLastWatchlistKeys: () => string[];

  isMetricMasked: (m: RebalanceAnchorMode) => boolean;
  isGreekMasked: (m: RebalanceModeId) => boolean;
  getDisplayMultiplier: (m: RebalanceModeId) => number;
  getAllKeys: (p: Payload) => string[];
  maskConfig: MaskConfig;
  MASKED_TEXT: string;
};

export function updateRebalanceIncremental(
  state: IncrementalUpdateState,
  p: Payload,
): void {
  const {
    priceRefs,
    curRefs,
    devRefs,
    anchorByKey,
    inputsByKey,
    dirtyKeys,
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
    isMetricMasked,
    isGreekMasked,
    getDisplayMultiplier,
    maskConfig,
    MASKED_TEXT,
  } = state;
  const betaHorizon = state.getBetaHorizon();

  const curValues = new Map<RebalanceModeId, Map<string, number>>();
  CURRENT_MODES.forEach((m) =>
    curValues.set(
      m,
      extractModeCurrentValues(m, p.derived, p.betaData, betaHorizon),
    ),
  );

  const linked = resolveAllLinkedTargets(p.rebalanceTargets, p, betaHorizon);
  const keys = state.getAllKeys(p);

  keys.forEach((key) => {
    const priceEl = priceRefs.get(key);
    if (priceEl) {
      const priceVal = resolveQuoteLastPrice(key, p);
      priceEl.textContent =
        typeof priceVal === "number" && Number.isFinite(priceVal)
          ? "$" + priceVal.toFixed(2)
          : "-";
    }

    CURRENT_MODES.forEach((mode) => {
      const cur = curValues.get(mode)?.get(key) ?? 0;
      const curEl = curRefs.get(`${mode}:${key}`);
      if (!curEl) return;
      const masked = PRIVACY_HIDDEN_METRICS.has(mode as RebalanceAnchorMode)
        ? isMetricMasked(mode as RebalanceAnchorMode)
        : PRIVACY_HIDDEN_GREEKS.has(mode)
          ? isGreekMasked(mode)
          : false;
      curEl.textContent = masked
        ? MASKED_TEXT
        : REBALANCE_MODES[mode].formatValue(cur * getDisplayMultiplier(mode));
    });

    const betaEl = curRefs.get(`_beta:${key}`);
    if (betaEl) {
      const betaRaw = p.betaData?.get(key)?.[betaHorizon]?.beta;
      betaEl.textContent =
        typeof betaRaw === "number" && Number.isFinite(betaRaw)
          ? betaRaw.toFixed(2)
          : "-";
    }

    const lt = linked.get(key);
    const anchor = anchorByKey.get(key);
    const inputs = inputsByKey.get(key);

    if (lt && inputs) {
      if (!dirtyKeys.has(key)) {
        TARGET_MODES.forEach((mode) => {
          if (mode === anchor) return;
          const inp = inputs.get(mode);
          if (inp) {
            const config = REBALANCE_MODES[mode];
            const mul = getDisplayMultiplier(mode);
            inp.value = formatTargetInputValue(lt[mode] * mul, config.isPct);
          }
        });
      }
    }

    DEVIATION_MODES.forEach((mode) => {
      const devEl = devRefs.get(`${mode}:${key}`);
      if (!devEl) return;
      if (isMetricMasked(mode)) {
        devEl.textContent = MASKED_TEXT;
        devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
        return;
      }
      if (!lt) {
        devEl.textContent = "-";
        devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
        return;
      }
      const cur = curValues.get(mode)?.get(key) ?? 0;
      const tgt = lt[mode];
      const dev = cur - tgt;
      const mul = getDisplayMultiplier(mode);
      devEl.textContent =
        (dev >= 0 ? "+" : "") + REBALANCE_MODES[mode].formatValue(dev * mul);
      devEl.style.cssText = devSpanStyle(deviationColor(dev));
    });
  });

  const lastEquityKeys = state.getLastEquityKeys();
  const lastEtfKeys = state.getLastEtfKeys();
  const lastWatchlistKeys = state.getLastWatchlistKeys();

  if (lastEquityKeys.length > 0 && eqTotalCurRefs.size > 0) {
    updateSummaryRefs(
      lastEquityKeys,
      curValues,
      linked,
      eqTotalCurRefs,
      eqTotalTgtRefs,
      eqTotalDevRefs,
      maskConfig,
    );
  }
  if (lastEtfKeys.length > 0 && etfTotalCurRefs.size > 0) {
    updateSummaryRefs(
      lastEtfKeys,
      curValues,
      linked,
      etfTotalCurRefs,
      etfTotalTgtRefs,
      etfTotalDevRefs,
      maskConfig,
    );
  }
  if (lastWatchlistKeys.length > 0 && watchlistTotalCurRefs.size > 0) {
    updateSummaryRefs(
      lastWatchlistKeys,
      curValues,
      linked,
      watchlistTotalCurRefs,
      watchlistTotalTgtRefs,
      watchlistTotalDevRefs,
      maskConfig,
    );
  }
  updateSummaryRefs(
    keys,
    curValues,
    linked,
    totalCurRefs,
    totalTgtRefs,
    totalDevRefs,
    maskConfig,
  );
}
