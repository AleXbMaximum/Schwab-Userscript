import { isDarkTheme } from "../../components/core/axTheme/controller";

export function createZeroLinePlugin(scaleId = "y") {
  return {
    id: "zeroLine",
    afterDraw: (chart: any) => {
      const yScale = chart.scales[scaleId];
      if (!yScale) return;
      const yPixel = yScale.getPixelForValue(0);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = isDarkTheme() ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, yPixel);
      ctx.lineTo(chart.chartArea.right, yPixel);
      ctx.stroke();
      ctx.restore();
    },
  };
}
