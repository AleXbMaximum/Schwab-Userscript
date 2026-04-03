import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { TimeAxisMapping, ResolvedTimeRangeWindow } from "../timelineTypes";
import { findNearestPointIndexByTs } from "../data/dataUtils";
import { SNAPSHOT_CHART_PAD } from "../chart/chartTypes";

export type HoverState = {
  hoveredTs: number | null;
  hoverRafId: number | null;
};

export function handleCanvasMove(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  hoverState: HoverState,
  latestPlotPoints: AccountHistoryPoint[],
  latestAxisMapping: TimeAxisMapping | null,
  latestTimeWindow: ResolvedTimeRangeWindow | null,
  renderHoverOnly: () => void,
): void {
  if (latestPlotPoints.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const pad = SNAPSHOT_CHART_PAD;
  const chartW = Math.max(1, rect.width - pad.left - pad.right);
  const chartH = Math.max(1, rect.height - pad.top - pad.bottom);
  const inChart =
    mx >= pad.left &&
    mx <= pad.left + chartW &&
    my >= pad.top &&
    my <= pad.top + chartH;

  if (!inChart) {
    if (hoverState.hoveredTs != null) {
      hoverState.hoveredTs = null;
      scheduleHoverRender(hoverState, renderHoverOnly);
    }
    return;
  }

  let targetTs: number;
  if (latestAxisMapping) {
    targetTs = latestAxisMapping.fromX(mx);
  } else if (latestTimeWindow) {
    targetTs =
      latestTimeWindow.startTs +
      ((mx - pad.left) / chartW) * latestTimeWindow.durationMs;
  } else {
    return;
  }
  const idx = findNearestPointIndexByTs(latestPlotPoints, targetTs);
  const nextTs = idx == null ? null : latestPlotPoints[idx].ts;
  if (nextTs !== hoverState.hoveredTs) {
    hoverState.hoveredTs = nextTs;
    scheduleHoverRender(hoverState, renderHoverOnly);
  }
}

export function handleCanvasLeave(
  hoverState: HoverState,
  renderHoverOnly: () => void,
): void {
  if (hoverState.hoveredTs != null) {
    hoverState.hoveredTs = null;
    scheduleHoverRender(hoverState, renderHoverOnly);
  }
}

function scheduleHoverRender(
  hoverState: HoverState,
  renderHoverOnly: () => void,
): void {
  if (hoverState.hoverRafId != null) cancelAnimationFrame(hoverState.hoverRafId);
  hoverState.hoverRafId = requestAnimationFrame(() => {
    hoverState.hoverRafId = null;
    renderHoverOnly();
  });
}
