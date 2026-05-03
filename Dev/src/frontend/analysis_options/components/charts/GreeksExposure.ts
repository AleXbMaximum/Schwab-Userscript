import { ui_createElement } from "../../../components/core/builders/createElement";
import { createChartPanel } from "frontend/charts/chartPanel";
import {
  OPTIONS_SEMANTIC_COLORS as C,
  niceLinearScale,
  niceStrikeTicks,
} from "frontend/charts/ChartTheme";
import type { GreeksExposureData } from "backend/computation/options/types";
import { createSpotPlugin } from "../spotPricePlugin";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import {
  getFocusedLevels,
  subscribeFocusedLevels,
  setFocusedStrike,
} from "../../focus/focusStrike";
import { formatCompactDollar } from "shared/utils/format/formatters";

const fmtVal = (v: number): string =>
  formatCompactDollar(v, { sign: true, unicodeMinus: true });

const TAB_KEYS = ["gamma", "vanna", "charm", "delta", "theta", "vega"] as const;
const TAB_LABELS = [
  "\u0393 Gamma",
  "Vanna",
  "Charm",
  "\u0394 Delta",
  "\u0398 Theta",
  "\u03BD Vega",
];
const TAB_DESCRIPTIONS = [
  "\u0393 = \u2202\u0394/\u2202S. Net gamma exposure by strike (OI \u00D7 \u0393 \u00D7 S\u00B2 \u00D7 M / 100). Positive = dealers short gamma (mean-reversion).",
  "Vanna = \u2202\u0394/\u2202\u03C3 \u2248 Vega/S. Sensitivity of delta to IV changes. Large vanna = vol-move amplification.",
  "Charm = \u2202\u0394/\u2202t \u2248 \u2212\u0398/S. Delta decay over time. Drives overnight hedging flows.",
  "\u0394 = \u2202V/\u2202S. Net delta exposure by strike (OI \u00D7 \u0394 \u00D7 S \u00D7 M). Shows directional bias.",
  "\u0398 = \u2202V/\u2202t. Net theta exposure by strike (OI \u00D7 \u0398 \u00D7 M). Shows time-decay concentration.",
  "\u03BD = \u2202V/\u2202\u03C3. Net vega exposure by strike (OI \u00D7 \u03BD \u00D7 M). Shows vol-sensitivity concentration.",
];

