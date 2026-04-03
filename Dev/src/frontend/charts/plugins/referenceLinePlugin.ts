export function createReferenceLinePlugin(
  value: number,
  scaleId = "y",
  style?: { color?: string; dash?: number[]; lineWidth?: number },
) {
  const color = style?.color ?? "rgba(0,0,0,0.3)";
  const dash = style?.dash ?? [4, 3];
  const lineWidth = style?.lineWidth ?? 1;

  return {
    id: `refLine_${scaleId}_${value}`,
    afterDraw: (chart: any) => {
      const scale = chart.scales[scaleId];
      if (!scale) return;
      const yPixel = scale.getPixelForValue(value);
      if (yPixel < chart.chartArea.top || yPixel > chart.chartArea.bottom)
        return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, yPixel);
      ctx.lineTo(chart.chartArea.right, yPixel);
      ctx.stroke();
      ctx.restore();
    },
  };
}
