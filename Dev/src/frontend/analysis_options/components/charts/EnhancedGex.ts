import { ui_createElement } from "../../../components/core/createElement";
import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, niceStrikeTicks } from "frontend/charts/ChartTheme";
import { OPTIONS_SEMANTIC_COLORS as C } from "frontend/charts/ChartTheme";
import { formatTimestampCT } from "shared/utils/time";
import { formatCompactDollar, formatStrike } from "shared/utils/formatters";
import type { GexAnalytics, GreeksBasis, KeyLevelsLadderData } from "backend/computation/options/types";
import { ladderValue } from "frontend/charts/ChartUtils";
import { createSpotPlugin } from "../spotPricePlugin";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import {
  getFocusedLevels,
  subscribeFocusedLevels,
  setFocusedStrike,
} from "../../focus/focusStrike";

const fmtDol = (v: number): string =>
  formatCompactDollar(v, { sign: true, unicodeMinus: true, decimals: 2 });


function createBadge(text: string, color: string, bg: string): HTMLElement {
  return ui_createElement("span", {
    text,
    styleString:
      `display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;` +
      ` color: ${color}; background: ${bg}; letter-spacing: 0.3px; font-variant-numeric: tabular-nums lining-nums;`,
  });
}

function renderContributorsTable(
  contributors: GexAnalytics["topContributors"],
  focusedStrike: number | null,
): HTMLElement {
  const table = ui_createElement("div", {
    styleString:
      "margin-top: 8px; font-size: 10px; font-variant-numeric: tabular-nums lining-nums;",
  });

  const headerRow = ui_createElement("div", {
    styleString:
      "display: grid; grid-template-columns: 60px 1fr 1fr 1fr; gap: 4px; padding: 3px 6px; font-weight: 700; color: var(--ios-text-secondary); border-bottom: 1px solid var(--ios-border);",
  });
  for (const label of ["Strike", "Call GEX", "Put GEX", "Net GEX"]) {
    headerRow.appendChild(
      ui_createElement("span", {
        text: label,
        styleString: label === "Strike" ? "" : "text-align: right;",
      }),
    );
  }
  table.appendChild(headerRow);

  for (const c of contributors) {
    const isFocused =
      focusedStrike != null && Math.abs(focusedStrike - c.strike) < 0.01;
    const row = ui_createElement("button", {
      styleString:
        "display: grid; grid-template-columns: 60px 1fr 1fr 1fr; gap: 4px; padding: 3px 6px; border: none;" +
        ` border-bottom: 1px solid rgba(0,0,0,0.03); width: 100%; text-align: left; cursor: pointer;` +
        ` background: ${isFocused ? "rgba(0,122,255,0.08)" : "transparent"}; font-family: var(--ios-font);`,
      events: {
        click: () => setFocusedStrike(c.strike),
      },
    });
    row.appendChild(
      ui_createElement("span", {
        text: formatStrike(c.strike),
        styleString: `font-weight: 700; ${isFocused ? "color: #007AFF;" : ""}`,
      }),
    );
    row.appendChild(
      ui_createElement("span", {
        text: fmtDol(c.callGex),
        styleString: `text-align: right; color: ${C.bullish};`,
      }),
    );
    row.appendChild(
      ui_createElement("span", {
        text: fmtDol(c.putGex),
        styleString: `text-align: right; color: ${C.bearish};`,
      }),
    );
    const netColor = c.netGex >= 0 ? C.bullish : C.bearish;
    row.appendChild(
      ui_createElement("span", {
        text: fmtDol(c.netGex),
        styleString: `text-align: right; font-weight: 700; color: ${netColor};`,
      }),
    );
    table.appendChild(row);
  }

  return table;
}

