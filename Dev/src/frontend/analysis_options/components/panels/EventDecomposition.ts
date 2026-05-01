import { ui_createElement } from "../../../components/core/createElement";
import {
  DS_COLORS,
  DS_COMPONENTS,
  DS_RADIUS,
  DS_SPACING,
  DS_TYPOGRAPHY,
  ds_severityColors,
} from "../../../components/core/theme";
import { formatPct } from "shared/utils/formatters";
import type { TermStructurePoint } from "backend/computation/options/types";

type Inversion = {
  exp1: string;
  exp2: string;
  nearIV: number;
  farIV: number;
  diff: number;
};

function detectInversions(ts: TermStructurePoint[]): Inversion[] {
  const inversions: Inversion[] = [];
  const sorted = [...ts]
    .filter((p) => p.avgIV != null)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  for (let i = 0; i < sorted.length - 1; i++) {
    const near = sorted[i];
    const far = sorted[i + 1];
    if (near.avgIV == null || far.avgIV == null) continue;
    const diff = near.avgIV - far.avgIV;
    if (diff > 3) {
      inversions.push({
        exp1: near.label,
        exp2: far.label,
        nearIV: near.avgIV,
        farIV: far.avgIV,
        diff,
      });
    }
  }
  return inversions;
}

function formatPercentDisplay(v: number | null): string {
  return formatPct(v, { decimals: 1, multiply: false });
}

