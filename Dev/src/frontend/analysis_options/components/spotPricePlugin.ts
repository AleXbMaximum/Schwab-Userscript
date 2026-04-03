import { OPTIONS_SEMANTIC_COLORS as C, CHART_FONTS } from "frontend/charts/ChartTheme";

export function createSpotPlugin(
  getPrice: () => number | null,
  getLabels: () => string[],
) {
  return {
    id: "spotLine",
    afterDraw: (chart: any) => {
      const price = getPrice();
      const labels = getLabels();
      if (price == null || labels.length === 0) return;
      const { ctx: c, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < labels.length; i++) {
        const diff = Math.abs(Number(labels[i]) - price);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }

      const xPixel = scales.x.getPixelForValue(labels[bestIdx]);
      if (xPixel < chartArea.left || xPixel > chartArea.right) return;

      c.save();
      c.setLineDash([6, 4]);
      c.lineWidth = 1.5;
      c.strokeStyle = C.spot;
      c.beginPath();
      c.moveTo(xPixel, chartArea.top);
      c.lineTo(xPixel, chartArea.bottom);
      c.stroke();

      c.setLineDash([]);
      c.fillStyle = C.spot;
      c.font = CHART_FONTS.label;
      c.textAlign = "center";
      c.textBaseline = "bottom";
      c.fillText("Spot", xPixel, chartArea.top - 3);
      c.restore();
    },
  };
}
