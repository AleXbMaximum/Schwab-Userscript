import { ui_createElement } from "../../../components/core/createElement";
import { DS_COLORS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import {
  extractModeCurrentValues,
  REBALANCE_MODES,
} from "../../../../backend/computation/rebalance/RebalanceCalculator";
import type{ RebalanceAnchorMode, RebalanceModeId } from "../../../../shared/types/core";
import { formatCompactDollar } from "shared/utils/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";
import type { BetaHorizon } from "../../../../backend/computation/beta/types";
import {
  type Payload,
  TARGET_MODES,
  MODE_WEIGHT,
  MAX_SUGGESTION_ROWS,
  MIN_SCORE,
  PRIVACY_HIDDEN_METRICS,
  PRIVACY_HIDDEN_GREEKS,
  MAGNIFIED_MODES,
  emptyStateStyle,
  resolveAllLinkedTargets,
  resolveQuoteLastPrice,
} from "./rebalanceTypes";

// ── Types ──

type SuggestionAction = "BUY" | "SELL" | "ADJUST";

type SuggestionModeSignal = {
  mode: RebalanceModeId;
  current: number;
  target: number;
  gap: number;
  weightedGap: number;
};

type RebalanceTradeSuggestion = {
  underlyingKey: string;
  action: SuggestionAction;
  score: number;
  estShares?: number;
  estValueDol?: number;
  isOptionsOnly: boolean;
  signals: SuggestionModeSignal[];
};

export type RebalanceTradeSuggestionResult = {
  suggestions: RebalanceTradeSuggestion[];
  activeModes: RebalanceAnchorMode[];
  usingLegacyDeltaTargets: boolean;
};

// ── Logic ──

function getActiveSuggestionModes(payload: Payload): RebalanceAnchorMode[] {
  const targets = payload.rebalanceTargets;
  if (!targets || Object.keys(targets).length === 0) return [];
  return [...TARGET_MODES];
}

export function buildTradeSuggestions(
  payload: Payload,
  horizon: BetaHorizon = "short",
): RebalanceTradeSuggestionResult {
  const activeModes = getActiveSuggestionModes(payload);
  const usingLegacyDeltaTargets = false;

  if (activeModes.length === 0) {
    return { suggestions: [], activeModes, usingLegacyDeltaTargets };
  }

  const byUnderlying = payload.derived.byUnderlying ?? {};
  const linked = resolveAllLinkedTargets(
    payload.rebalanceTargets,
    payload,
    horizon,
  );

  const currentByMode = new Map<RebalanceAnchorMode, Map<string, number>>();
  const modeScales = new Map<RebalanceAnchorMode, number>();

  TARGET_MODES.forEach((mode) => {
    const currentMap = extractModeCurrentValues(
      mode,
      payload.derived,
      payload.betaData,
      horizon,
    );
    currentByMode.set(mode, currentMap);

    let absCurrent = 0;
    currentMap.forEach((v) => {
      absCurrent += Math.abs(v);
    });
    let absTarget = 0;
    linked.forEach((lt) => {
      absTarget += Math.abs(lt[mode]);
    });
    modeScales.set(
      mode,
      REBALANCE_MODES[mode].isPct ? 100 : Math.max(absCurrent, absTarget, 1),
    );
  });

  const suggestions: RebalanceTradeSuggestion[] = [];

  const allKeys = new Set<string>(Object.keys(byUnderlying));
  linked.forEach((_, key) => allKeys.add(key));

  allKeys.forEach((key) => {
    const lt = linked.get(key);
    if (!lt) return;

    const signals: SuggestionModeSignal[] = [];
    let exposureBias = 0;

    TARGET_MODES.forEach((mode) => {
      const current = currentByMode.get(mode)?.get(key) ?? 0;
      const target = lt[mode];
      const gap = target - current;
      const scale = modeScales.get(mode) ?? 1;
      const weightedGap =
        (gap / Math.max(scale, 1)) * (MODE_WEIGHT[mode] ?? 0.5);
      const minGap = REBALANCE_MODES[mode].isPct
        ? 0.25
        : Math.max(0.001, scale * 0.003);
      if (Math.abs(gap) < minGap) return;

      signals.push({ mode, current, target, gap, weightedGap });
      exposureBias += weightedGap;
    });

    if (signals.length === 0) return;

    const score = exposureBias;
    if (Math.abs(score) < MIN_SCORE) return;
    signals.sort((a, b) => Math.abs(b.weightedGap) - Math.abs(a.weightedGap));

    let action: SuggestionAction = "ADJUST";
    if (Math.abs(exposureBias) >= 0.01)
      action = exposureBias > 0 ? "BUY" : "SELL";
    else if (Math.abs(score) >= 0.03) action = score > 0 ? "BUY" : "SELL";

    const row = byUnderlying[key];
    const price = resolveQuoteLastPrice(key, payload) ?? 0;

    let estShares: number | undefined;
    let estValueDol: number | undefined;

    const sharesGap = lt.shares - (currentByMode.get("shares")?.get(key) ?? 0);
    if (price > 0 && Math.abs(sharesGap) >= 0.5) {
      estShares = sharesGap;
      estValueDol = sharesGap * price;
    }

    const totalDelta = row?.totalDeltaShares ?? 0;
    const optDelta = row?.totalOptDeltaShares ?? 0;
    const equityDelta = Math.abs(totalDelta - optDelta);
    const isOptionsOnly = equityDelta < 0.5;

    suggestions.push({
      underlyingKey: key,
      action,
      score,
      estShares,
      estValueDol,
      isOptionsOnly,
      signals,
    });
  });

  suggestions.sort((a, b) => {
    const byScore = Math.abs(b.score) - Math.abs(a.score);
    if (Math.abs(byScore) > 1e-9) return byScore;
    return Math.abs(b.estValueDol ?? 0) - Math.abs(a.estValueDol ?? 0);
  });

  return {
    suggestions: suggestions.slice(0, MAX_SUGGESTION_ROWS),
    activeModes,
    usingLegacyDeltaTargets,
  };
}

// ── Rendering ──

const fmtDol = (v: number): string =>
  isShareMasked() ? SHARE_MASKED_TEXT : formatCompactDollar(shareScaleValue(v) as number);

function formatSignal(
  signal: SuggestionModeSignal,
  displayMultiplier: number,
): string {
  const cfg = REBALANCE_MODES[signal.mode];
  const mul = MAGNIFIED_MODES.has(signal.mode) ? displayMultiplier : 1;
  return `${cfg.shortLabel}: ${cfg.formatValue(signal.current * mul)}→${cfg.formatValue(signal.target * mul)}`;
}

export function renderTradeSuggestions(
  result: RebalanceTradeSuggestionResult,
  privacyHidden = false,
  displayMultiplier = 1,
): HTMLElement {
  const container = ui_createElement("div", {
    styleString: "display:flex; flex-direction:column; gap:6px;",
  });

  if (result.activeModes.length === 0) {
    container.appendChild(
      ui_createElement("div", {
        text: "Set targets in the Rebalance table to generate trade suggestions.",
        styleString: emptyStateStyle,
      }),
    );
    return container;
  }

  if (result.suggestions.length === 0) {
    container.appendChild(
      ui_createElement("div", {
        text: "Current exposures are close to configured rebalance targets.",
        styleString: emptyStateStyle,
      }),
    );
    return container;
  }

  result.suggestions.forEach((suggestion) => {
    const isBuy = suggestion.action === "BUY";
    const isSell = suggestion.action === "SELL";
    const accent = isBuy
      ? DS_COLORS.positive
      : isSell
        ? DS_COLORS.negative
        : DS_COLORS.neutral;
    const bgColor = isBuy
      ? DS_COLORS.bgPositive
      : isSell
        ? DS_COLORS.bgNegative
        : DS_COLORS.bgNeutral;
    const row = ui_createElement("div", {
      styleString: `display:flex; flex-direction:column; gap:3px; padding:7px 10px; border-radius:8px; border:1px solid ${accent}; background:${bgColor};`,
    });

    const top = ui_createElement("div", {
      styleString: "display:flex; align-items:center; gap:8px;",
    });
    top.appendChild(
      ui_createElement("span", {
        text: suggestion.action,
        styleString:
          `font-size:10px; font-weight:700; color:${accent}; border:1px solid ${accent};` +
          " background:rgba(255,255,255,0.72); padding:2px 6px; border-radius:999px; min-width:52px; text-align:center;",
      }),
    );
    top.appendChild(
      ui_createElement("span", {
        text: suggestion.underlyingKey,
        styleString:
          "font-size:13px; font-weight:700; color:var(--ios-text-primary); min-width:52px;",
      }),
    );

    let sizeText = "Multi-mode adjustment";
    if (
      typeof suggestion.estShares === "number" &&
      Number.isFinite(suggestion.estShares)
    ) {
      const absShares = Math.max(
        1,
        Math.round(Math.abs(suggestion.estShares) * displayMultiplier),
      );
      if (
        !privacyHidden &&
        typeof suggestion.estValueDol === "number" &&
        Number.isFinite(suggestion.estValueDol)
      ) {
        sizeText = `~${absShares} sh (${fmtDol(Math.abs(suggestion.estValueDol) * displayMultiplier)})`;
      } else {
        sizeText = `~${absShares} sh`;
      }
    } else if (
      !privacyHidden &&
      typeof suggestion.estValueDol === "number" &&
      Number.isFinite(suggestion.estValueDol)
    ) {
      sizeText = `~${fmtDol(Math.abs(suggestion.estValueDol) * displayMultiplier)}`;
    }

    top.appendChild(
      ui_createElement("span", {
        text: sizeText,
        styleString: "font-size:12px; color:var(--ios-text-secondary); flex:1;",
      }),
    );
    if (suggestion.isOptionsOnly) {
      top.appendChild(
        ui_createElement("span", {
          text: "opts",
          styleString:
            "font-size:10px; font-weight:600; color:var(--ios-orange); background:rgba(215,129,0,0.1); padding:1px 4px; border-radius:3px;",
        }),
      );
    }
    row.appendChild(top);

    const filteredSignals = privacyHidden
      ? suggestion.signals.filter(
          (s) =>
            !PRIVACY_HIDDEN_METRICS.has(s.mode as RebalanceAnchorMode) &&
            !PRIVACY_HIDDEN_GREEKS.has(s.mode),
        )
      : suggestion.signals;
    const signalText = filteredSignals
      .slice(0, 3)
      .map((s) => formatSignal(s, displayMultiplier))
      .join(" | ");
    row.appendChild(
      ui_createElement("div", {
        text: signalText,
        styleString:
          "font-size:11px; color:var(--ios-text-secondary); line-height:1.3;",
      }),
    );

    container.appendChild(row);
  });

  const summaryRow = ui_createElement("div", {
    styleString:
      "display:flex; flex-wrap:wrap; gap:10px; padding:6px 8px; margin-top:3px; border-radius:6px; background:rgba(0,0,0,0.025);",
  });
  const addItem = (label: string, value: string) => {
    const item = ui_createElement("div", {
      styleString: "display:flex; flex-direction:column; gap:1px;",
    });
    item.appendChild(
      ui_createElement("span", {
        text: label,
        styleString: DS_TYPOGRAPHY.metricLabel,
      }),
    );
    item.appendChild(
      ui_createElement("span", {
        text: value,
        styleString: DS_TYPOGRAPHY.metricValue,
      }),
    );
    summaryRow.appendChild(item);
  };

  const totalTradeValue = result.suggestions.reduce(
    (sum, s) => sum + Math.abs(s.estValueDol ?? 0),
    0,
  );
  addItem("TRADES", String(result.suggestions.length));
  addItem(
    "MODES",
    result.activeModes.map((m) => REBALANCE_MODES[m].shortLabel).join(", "),
  );
  if (!privacyHidden)
    addItem("EST VALUE", fmtDol(totalTradeValue * displayMultiplier));
  if (result.usingLegacyDeltaTargets)
    addItem("SOURCE", "Legacy Delta % targets");

  container.appendChild(summaryRow);
  return container;
}