function formatPp(v: number | null, showPlus = false): string {
  if (v == null || !isFinite(v)) return "--";
  const sign = showPlus && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}pp`;
}

export function renderEventDecomposition(
  termStructure: TermStructurePoint[],
): HTMLElement & {
  cleanup?: () => void;
  update?: (ts: TermStructurePoint[]) => void;
} {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (ts: TermStructurePoint[]) => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Event Decomposition",
      styleString: DS_TYPOGRAPHY.panelTitle,
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "Decomposes front-vs-back IV regime and flags event-driven backwardation nodes (near IV > far IV by >3pp).",
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  const contentContainer = ui_createElement("div", {});

  const sectionStackStyle = `display:flex; flex-direction:column; gap:${DS_SPACING.lg};`;
  const tileGridStyle =
    "display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 140px), 1fr));" +
    ` gap:${DS_SPACING.md};`;
  const tileStyle =
    DS_COMPONENTS.metricCell +
    ` border:1px solid var(--ios-border); border-radius:${DS_RADIUS.lg};` +
    ` background:${DS_COLORS.bgPanel}; padding:${DS_SPACING.md} ${DS_SPACING.lg};`;
  const tileLabelStyle = `${DS_TYPOGRAPHY.metricLabel} letter-spacing: 0.35px;`;
  const tileValueStyle =
    `margin-top:${DS_SPACING.xs}; font-size:15px; font-weight:700;` +
    ` color:${DS_COLORS.textPrimary}; font-variant-numeric:tabular-nums;`;
  const rowCardStyle =
    `border:1px solid var(--ios-border); border-radius:${DS_RADIUS.lg};` +
    ` padding:${DS_SPACING.md} ${DS_SPACING.lg}; background:${DS_COLORS.bgPanel};`;
  const emptyStateStyle =
    `padding:${DS_SPACING.lg}; border-radius:${DS_RADIUS.lg};` +
    ` border:1px dashed var(--ax-border); background:${DS_COLORS.bgSubtle};` +
    ` font-size:12px; color:${DS_COLORS.textSecondary};`;

  function renderContent(ts: TermStructurePoint[]): void {
    contentContainer.innerHTML = "";
    const root = ui_createElement("div", { styleString: sectionStackStyle });
    contentContainer.appendChild(root);

    const sorted = [...ts]
      .filter((p) => p.avgIV != null && isFinite(p.avgIV))
      .sort((a, b) => a.daysUntil - b.daysUntil);
    const inversions = detectInversions(sorted);

    if (sorted.length === 0) {
      root.appendChild(
        ui_createElement("div", {
          text: "No term structure data available for event decomposition.",
          styleString: emptyStateStyle,
        }),
      );
      return;
    }

    const front = sorted[0];
    const back = sorted[sorted.length - 1];
    const frontBackSpread =
      front.avgIV != null && back.avgIV != null
        ? front.avgIV - back.avgIV
        : null;
    const maxInversion =
      inversions.length > 0 ? Math.max(...inversions.map((i) => i.diff)) : null;
    const isEventRegime =
      inversions.length > 0 || (frontBackSpread != null && frontBackSpread > 2);
    const regimeTone = ds_severityColors(isEventRegime ? "warning" : "info");

    const headlineCard = ui_createElement("div", {
      styleString:
        `border-radius:${DS_RADIUS.xl}; border:1px solid ${regimeTone.border}; background:${regimeTone.bg};` +
        ` padding:${DS_SPACING.lg} ${DS_SPACING.xl}; display:flex; align-items:center; justify-content:space-between; gap:${DS_SPACING.lg};`,
    });
    const headlineLeft = ui_createElement("div");
    headlineLeft.appendChild(
      ui_createElement("div", {
        text: isEventRegime
          ? "Regime: Event Premium / Backwardation"
          : "Regime: Normal Carry",
        styleString: DS_TYPOGRAPHY.heading + ` color:${regimeTone.text};`,
      }),
    );
    headlineLeft.appendChild(
      ui_createElement("div", {
        text: isEventRegime
          ? `${inversions.length} inversion node${inversions.length > 1 ? "s" : ""} detected across adjacent maturities.`
          : "No inversion above threshold. Term structure remains in carry-like shape.",
        styleString:
          `font-size:11px; color:${DS_COLORS.textSecondary}; margin-top:${DS_SPACING.xs};`,
      }),
    );
    const headlineRight = ui_createElement("div", {
      styleString:
        `display:flex; flex-direction:column; align-items:flex-end; gap:${DS_SPACING.xs};`,
      children: [
        ui_createElement("span", {
          text: `Front/Back: ${formatPp(frontBackSpread)}`,
          styleString:
            `font-size:11px; font-weight:700; color:${DS_COLORS.textPrimary}; font-variant-numeric:tabular-nums;`,
        }),
        ui_createElement("span", {
          text: `Max inversion: ${formatPp(maxInversion)}`,
          styleString:
            `font-size:10px; color:${DS_COLORS.textSecondary}; font-variant-numeric:tabular-nums;`,
        }),
      ],
    });
    headlineCard.appendChild(headlineLeft);
    headlineCard.appendChild(headlineRight);
    root.appendChild(headlineCard);

    const metricGrid = ui_createElement("div", { styleString: tileGridStyle });
    const createMetricTile = (
      label: string,
      value: string,
      valueColor?: string,
    ): HTMLElement => {
      const tile = ui_createElement("div", { styleString: tileStyle });
      tile.appendChild(
        ui_createElement("div", { text: label, styleString: tileLabelStyle }),
      );
      tile.appendChild(
        ui_createElement("div", {
          text: value,
          styleString: `${tileValueStyle}${valueColor ? ` color: ${valueColor};` : ""}`,
        }),
      );
      return tile;
    };
    metricGrid.appendChild(
      createMetricTile("Front Expiry", `${front.label} (${front.daysUntil}d)`),
    );
    metricGrid.appendChild(
      createMetricTile("Back Expiry", `${back.label} (${back.daysUntil}d)`),
    );
    metricGrid.appendChild(
      createMetricTile("Front Avg IV", formatPercentDisplay(front.avgIV)),
    );
    metricGrid.appendChild(
      createMetricTile("Back Avg IV", formatPercentDisplay(back.avgIV)),
    );
    root.appendChild(metricGrid);

    if (inversions.length > 0) {
      root.appendChild(
        ui_createElement("div", {
          text: "Detected Backwardation Nodes",
          styleString: `${DS_TYPOGRAPHY.metricLabel} letter-spacing: 0.45px;`,
        }),
      );

      for (const inv of inversions) {
        const row = ui_createElement("div", { styleString: rowCardStyle });
        const topRow = ui_createElement("div", {
          styleString:
            "display: flex; justify-content: space-between; align-items: baseline; gap: 8px;",
          children: [
            ui_createElement("span", {
              text: `${inv.exp1} \u2192 ${inv.exp2}`,
              styleString:
                `font-size:12px; font-weight:700; color:${DS_COLORS.textPrimary};`,
            }),
            ui_createElement("span", {
              text: formatPp(inv.diff, true),
              styleString:
                `font-size:12px; font-weight:700; color:${DS_COLORS.neutral}; font-variant-numeric:tabular-nums;`,
            }),
          ],
        });
        row.appendChild(topRow);

        row.appendChild(
          ui_createElement("div", {
            text: `${inv.exp1}: ${formatPercentDisplay(inv.nearIV)}   |   ${inv.exp2}: ${formatPercentDisplay(inv.farIV)}`,
            styleString:
              `margin-top:${DS_SPACING.xs}; font-size:11px; color:${DS_COLORS.textSecondary}; font-variant-numeric:tabular-nums;`,
          }),
        );

        const barWrap = ui_createElement("div", {
          styleString:
            `height:6px; border-radius:${DS_RADIUS.xs}; background:${DS_COLORS.bgSubtle}; margin-top:${DS_SPACING.sm}; overflow:hidden;`,
        });
        const widthPct =
          maxInversion && maxInversion > 0
            ? Math.max(6, Math.min(100, (inv.diff / maxInversion) * 100))
            : 6;
        barWrap.appendChild(
          ui_createElement("div", {
            styleString: `height: 100%; width: ${widthPct.toFixed(1)}%; background: linear-gradient(90deg, rgba(215,129,0,0.55), rgba(215,129,0,0.9));`,
          }),
        );
        row.appendChild(barWrap);
        root.appendChild(row);
      }
    } else {
      const stableTone = ds_severityColors("info");
      root.appendChild(
        ui_createElement("div", {
          styleString:
            `padding:${DS_SPACING.lg} ${DS_SPACING.xl}; border-radius:${DS_RADIUS.lg};` +
            ` border:1px solid ${stableTone.border}; background:${stableTone.bg};` +
            ` font-size:12px; color:${stableTone.text}; font-weight:600;`,
          text: "No inversion above 3pp threshold. No immediate event-risk signature from term structure.",
        }),
      );
    }

    const interpretation = ui_createElement("div", {
      styleString:
        `padding:${DS_SPACING.lg} ${DS_SPACING.xl}; border-radius:${DS_RADIUS.lg};` +
        ` border:1px solid var(--ios-border); background:${DS_COLORS.bgPanel};`,
    });
    interpretation.appendChild(
      ui_createElement("div", {
        text: "Interpretation",
        styleString: DS_TYPOGRAPHY.metricLabel,
      }),
    );
    interpretation.appendChild(
      ui_createElement("div", {
        text: isEventRegime
          ? "Front vol is elevated relative to the curve tail. Review known catalysts and watch nearest maturities for vol normalization."
          : "Curve shape is stable. Monitor for sudden front-end repricing if macro/company events approach.",
        styleString:
          `margin-top:${DS_SPACING.sm}; font-size:11px; color:${DS_COLORS.textSecondary}; line-height:1.45;`,
      }),
    );
    root.appendChild(interpretation);
  }

  renderContent(termStructure);
  panel.appendChild(contentContainer);

  panel.update = (ts: TermStructurePoint[]) => {
    renderContent(ts);
  };

  panel.cleanup = () => {};

  return panel;
}
