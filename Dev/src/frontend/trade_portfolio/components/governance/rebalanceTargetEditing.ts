import type { BetaHorizon } from "../../../../backend/computation/beta/types";
import {
  computeLinkedTargets,
  extractModeCurrentValues,
  REBALANCE_MODES,
} from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type { LinkedTargetValues } from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type {
  RebalanceAnchorMode,
  RebalanceModeId,
  RebalanceTargetEntry,
  RebalanceTargets,
} from "../../../../shared/types/core";
import { DS_COLORS } from "../../../components/core/styles/theme";
import {
  type Payload,
  TARGET_MODES,
  DEVIATION_MODES,
  cellInputStyle,
  deviationColor,
  formatTargetInputValue,
  resolveQuoteLastPrice,
} from "./rebalanceTypes";
import { devSpanStyle } from "./rebalanceTableHelpers";

export type TargetEditingState = {
  inputsByKey: Map<string, Map<RebalanceAnchorMode, HTMLInputElement>>;
  anchorByKey: Map<string, RebalanceAnchorMode>;
  dirtyKeys: Set<string>;
  devRefs: Map<string, HTMLElement>;

  profileSelect: HTMLSelectElement;

  getLatestPayload: () => Payload;
  getBetaHorizon: () => BetaHorizon;
  getSelectedProfileId: () => string;
  setSelectedProfileId: (s: string) => void;
  setSelfTriggeredUpdate: (b: boolean) => void;
  setLastTargetsHash: (s: string) => void;

  getDisplayMultiplier: (m: RebalanceModeId) => number;
};

export type TargetEditingApi = {
  parseAnchorInputValue: (
    mode: RebalanceAnchorMode,
    rawValue: string,
  ) => number | null;
  getAllKeys: (p: Payload) => string[];
  saveUnderlyingTarget: (key: string) => void;
  handleTargetInput: (key: string, editedMode: RebalanceAnchorMode) => void;
  updateAnchorVisuals: (key: string) => void;
  updateDeviationCells: (
    key: string,
    linked: LinkedTargetValues | null,
  ) => void;
};

export function createTargetEditing(state: TargetEditingState): TargetEditingApi {
  const {
    inputsByKey,
    anchorByKey,
    dirtyKeys,
    devRefs,
    profileSelect,
    getDisplayMultiplier,
  } = state;

  function parseAnchorInputValue(
    mode: RebalanceAnchorMode,
    rawValue: string,
  ): number | null {
    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) return null;
    const config = REBALANCE_MODES[mode];
    if (config.isPct && (value < 0 || value > 100)) return null;
    const mul = getDisplayMultiplier(mode);
    const real = mul !== 1 ? value / mul : value;
    return Math.round(real * 100) / 100;
  }

  function getAllKeys(p: Payload): string[] {
    const keys = new Set<string>(Object.keys(p.derived.byUnderlying ?? {}));
    if (p.rebalanceTargets) {
      for (const k of Object.keys(p.rebalanceTargets)) keys.add(k);
    }
    if (p.extraBetaTickers) {
      for (const k of p.extraBetaTickers) keys.add(k);
    }
    return [...keys].sort();
  }

  function saveUnderlyingTarget(key: string): void {
    const anchor = anchorByKey.get(key);
    const inputs = inputsByKey.get(key);
    if (!anchor || !inputs) return;

    const anchorInput = inputs.get(anchor);
    if (!anchorInput) return;
    const v = parseAnchorInputValue(anchor, anchorInput.value);

    state.setSelfTriggeredUpdate(true);
    const latestPayload = state.getLatestPayload();
    const merged: RebalanceTargets = {
      ...(latestPayload.rebalanceTargets ?? {}),
    };
    if (v != null) {
      merged[key] = { anchor, value: v };
    } else {
      delete merged[key];
      anchorByKey.delete(key);
    }
    state.setLastTargetsHash(JSON.stringify(merged));
    latestPayload.onUpdateRebalanceTargets?.(merged);
    dirtyKeys.delete(key);
  }

  function handleTargetInput(
    key: string,
    editedMode: RebalanceAnchorMode,
  ): void {
    const inputs = inputsByKey.get(key);
    if (!inputs) return;
    const editedInput = inputs.get(editedMode);
    if (!editedInput) return;
    const v = parseAnchorInputValue(editedMode, editedInput.value);

    if (state.getSelectedProfileId()) {
      state.setSelectedProfileId("");
      profileSelect.value = "";
    }

    if (v == null) {
      TARGET_MODES.forEach((m) => {
        if (m !== editedMode) {
          const inp = inputs.get(m);
          if (inp) inp.value = "";
        }
      });
      anchorByKey.delete(key);
      updateAnchorVisuals(key);
      updateDeviationCells(key, null);
      dirtyKeys.add(key);
      return;
    }

    anchorByKey.set(key, editedMode);
    dirtyKeys.add(key);

    const entry: RebalanceTargetEntry = { anchor: editedMode, value: v };
    const latestPayload = state.getLatestPayload();
    const betaHorizon = state.getBetaHorizon();
    const price = resolveQuoteLastPrice(key, latestPayload) ?? 0;
    const betaRaw = latestPayload.betaData?.get(key)?.[betaHorizon]?.beta;
    const beta =
      typeof betaRaw === "number" && Number.isFinite(betaRaw) ? betaRaw : 1;
    const acctVal = latestPayload.derived.portfolioAgg?.netMarketValue ?? 1;

    const linked = computeLinkedTargets(entry, price, beta, acctVal);

    TARGET_MODES.forEach((m) => {
      if (m === editedMode) return;
      const inp = inputs.get(m);
      if (inp) {
        const config = REBALANCE_MODES[m];
        const mul = getDisplayMultiplier(m);
        inp.value = formatTargetInputValue(linked[m] * mul, config.isPct);
      }
    });

    updateAnchorVisuals(key);
    updateDeviationCells(key, linked);
  }

  function updateAnchorVisuals(key: string): void {
    const anchor = anchorByKey.get(key);
    const inputs = inputsByKey.get(key);
    if (!inputs) return;
    TARGET_MODES.forEach((m) => {
      const inp = inputs.get(m);
      if (!inp) return;
      if (m === anchor) {
        inp.style.cssText =
          cellInputStyle +
          " border-color:var(--ios-blue); background:rgba(0,122,255,0.06);";
      } else {
        inp.style.cssText = cellInputStyle;
      }
    });
  }

  function updateDeviationCells(
    key: string,
    linked: LinkedTargetValues | null,
  ): void {
    const latestPayload = state.getLatestPayload();
    const betaHorizon = state.getBetaHorizon();
    DEVIATION_MODES.forEach((mode) => {
      const devEl = devRefs.get(`${mode}:${key}`);
      if (!devEl) return;
      if (!linked) {
        devEl.textContent = "-";
        devEl.style.cssText = devSpanStyle(DS_COLORS.textPrimary);
        return;
      }
      const curMap = extractModeCurrentValues(
        mode,
        latestPayload.derived,
        latestPayload.betaData,
        betaHorizon,
      );
      const cur = curMap.get(key) ?? 0;
      const tgt = linked[mode];
      const dev = cur - tgt;
      const mul = getDisplayMultiplier(mode);
      devEl.textContent =
        (dev >= 0 ? "+" : "") + REBALANCE_MODES[mode].formatValue(dev * mul);
      devEl.style.cssText = devSpanStyle(deviationColor(dev));
    });
  }

  return {
    parseAnchorInputValue,
    getAllKeys,
    saveUnderlyingTarget,
    handleTargetInput,
    updateAnchorVisuals,
    updateDeviationCells,
  };
}