export function renderEnhancedGex(
  analytics: GexAnalytics,
  underlyingPrice: number | null,
  basis: GreeksBasis,
  oiTimestamp: string,
  ladder: KeyLevelsLadderData,
): HTMLElement & {
  cleanup?: () => void;
  update?: (
    a: GexAnalytics,
    p: number | null,
    b: GreeksBasis,
    ts: string,
    l: KeyLevelsLadderData,
  ) => void;
} {
  let currentAnalytics = analytics;
  let currentPrice = underlyingPrice;
  let currentLabels: string[] = [];
  let currentBasis = basis;
  let currentTimestamp = oiTimestamp;
  let currentLadder = ladder;
  let focusedLevels = getFocusedLevels();

  const spotPlugin = createSpotPlugin(
    () => currentPrice,
    () => currentLabels,
  );
  const focusPlugin = createVerticalFocusStrikePlugin(
    () => focusedLevels,
    () => currentLabels,
  );

  // ── Description elements (updated in buildInfo) ────────────────────────

  const subtitleEl = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 4px; line-height: 1.4;",
  });

  const assumptionsEl = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 10px; color: var(--ios-text-secondary); margin-bottom: 6px; line-height: 1.35;",
  });

  // Build controls container with subtitle and assumptions
  const controlsWrap = ui_createElement("div", {});
  controlsWrap.appendChild(subtitleEl);
  controlsWrap.appendChild(assumptionsEl);

  // ── Zone 3: Metrics info (rebuilt on each update) ──────────────────────

  const buildInfo = (a: GexAnalytics): HTMLElement | null => {
    // Update description texts on each render
    subtitleEl.textContent = `GEX = \u03A3(OI \u00D7 \u0393 \u00D7 S\u00B2 \u00D7 M) / 100 [$ per 1% move]. Basis: ${currentBasis.toUpperCase()}.`;
    assumptionsEl.textContent = `Assumptions: dealers are opposite customer flow (calls +, puts -). OI/greeks opening timestamp: ${formatTimestampCT(currentTimestamp) || "N/A"} CT.`;

    const row = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;",
    });

    const envColor = a.isPositiveGamma ? C.bullish : C.bearish;
    const envBg = a.isPositiveGamma ? C.bgPositive : C.bgNegative;
    const envIcon = a.isPositiveGamma ? C.arrowUp : C.arrowDown;
    const envText = a.isPositiveGamma
      ? `${envIcon} Positive \u0393`
      : `${envIcon} Negative \u0393`;
    row.appendChild(createBadge(envText, envColor, envBg));

    row.appendChild(
      ui_createElement("span", {
        text: `Net: ${fmtDol(a.totalNetGex)} / 1%`,
        styleString: `font-size: 12px; font-weight: 700; color: ${a.totalNetGex >= 0 ? C.bullish : C.bearish}; font-variant-numeric: tabular-nums lining-nums;`,
      }),
    );

    row.appendChild(
      ui_createElement("span", {
        text: `Gross: ${fmtDol(a.grossGex)} / 1%`,
        styleString:
          "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary); font-variant-numeric: tabular-nums lining-nums;",
      }),
    );

    const flip = ladderValue(currentLadder, "flip");
    const callWall = ladderValue(currentLadder, "callWall");
    const putWall = ladderValue(currentLadder, "putWall");

    if (flip != null) {
      row.appendChild(
        createBadge(
          `\u0393 Flip (GEX): ${formatStrike(flip)}`,
          C.gammaFlip,
          "rgba(142, 68, 173, 0.1)",
        ),
      );
    }

    if (callWall != null) {
      row.appendChild(
        ui_createElement("span", {
          text: `Call Wall (OI): ${formatStrike(callWall)}`,
          styleString: `font-size: 11px; color: ${C.callWall}; font-weight: 600; font-variant-numeric: tabular-nums;`,
        }),
      );
    }
    if (putWall != null) {
      row.appendChild(
        ui_createElement("span", {
          text: `Put Wall (OI): ${formatStrike(putWall)}`,
          styleString: `font-size: 11px; color: ${C.putWall}; font-weight: 600; font-variant-numeric: tabular-nums;`,
        }),
      );
    }

    return row;
  };

  // ── Footer: collapsible contributors table ─────────────────────────────

  const contributorsSection = ui_createElement("div", {});

  const renderContributors = (a: GexAnalytics) => {
    contributorsSection.innerHTML = "";
    if (!a.topContributors || a.topContributors.length === 0) return;

    let isOpen = false;
    const toggleBtn = ui_createElement("button", {
      text: `\u25B6 Top ${a.topContributors.length} Contributors (click row to drill-down)`,
      styleString:
        "padding: 4px 12px; font-size: 10px; font-weight: 600; border-radius: 8px; cursor: pointer;" +
        " border: 1px solid var(--ios-border); background: rgba(255,255,255,0.6);" +
        " color: var(--ios-text-secondary); font-family: var(--ios-font); margin-top: 6px;",
      events: {
        click: () => {
          isOpen = !isOpen;
          tableContainer.style.display = isOpen ? "block" : "none";
          toggleBtn.textContent = isOpen
            ? `\u25BC Top ${a.topContributors.length} Contributors (click row to drill-down)`
            : `\u25B6 Top ${a.topContributors.length} Contributors (click row to drill-down)`;
        },
      },
    });
    contributorsSection.appendChild(toggleBtn);

    const tableContainer = ui_createElement("div", {
      styleString: "display: none;",
    });
    const firstStrike =
      focusedLevels.length > 0 ? focusedLevels[0].strike : null;
    tableContainer.appendChild(
      renderContributorsTable(a.topContributors, firstStrike),
    );
    contributorsSection.appendChild(tableContainer);
  };

  // ── Zone 4: Chart config builder ──────────────────────────────────────

  const buildChartConfig = (a: GexAnalytics) => {
    // Also update contributors table on each render
    renderContributors(a);

    const labels = a.data.map((d) => String(d.strike));
    currentLabels = labels;
    const netValues = a.data.map((d) => d.netGex);
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
            label: "Net GEX",
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
          const strike = a.data[idx]?.strike;
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
                const d = a.data[idx];
                return `Strike ${formatStrike(d.strike)}`;
              },
              label: (ctx: any) => {
                const idx = ctx.dataIndex;
                const d = a.data[idx];
                return [
                  `Net GEX: ${fmtDol(d.netGex)} / 1%`,
                  `Call GEX: ${fmtDol(d.callGex)} / 1%`,
                  `Put GEX: ${fmtDol(d.putGex)} / 1%`,
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

  const chartPanel = createChartPanel<GexAnalytics>(
    {
      title: "Dealer Gamma Exposure (GEX)",
      buildChartConfig,
      controls: controlsWrap,
      buildInfo,
      footer: contributorsSection,
      destroyOnUpdate: true,
    },
    analytics,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentAnalytics);
  });

  // Wrap to match the multi-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (
      a: GexAnalytics,
      p: number | null,
      b: GreeksBasis,
      ts: string,
      l: KeyLevelsLadderData,
    ) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (
    a: GexAnalytics,
    p: number | null,
    b: GreeksBasis,
    ts: string,
    l: KeyLevelsLadderData,
  ) => {
    currentAnalytics = a;
    currentPrice = p;
    currentBasis = b;
    currentTimestamp = ts;
    currentLadder = l;
    if (origUpdate) origUpdate(a);
  };

  const origCleanup = chartPanel.cleanup;
  result.cleanup = () => {
    unsubscribeFocus();
    if (origCleanup) origCleanup();
  };

  return result;
}
