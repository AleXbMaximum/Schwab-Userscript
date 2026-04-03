import { ui_createElement } from "../../../components/core/createElement";
import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale } from "frontend/charts/ChartTheme";
import type { PricingPoint } from "backend/computation/options/types";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import {
  getFocusedLevels,
  subscribeFocusedLevels,
  setFocusedStrike,
} from "../../focus/focusStrike";

type PricingFilters = {
  maxSpreadPct: number;
  minActivity: number;
  qualityScore: number;
};

function pickSide(d: PricingPoint, atmStrike: number): "call" | "put" {
  return d.strike > atmStrike ? "call" : "put";
}

function spreadPct(bid: number | null, ask: number | null): number | null {
  if (bid == null || ask == null || bid <= 0 || ask <= 0) return null;
  const mid = (bid + ask) / 2;
  if (mid <= 0) return null;
  return (ask - bid) / mid; // ratio 0–1
}

function midPrice(bid: number | null, ask: number | null): number | null {
  if (bid == null || ask == null || bid <= 0 || ask <= 0) return null;
  return (bid + ask) / 2;
}

export function renderPricingAnalysis(
  pricingData: PricingPoint[],
  underlyingPrice: number | null,
  filters: PricingFilters,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: PricingPoint[], p: number | null, f: PricingFilters) => void;
} {
  let currentData = pricingData;
  let currentPrice = underlyingPrice;
  let currentFilters = filters;
  let currentLabels: string[] = [];
  let focusedLevels = getFocusedLevels();

  const focusPlugin = createVerticalFocusStrikePlugin(
    () => focusedLevels,
    () => currentLabels,
  );

  const vSpotPlugin = {
    id: "vSpotLine",
    afterDraw: (chart: any) => {
      const price = currentPrice;
      const labels = currentLabels;
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
      c.strokeStyle = "#007AFF";
      c.beginPath();
      c.moveTo(xPixel, chartArea.top);
      c.lineTo(xPixel, chartArea.bottom);
      c.stroke();
      c.setLineDash([]);

      c.fillStyle = "#007AFF";
      c.font = "600 9px -apple-system, BlinkMacSystemFont, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "top";
      c.fillText("Spot", xPixel, chartArea.top + 2);
      c.restore();
    },
  };

  const findATM = (): number => {
    const price = currentPrice;
    if (price == null || currentData.length === 0)
      return currentData[0]?.strike ?? 0;
    let best = currentData[0].strike;
    let bestDiff = Math.abs(best - price);
    for (const d of currentData) {
      const diff = Math.abs(d.strike - price);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = d.strike;
      }
    }
    return best;
  };

  // Side hint displayed above the chart as a control element
  const sideHint = ui_createElement("div", {
    text: "\u25A0 Puts (below ATM)   \u25A0 Calls (above ATM)",
    styleString:
      "font-size: 10px; color: var(--ios-text-secondary); margin-bottom: 6px;",
  });

  // Description element that updates dynamically with filter values
  const descEl = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 6px; line-height: 1.4;",
  });

  // Build controls container with description and side hint
  const controlsWrap = ui_createElement("div", {});
  controlsWrap.appendChild(descEl);
  controlsWrap.appendChild(sideHint);

  const buildChartConfig = (_data: PricingPoint[]) => {
    // Update description text on each render
    descEl.textContent = `Filters: spread% < ${(currentFilters.maxSpreadPct * 100).toFixed(1)}, min(OI+Vol) \u2265 ${currentFilters.minActivity}.`;

    const atm = findATM();
    const filtered = currentData.filter((d) => {
      const side = pickSide(d, atm);
      const bid = side === "call" ? d.callBid : d.putBid;
      const ask = side === "call" ? d.callAsk : d.putAsk;
      const theo = side === "call" ? d.callTheo : d.putTheo;
      const oi = side === "call" ? (d.callOI ?? 0) : (d.putOI ?? 0);
      const vol = side === "call" ? (d.callVol ?? 0) : (d.putVol ?? 0);

      const spread = spreadPct(bid, ask);
      const activity = oi + vol;
      if (theo == null) return false;
      if (spread == null) return false;
      if (spread > currentFilters.maxSpreadPct) return false;
      if (activity < currentFilters.minActivity) return false;
      return true;
    });

    const labels = filtered.map((d) => String(d.strike));
    currentLabels = labels;

    const sides = filtered.map((d) => pickSide(d, atm));

    const bidAskData = filtered.map((d, i) => {
      const s = sides[i];
      const bid = s === "call" ? d.callBid : d.putBid;
      const ask = s === "call" ? d.callAsk : d.putAsk;
      if (bid == null || ask == null) return [null, null];
      return [bid, ask];
    });

    const theoData = filtered.map((d, i) =>
      sides[i] === "call" ? d.callTheo : d.putTheo,
    );
    const marketData = filtered.map((d, i) => {
      const s = sides[i];
      return s === "call"
        ? (midPrice(d.callBid, d.callAsk) ?? d.callMark ?? d.callLast)
        : (midPrice(d.putBid, d.putAsk) ?? d.putMark ?? d.putLast);
    });
    const priceSeries = [...theoData, ...marketData].filter(
      (v): v is number => v != null,
    );
    const yScale = niceLinearScale(priceSeries);

    const barColors = filtered.map((_d, i) =>
      sides[i] === "call"
        ? "rgba(32, 169, 69, 0.15)"
        : "rgba(215, 49, 38, 0.15)",
    );
    const barBorders = filtered.map((_d, i) =>
      sides[i] === "call" ? "rgba(32, 169, 69, 0.4)" : "rgba(215, 49, 38, 0.4)",
    );

    return {
      type: "bar" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Bid-Ask Range",
            data: bidAskData,
            backgroundColor: barColors,
            borderColor: barBorders,
            borderWidth: 1,
            borderRadius: 2,
            borderSkipped: false,
          },
          {
            label: "Theo Value",
            data: theoData,
            type: "line" as const,
            borderColor: "#D78100",
            backgroundColor: "#D78100",
            borderWidth: 2,
            pointRadius: 1.5,
            pointHoverRadius: 4,
            tension: 0.2,
            order: -1,
          },
          {
            label: "Market (Mid)",
            data: marketData,
            type: "line" as const,
            borderColor: "#007AFF",
            backgroundColor: "#007AFF",
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.2,
            order: -2,
          },
        ],
      },
      options: {
        indexAxis: "x" as const,
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt: any, els: any[]) => {
          const idx = els?.[0]?.index;
          if (idx == null) return;
          const strike = filtered[idx]?.strike;
          if (strike == null) return;
          setFocusedStrike(strike);
        },
        plugins: {
          legend: {
            position: "top" as const,
            labels: { font: { size: 10 }, boxWidth: 12, padding: 6 },
          },
          tooltip: {
            callbacks: {
              title: (items: any[]) => `Strike $${items[0]?.label ?? ""}`,
              label: (ctx: any) => {
                const raw = ctx.raw;
                if (raw == null) return "";
                if (Array.isArray(raw)) {
                  return `${ctx.dataset.label}: $${raw[0]?.toFixed(2)} – $${raw[1]?.toFixed(2)}`;
                }
                return `${ctx.dataset.label}: $${Number(raw).toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, autoSkip: true, maxTicksLimit: 30 },
            title: { display: true, text: "Strike ($)", font: { size: 10 } },
          },
          y: {
            ...yScale,
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...yScale.ticks,
              font: { size: 10 },
              callback: (value: any) => `$${Number(value).toFixed(0)}`,
            },
            title: { display: true, text: "Price ($)", font: { size: 10 } },
          },
        },
      },
      plugins: [vSpotPlugin, focusPlugin],
    };
  };

  const chartPanel = createChartPanel<PricingPoint[]>(
    {
      title: "Theo vs Market (mid, filtered)",
      buildChartConfig,
      controls: controlsWrap,
      destroyOnUpdate: true,
    },
    pricingData,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentData);
  });

  // Wrap to match the three-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (d: PricingPoint[], p: number | null, f: PricingFilters) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (d: PricingPoint[], p: number | null, f: PricingFilters) => {
    currentData = d;
    currentPrice = p;
    currentFilters = f;
    if (origUpdate) origUpdate(d);
  };

  const origCleanup = chartPanel.cleanup;
  result.cleanup = () => {
    unsubscribeFocus();
    if (origCleanup) origCleanup();
  };

  return result;
}
