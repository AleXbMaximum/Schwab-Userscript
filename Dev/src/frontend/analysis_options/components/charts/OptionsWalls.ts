import { ui_createElement } from "../../../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/styles/theme";
import {
  OPTIONS_SEMANTIC_COLORS as C,
  CHART_COLORS,
  CHART_FONTS,
} from "frontend/charts/ChartTheme";
import { setupCanvas } from "frontend/charts/ChartUtils";
import { niceScale } from "../../../../shared/utils/math/scale";
import type { OptionsWallData } from "backend/computation/options/types";
import { createRenderFrame } from "../renderFrameController";
import {
  toggleFocusedLevel,
  subscribeFocusedLevels,
  type FocusedLevel,
} from "../../focus/focusStrike";
import { formatStrike } from "shared/utils/format/formatters";

export function renderOptionsWalls(
  wallData: OptionsWallData,
): HTMLElement & {
  cleanup?: () => void;
  update?: (data: OptionsWallData) => void;
  resize?: () => void;
} {
  const panel = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; height: 100%; overflow: hidden;",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (data: OptionsWallData) => void;
    resize?: () => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Key Levels",
      styleString: DS_TYPOGRAPHY.panelTitle + " flex-shrink: 0;",
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "Call and put open interest by strike. Dashed lines mark focused levels.",
      styleString: DS_TYPOGRAPHY.panelDesc + " flex-shrink: 0;",
    }),
  );

  const canvasContainer = ui_createElement("div", {
    styleString: "width: 100%; margin-top: 8px; flex: 1 1 0; min-height: 0; overflow: hidden;",
  });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display: block;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Options walls chart");
  canvasContainer.appendChild(canvas);
  panel.appendChild(canvasContainer);

  let currentData = wallData;
  let activeLevels: FocusedLevel[] = [];

  const renderChart = () => {
    const { oiByStrike } = currentData;

    if (oiByStrike.length === 0) {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";

    const parent = canvas.parentElement;
    const w = parent ? Math.max(parent.clientWidth - 4, 240) : 600;
    const h = canvasContainer.clientHeight || 250;
    const ctx = setupCanvas(canvas, w, h);
    if (!ctx) return;

    const pad = { top: 15, right: 20, bottom: 35, left: 50 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    let rawMaxOI = 1;
    for (let i = 0; i < oiByStrike.length; i++) {
      const d = oiByStrike[i];
      if (d.callOI > rawMaxOI) rawMaxOI = d.callOI;
      if (d.putOI > rawMaxOI) rawMaxOI = d.putOI;
    }
    const niceY = niceScale({
      dataMin: 0,
      dataMax: rawMaxOI,
      maxTicks: 5,
      forceIncludeZero: true,
    });
    const maxOI = niceY.max;
    const barW = Math.max(2, chartW / oiByStrike.length - 1);
    const halfBar = barW / 2;

    const toX = (i: number) =>
      pad.left + (i / oiByStrike.length) * chartW + halfBar;
    const toYVal = (v: number) => pad.top + chartH - (v / maxOI) * chartH;
    const clampX = (x: number) =>
      Math.max(pad.left, Math.min(pad.left + chartW, x));
    const strikeToX = (strike: number): number => {
      const n = oiByStrike.length;
      if (n <= 1) return toX(0);

      for (let i = 0; i < n; i++) {
        if (oiByStrike[i].strike === strike) return toX(i);
      }

      if (strike <= oiByStrike[0].strike) {
        const s0 = oiByStrike[0].strike;
        const s1 = oiByStrike[1].strike;
        const denom = s1 - s0;
        if (denom <= 0) return toX(0);
        const x = toX(0) + ((strike - s0) / denom) * (toX(1) - toX(0));
        return clampX(x);
      }

      if (strike >= oiByStrike[n - 1].strike) {
        const s0 = oiByStrike[n - 2].strike;
        const s1 = oiByStrike[n - 1].strike;
        const denom = s1 - s0;
        if (denom <= 0) return toX(n - 1);
        const x =
          toX(n - 2) + ((strike - s0) / denom) * (toX(n - 1) - toX(n - 2));
        return clampX(x);
      }

      for (let i = 1; i < n; i++) {
        const leftStrike = oiByStrike[i - 1].strike;
        const rightStrike = oiByStrike[i].strike;
        if (strike > rightStrike) continue;
        const denom = rightStrike - leftStrike;
        if (denom <= 0) return toX(i - 1);
        const x =
          toX(i - 1) + ((strike - leftStrike) / denom) * (toX(i) - toX(i - 1));
        return clampX(x);
      }

      return toX(n - 1);
    };

    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;
    for (const tick of niceY.ticks) {
      const y = toYVal(tick);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = CHART_COLORS.neutral;
      ctx.font = CHART_FONTS.tickSmall;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const label =
        tick >= 1e6
          ? (tick / 1e6).toFixed(1) + "M"
          : tick >= 1e3
            ? (tick / 1e3).toFixed(0) + "K"
            : String(tick);
      ctx.fillText(label, pad.left - 4, y);
    }

    for (let i = 0; i < oiByStrike.length; i++) {
      const d = oiByStrike[i];
      const x = toX(i);

      const callH = (d.callOI / maxOI) * chartH;
      ctx.fillStyle = "rgba(32, 169, 69, 0.5)";
      ctx.fillRect(x, toYVal(d.callOI), halfBar, callH);

      const putH = (d.putOI / maxOI) * chartH;
      ctx.fillStyle = "rgba(215, 49, 38, 0.5)";
      ctx.fillRect(x - halfBar, toYVal(d.putOI), halfBar, putH);
    }

    ctx.fillStyle = CHART_COLORS.neutral;
    ctx.font = CHART_FONTS.tickSmall;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (oiByStrike.length > 2) {
      const firstStrike = oiByStrike[0].strike;
      const lastStrike = oiByStrike[oiByStrike.length - 1].strike;
      const xNice = niceScale({
        dataMin: firstStrike,
        dataMax: lastStrike,
        maxTicks: 12,
        padding: 0,
      });
      const xStep = xNice.step;
      for (let i = 0; i < oiByStrike.length; i++) {
        const s = oiByStrike[i].strike;
        const rem = ((s % xStep) + xStep) % xStep;
        if (rem < xStep * 0.001 || xStep - rem < xStep * 0.001) {
          ctx.fillText(String(s), toX(i), pad.top + chartH + 4);
        }
      }
    } else {
      const step = Math.max(1, Math.ceil(oiByStrike.length / 20));
      for (let i = 0; i < oiByStrike.length; i += step) {
        ctx.fillText(
          String(oiByStrike[i].strike),
          toX(i),
          pad.top + chartH + 4,
        );
      }
    }

    const levelItems: { x: number; color: string; label: string }[] = [];
    for (const lvl of activeLevels) {
      if (lvl.strike == null) continue;
      levelItems.push({
        x: strikeToX(lvl.strike),
        color: lvl.color,
        label: lvl.label,
      });
    }
    levelItems.sort((a, b) => a.x - b.x);

    ctx.font = CHART_FONTS.labelBold;
    const labelYOffsets: number[] = [];
    for (let i = 0; i < levelItems.length; i++) {
      let tier = 0;
      const halfWidthI = ctx.measureText(levelItems[i].label).width / 2 + 2;
      for (let attempt = 0; attempt < 4; attempt++) {
        let collision = false;
        for (let j = 0; j < i; j++) {
          if (labelYOffsets[j] !== tier) continue;
          const halfWidthJ = ctx.measureText(levelItems[j].label).width / 2 + 2;
          if (
            Math.abs(levelItems[i].x - levelItems[j].x) <
            halfWidthI + halfWidthJ
          ) {
            collision = true;
            break;
          }
        }
        if (!collision) break;
        tier++;
      }
      labelYOffsets.push(tier);
    }

    for (let i = 0; i < levelItems.length; i++) {
      const { x, color, label } = levelItems[i];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = CHART_FONTS.labelBold;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x, pad.top - 2 - labelYOffsets[i] * 12);
    }

    ctx.font = CHART_FONTS.tick;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = C.callWall;
    ctx.fillText("Call OI", w - pad.right, pad.top + 2);
    ctx.fillStyle = C.putWall;
    ctx.fillText("Put OI", w - pad.right, pad.top + 14);
  };

  const onCanvasClick = (e: MouseEvent) => {
    const { oiByStrike } = currentData;
    if (oiByStrike.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    const parent = canvas.parentElement;
    const w = parent ? Math.max(parent.clientWidth - 4, 240) : 600;
    const padCalc = { left: 50, right: 20 };
    const chartW = w - padCalc.left - padCalc.right;
    const barW = Math.max(2, chartW / oiByStrike.length - 1);
    const halfBar = barW / 2;
    const toX = (i: number) =>
      padCalc.left + (i / oiByStrike.length) * chartW + halfBar;

    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < oiByStrike.length; i++) {
      const dist = Math.abs(clickX - toX(i));
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    const strike = oiByStrike[closestIdx].strike;
    toggleFocusedLevel(strike, formatStrike(strike), "rgba(30,30,40,0.9)");
  };
  canvas.addEventListener("click", onCanvasClick);

  const frame = createRenderFrame(panel, renderChart);
  frame.schedule();

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    activeLevels = levels;
    frame.schedule();
  });

  panel.update = (data: OptionsWallData) => {
    currentData = data;
    frame.schedule();
  };

  panel.resize = () => {
    frame.schedule();
  };

  panel.cleanup = () => {
    canvas.removeEventListener("click", onCanvasClick);
    unsubscribeFocus();
    frame.destroy();
  };

  return panel;
}
