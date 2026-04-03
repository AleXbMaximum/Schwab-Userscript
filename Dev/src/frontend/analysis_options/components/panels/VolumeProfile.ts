import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, niceStrikeTicks } from "frontend/charts/ChartTheme";
import type { StrikeVolumeData } from "backend/computation/options/types";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import {
  getFocusedLevels,
  subscribeFocusedLevels,
  type FocusedLevel,
} from "../../focus/focusStrike";

export function renderVolumeProfile(
  volData: StrikeVolumeData[],
): HTMLElement & {
  cleanup?: () => void;
  update?: (data: StrikeVolumeData[]) => void;
} {
  let currentLabels: string[] = [];
  let focusedLevels: FocusedLevel[] = getFocusedLevels();
  const focusPlugin = createVerticalFocusStrikePlugin(
    () => focusedLevels,
    () => currentLabels,
  );

  const buildChartConfig = (data: StrikeVolumeData[]) => {
    const labels = data.map((d) => String(d.strike));
    currentLabels = labels;
    return {
      type: "bar" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Call Volume",
            data: data.map((d) => d.callVol),
            backgroundColor: "rgba(32, 169, 69, 0.6)",
            borderColor: "#20a945",
            borderWidth: 1,
            borderRadius: 2,
          },
          {
            label: "Put Volume",
            data: data.map((d) => d.putVol),
            backgroundColor: "rgba(215, 49, 38, 0.6)",
            borderColor: "#d73126",
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
            labels: { font: { size: 11 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${(ctx.raw as number).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 45,
              ...niceStrikeTicks(labels),
            },
          },
          y: {
            stacked: true,
            ...niceLinearScale(
              data.map((d) => d.callVol + d.putVol),
              { forceIncludeZero: true },
            ),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale(
                data.map((d) => d.callVol + d.putVol),
                { forceIncludeZero: true },
              ).ticks,
              font: { size: 10 },
              callback: (value: any) => {
                const v = Number(value);
                const abs = Math.abs(v);
                const sign = v < 0 ? "-" : "";
                if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
                if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + "K";
                return String(v);
              },
            },
          },
        },
      },
      plugins: [focusPlugin],
    };
  };

  const chartPanel = createChartPanel<StrikeVolumeData[]>(
    {
      title: "Volume Profile",
      description: "Call and put trading volume by strike.",
      buildChartConfig,
      destroyOnUpdate: true,
    },
    volData,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(volData);
  });

  // Keep track of current data for focus redraws
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (data: StrikeVolumeData[]) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (data: StrikeVolumeData[]) => {
    volData = data;
    if (origUpdate) origUpdate(data);
  };

  const origCleanup = chartPanel.cleanup;
  result.cleanup = () => {
    unsubscribeFocus();
    if (origCleanup) origCleanup();
  };

  return result;
}