export function renderGreeksExposure(
  data: GreeksExposureData,
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: GreeksExposureData, p: number | null) => void;
} {
  let currentData = data;
  let currentPrice = underlyingPrice;
  let activeTab = 0;
  let currentLabels: string[] = [];
  let focusedLevels = getFocusedLevels();

  const spotPlugin = createSpotPlugin(
    () => currentPrice,
    () => currentLabels,
  );
  const focusPlugin = createVerticalFocusStrikePlugin(
    () => focusedLevels,
    () => currentLabels,
  );

  // ── Zone 2: Tab controls (built once) ──────────────────────────────────

  const subtitleEl = ui_createElement("div", {
    text: TAB_DESCRIPTIONS[0],
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 8px; line-height: 1.4;",
  });

  const tabRow = ui_createElement("div", {
    styleString:
      "display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap;",
  });

  const tabBtns: HTMLElement[] = [];

  const updateTabStyles = () => {
    tabBtns.forEach((btn, i) => {
      const isActive = i === activeTab;
      btn.style.cssText =
        `padding: 4px 10px; font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-bold); border-radius: var(--ax-radius-xl); cursor: pointer;` +
        ` border: 1px solid ${isActive ? "var(--ax-blue)" : "var(--ax-border)"};` +
        ` background: ${isActive ? "var(--ax-blue)" : "var(--ax-bg-input)"};` +
        ` color: ${isActive ? "#fff" : "var(--ax-fg)"};` +
        ` font-family: var(--ax-font-body); transition: all 0.15s;`;
    });
  };

  // Build controls container
  const controlsWrap = ui_createElement("div", {});
  controlsWrap.appendChild(subtitleEl);
  controlsWrap.appendChild(tabRow);

  // Declare chartPanel variable so tab click handlers can reference it
  let panelUpdate: ((data: GreeksExposureData) => void) | undefined;

  TAB_LABELS.forEach((label, idx) => {
    const btn = ui_createElement("button", {
      text: label,
      events: {
        click: () => {
          activeTab = idx;
          updateTabStyles();
          subtitleEl.textContent = TAB_DESCRIPTIONS[activeTab];
          // Re-render chart with current data and new tab
          if (panelUpdate) panelUpdate(currentData);
        },
      },
    });
    tabBtns.push(btn);
    tabRow.appendChild(btn);
  });

  updateTabStyles();

  // ── Zone 3: Metrics info (rebuilt on each update) ──────────────────────

  const buildInfo = (d: GreeksExposureData): HTMLElement | null => {
    const key = TAB_KEYS[activeTab];
    const points = d[key];
    if (!points || points.length === 0) return null;

    const posSum = points.reduce((s, pt) => s + Math.max(0, pt.netVal), 0);
    const negSum = points.reduce((s, pt) => s + Math.min(0, pt.netVal), 0);
    const net = posSum + negSum;

    const row = ui_createElement("div", {
      styleString:
        "display: flex; gap: 12px; margin-bottom: 8px; font-size: 11px; font-variant-numeric: tabular-nums lining-nums;",
    });
    row.appendChild(
      ui_createElement("span", {
        text: `${C.arrowUp} Positive: ${fmtVal(posSum)}`,
        styleString: `font-weight: 600; color: ${C.bullish};`,
      }),
    );
    row.appendChild(
      ui_createElement("span", {
        text: `${C.arrowDown} Negative: ${fmtVal(negSum)}`,
        styleString: `font-weight: 600; color: ${C.bearish};`,
      }),
    );
    row.appendChild(
      ui_createElement("span", {
        text: `${C.diamond} Net: ${fmtVal(net)}`,
        styleString: `font-weight: 700; color: ${net >= 0 ? C.bullish : C.bearish};`,
      }),
    );
    return row;
  };

  // ── Zone 4: Chart config builder ──────────────────────────────────────

  const buildChartConfig = (d: GreeksExposureData) => {
    const key = TAB_KEYS[activeTab];
    const points = d[key];
    if (!points || points.length === 0) {
      return {
        type: "bar" as const,
        data: { labels: [], datasets: [] },
        options: { responsive: true, maintainAspectRatio: false },
      };
    }
    const labels = points.map((pt) => String(pt.strike));
    currentLabels = labels;
    const netValues = points.map((pt) => pt.netVal);
    const colors = netValues.map((v) =>
      v >= 0 ? C.fillPositive : C.fillNegative,
    );
    const borderColors = netValues.map((v) => (v >= 0 ? C.bullish : C.bearish));

    return {
      type: "bar" as const,
      data: {
        labels,
        datasets: [
          {
            label: `Net ${TAB_LABELS[activeTab]}`,
            data: netValues,
            backgroundColor: colors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt: any, els: any[]) => {
          const idx = els?.[0]?.index;
          if (idx == null) return;
          const strike = points[idx]?.strike;
          if (strike == null) return;
          setFocusedStrike(strike);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items: any[]) => {
                const idx = items[0]?.dataIndex;
                if (idx == null) return "";
                return `Strike $${points[idx].strike}`;
              },
              label: (ctx: any) => {
                const idx = ctx.dataIndex;
                const pt = points[idx];
                return [
                  `Call: ${fmtVal(pt.callVal)}`,
                  `Put: ${fmtVal(pt.putVal)}`,
                  `Net: ${fmtVal(pt.netVal)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 45,
              ...niceStrikeTicks(labels),
            },
          },
          y: {
            ...niceLinearScale(netValues),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale(netValues).ticks,
              font: { size: 10 },
              callback: (value: any) => {
                const v = Number(value);
                if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + "B";
                if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
                if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + "K";
                return String(v);
              },
            },
          },
        },
      },
      plugins: [spotPlugin, focusPlugin],
    };
  };

  // ── Create panel ──────────────────────────────────────────────────────

  const chartPanel = createChartPanel<GreeksExposureData>(
    {
      title: "Greeks Exposure",
      buildChartConfig,
      controls: controlsWrap,
      buildInfo,
      destroyOnUpdate: true,
    },
    data,
  );

  // Wire up panelUpdate so tab clicks can trigger re-render
  panelUpdate = chartPanel.update;

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentData);
  });

  // Wrap to match the two-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (d: GreeksExposureData, p: number | null) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (d: GreeksExposureData, p: number | null) => {
    currentData = d;
    currentPrice = p;
    if (origUpdate) origUpdate(d);
  };

  const origCleanup = chartPanel.cleanup;
  result.cleanup = () => {
    unsubscribeFocus();
    if (origCleanup) origCleanup();
  };

  return result;
}
