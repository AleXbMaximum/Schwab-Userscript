import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, CHART_FONTS } from "frontend/charts/ChartTheme";
import { DS_COLORS } from "frontend/components/core/styles/theme";
import type { TermStructurePoint, EventFlag } from "backend/computation/options/types";

// Event badge colors matching StateVector.ts
const EVENT_COLORS: Record<string, string> = {
  earnings: "#D78100",
  cpi: DS_COLORS.raw.purple,
  fomc: "#007AFF",
  custom: "#8E8E93",
};

export function renderTermStructure(
  termData: TermStructurePoint[],
  eventFlags?: EventFlag[],
): HTMLElement & {
  cleanup?: () => void;
  update?: (data: TermStructurePoint[], events?: EventFlag[]) => void;
} {
  let currentEvents = eventFlags ?? [];

  // ── √T reference curve plugin ───────────────────────────────────────────

  const sqrtTPlugin = {
    id: "sqrtTRef",
    afterDatasetsDraw: (chart: any) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x || !scales.y) return;
      const meta = chart.getDatasetMeta(0); // Avg IV dataset
      if (!meta || meta.data.length < 2) return;

      const avgData = chart.data.datasets[0].data as (number | null)[];
      const labels = chart.data.labels as string[];
      const dtes = labels.map((l: string) => parseInt(l));

      // Find first valid point as anchor
      let refIdx = -1;
      for (let i = 0; i < avgData.length; i++) {
        if (avgData[i] != null && dtes[i] > 0) {
          refIdx = i;
          break;
        }
      }
      if (refIdx < 0) return;
      const refIV = avgData[refIdx]!;
      const refDTE = dtes[refIdx];

      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();

      let started = false;
      for (let i = 0; i < meta.data.length; i++) {
        const dte = dtes[i];
        if (dte <= 0) continue;
        const theorIV = refIV * Math.sqrt(dte / refDTE);
        const yPx = scales.y.getPixelForValue(theorIV);
        if (yPx < chartArea.top || yPx > chartArea.bottom) continue;
        const xPx = meta.data[i].x;
        if (!started) {
          ctx.moveTo(xPx, yPx);
          started = true;
        } else ctx.lineTo(xPx, yPx);
      }
      ctx.stroke();

      // Label at the end
      const lastValid = meta.data.length - 1;
      if (lastValid > 0 && dtes[lastValid] > 0) {
        const theorLast = refIV * Math.sqrt(dtes[lastValid] / refDTE);
        const lY = scales.y.getPixelForValue(theorLast);
        if (lY >= chartArea.top && lY <= chartArea.bottom) {
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          ctx.font = CHART_FONTS.labelSmall;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText("\u221AT ref", meta.data[lastValid].x + 6, lY);
        }
      }
      ctx.restore();
    },
  };

  // ── Event marker plugin ─────────────────────────────────────────────────

  const eventPlugin = {
    id: "eventMarkers",
    afterDatasetsDraw: (chart: any) => {
      if (currentEvents.length === 0) return;
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x || !scales.y) return;

      const labels = chart.data.labels as string[];
      const dtes = labels.map((l: string) => parseInt(l));

      ctx.save();
      for (const evt of currentEvents) {
        if (evt.daysUntil == null || evt.daysUntil <= 0) continue;

        // Find the closest label index
        let bestIdx = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < dtes.length; i++) {
          const diff = Math.abs(dtes[i] - evt.daysUntil);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
          }
        }
        if (bestDiff > 10) continue; // skip if too far from any data point

        const xPx = scales.x.getPixelForValue(bestIdx);
        if (xPx < chartArea.left || xPx > chartArea.right) continue;

        const color = EVENT_COLORS[evt.type] ?? EVENT_COLORS.custom;

        // Vertical dashed line
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(xPx, chartArea.top);
        ctx.lineTo(xPx, chartArea.bottom);
        ctx.stroke();

        // Badge label above chart
        ctx.setLineDash([]);
        ctx.font = CHART_FONTS.dense;
        const tw = ctx.measureText(evt.label).width;
        const bW = tw + 8;
        const bH = 14;
        const bX = xPx - bW / 2;
        const bY = chartArea.top - bH - 2;

        ctx.fillStyle = color + "20";
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(evt.label, xPx, bY + bH / 2);
      }
      ctx.restore();
    },
  };

  // ── Chart config ────────────────────────────────────────────────────────

  const buildChartConfig = (data: TermStructurePoint[]) => {
    const filtered = data.filter((d) => d.avgIV != null && d.daysUntil <= 365);
    const labels = filtered.map((d) => `${d.daysUntil}d`);

    return {
      type: "line" as const,
      data: {
        labels,
        datasets: [
          // Avg IV — main visible line with green fill
          {
            label: "Avg IV",
            data: filtered.map((d) => d.avgIV),
            borderColor: "#20a945",
            backgroundColor: "rgba(32, 169, 69, 0.08)",
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: true,
            spanGaps: true,
            order: 0,
          },
          // Call IV — upper band edge, fills down to Put IV
          {
            label: "Call IV",
            data: filtered.map((d) => d.atmCallIV),
            borderColor: "rgba(32, 169, 69, 0.35)",
            backgroundColor: "rgba(32, 169, 69, 0.08)",
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.3,
            fill: "+1", // fill to next dataset (Put IV)
            spanGaps: true,
            order: 1,
          },
          // Put IV — lower band edge
          {
            label: "Put IV",
            data: filtered.map((d) => d.atmPutIV),
            borderColor: "rgba(215, 49, 38, 0.35)",
            backgroundColor: "transparent",
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.3,
            fill: false,
            spanGaps: true,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
            labels: { font: { size: 11 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: {
              title: (items: any[]) => {
                const idx = items[0]?.dataIndex;
                if (idx == null) return "";
                return filtered[idx]?.label ?? "";
              },
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${ctx.raw != null ? (ctx.raw as number).toFixed(2) + "%" : "--"}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } },
            title: {
              display: true,
              text: "Days to Expiration",
              font: { size: 10 },
            },
          },
          y: {
            ...niceLinearScale(
              filtered.flatMap((d) => [d.atmCallIV, d.atmPutIV, d.avgIV]),
            ),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale(
                filtered.flatMap((d) => [d.atmCallIV, d.atmPutIV, d.avgIV]),
              ).ticks,
              font: { size: 10 },
              callback: (value: any) => value + "%",
            },
            title: { display: true, text: "IV (%)", font: { size: 10 } },
          },
        },
      },
      plugins: [sqrtTPlugin, eventPlugin],
    };
  };

  const chartPanel = createChartPanel<TermStructurePoint[]>(
    {
      title: "IV Term Structure",
      description:
        "ATM implied volatility across expirations. Band shows Call\u2013Put spread. Dashed curve is theoretical \u221AT.",
      buildChartConfig,
      destroyOnUpdate: true,
    },
    termData,
  );

  // Wrap to match the two-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (data: TermStructurePoint[], events?: EventFlag[]) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (data: TermStructurePoint[], events?: EventFlag[]) => {
    if (events) currentEvents = events;
    if (origUpdate) origUpdate(data);
  };

  return result;
}
