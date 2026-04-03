import type { FocusedLevel } from "./focusStrike";
import { CHART_FONTS } from "frontend/charts/ChartTheme";

export function createVerticalFocusStrikePlugin(
  getFocusedLevels: () => FocusedLevel[],
  getLabels: () => string[],
): any {
  return {
    id: "focusStrikeVertical",
    afterDraw: (chart: any) => {
      const levels = getFocusedLevels();
      const labels = getLabels();
      if (levels.length === 0 || labels.length === 0) return;

      const { ctx, chartArea, scales } = chart;
      if (!ctx || !chartArea || !scales?.x) return;

      const items: { lvl: FocusedLevel; xPixel: number }[] = [];
      for (const lvl of levels) {
        let bestIdx = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < labels.length; i++) {
          const diff = Math.abs(Number(labels[i]) - lvl.strike);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }
        const xPixel = scales.x.getPixelForValue(labels[bestIdx]);
        if (
          !isFinite(xPixel) ||
          xPixel < chartArea.left ||
          xPixel > chartArea.right
        )
          continue;
        items.push({ lvl, xPixel });
      }
      items.sort((a, b) => a.xPixel - b.xPixel);

      ctx.save();
      ctx.font = CHART_FONTS.label;
      const yOffsets: number[] = [];
      for (let i = 0; i < items.length; i++) {
        let tier = 0;
        const halfWidthI = ctx.measureText(items[i].lvl.label).width / 2 + 2;
        for (let attempt = 0; attempt < 4; attempt++) {
          let collision = false;
          for (let j = 0; j < i; j++) {
            if (yOffsets[j] !== tier) continue;
            const halfWidthJ =
              ctx.measureText(items[j].lvl.label).width / 2 + 2;
            if (
              Math.abs(items[i].xPixel - items[j].xPixel) <
              halfWidthI + halfWidthJ
            ) {
              collision = true;
              break;
            }
          }
          if (!collision) break;
          tier++;
        }
        yOffsets.push(tier);
      }
      ctx.restore();

      for (let i = 0; i < items.length; i++) {
        const { lvl, xPixel } = items[i];
        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = lvl.color;
        ctx.beginPath();
        ctx.moveTo(xPixel, chartArea.top);
        ctx.lineTo(xPixel, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = lvl.color;
        ctx.font = CHART_FONTS.label;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(lvl.label, xPixel, chartArea.top - 2 - yOffsets[i] * 12);
        ctx.restore();
      }
    },
  };
}
