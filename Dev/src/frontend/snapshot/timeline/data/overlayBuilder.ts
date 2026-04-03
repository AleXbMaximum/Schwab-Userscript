import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { IndexOverlayLine } from "../timelineTypes";
import { INDEX_OVERLAY_OPTIONS } from "../timelineConstants";
import type { IntradaySparklineStore } from "../../../trade_holdings/holding_table/sparkline/IntradaySparklineStore";

const BETA_NORMALIZATION_EPSILON = 1e-6;

export function buildOverlayLines(
  store: IntradaySparklineStore,
  selectedSymbols: string[],
  betaOffset: boolean,
  resolveBeta: (symbol: string) => number | null,
): IndexOverlayLine[] {
  const lines: IndexOverlayLine[] = [];
  for (const sym of selectedSymbols) {
    const opt = INDEX_OVERLAY_OPTIONS.find((o) => o.symbol === sym);
    if (!opt) continue;
    const data = store.get(sym);
    if (!data || data.prices.length < 2) continue;

    const refPrice =
      data.previousClose && data.previousClose > 0
        ? data.previousClose
        : data.prices[0];
    const overlayBeta = betaOffset ? resolveBeta(sym) : null;
    const dayChangePct = data.prices.map((p) =>
      normalizeReturnByBeta(p / refPrice - 1, overlayBeta),
    );

    lines.push({
      symbol: opt.symbol,
      timestamps: data.timestamps,
      dayChangePct,
      color: opt.color,
    });
  }
  return lines;
}

export function normalizeReturnByBeta(
  value: number,
  beta: number | null | undefined,
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(beta) ||
    Math.abs(beta) <= BETA_NORMALIZATION_EPSILON
  ) {
    return value;
  }
  return value / beta;
}

export function normalizeAccountDayChangePercentPoints(
  points: AccountHistoryPoint[],
  betaOffset: boolean,
): AccountHistoryPoint[] {
  if (!betaOffset || points.length === 0) return points;

  let changed = false;
  const normalized = points.map((point) => {
    const nextPct = normalizeReturnByBeta(point.dayChangePercent, point.beta);
    if (nextPct === point.dayChangePercent) return point;
    changed = true;
    return { ...point, dayChangePercent: nextPct };
  });
  return changed ? normalized : points;
}

export function getOverlayLabel(symbol: string): string {
  return INDEX_OVERLAY_OPTIONS.find((o) => o.symbol === symbol)?.label ?? symbol;
}

export function summarizeOverlaySelection(selected: string[]): {
  text: string;
  title: string;
} {
  const labels = selected.map(getOverlayLabel);
  if (labels.length === 0) {
    return { text: "Index", title: "Select overlay symbols" };
  }
  if (labels.length === 1) {
    return { text: labels[0], title: labels[0] };
  }
  return {
    text: `${labels[0]} +${labels.length - 1}`,
    title: labels.join(", "),
  };
}
