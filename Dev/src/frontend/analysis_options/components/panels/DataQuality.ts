import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, DS_COLORS } from "../../../components/core/theme";
import { formatTimestampCT } from "shared/utils/time";
import type {
  DataQualityReport,
  VolSurfaceDiagnostics,
  LiquidityScoreData,
} from "backend/computation/options/types";

type GradeColor = { text: string; bg: string; border: string };

const GRADE_COLORS: Record<string, GradeColor> = {
  A: {
    text: DS_COLORS.raw.positive,
    bg: "rgba(32, 169, 69, 0.12)",
    border: "rgba(32, 169, 69, 0.3)",
  },
  B: {
    text: DS_COLORS.raw.info,
    bg: "rgba(0, 122, 255, 0.12)",
    border: "rgba(0, 122, 255, 0.3)",
  },
  C: {
    text: DS_COLORS.raw.neutral,
    bg: "rgba(215, 129, 0, 0.12)",
    border: "rgba(215, 129, 0, 0.3)",
  },
  D: {
    text: DS_COLORS.raw.negative,
    bg: "rgba(215, 49, 38, 0.12)",
    border: "rgba(215, 49, 38, 0.3)",
  },
  F: {
    text: "#8b0000",
    bg: "rgba(139, 0, 0, 0.12)",
    border: "rgba(139, 0, 0, 0.3)",
  },
};

function gradeColor(grade: string): GradeColor {
  return GRADE_COLORS[grade] || GRADE_COLORS["F"];
}

const sectionHeaderStyle =
  "font-size: 12px; font-weight: 700; color: var(--ios-text-primary); margin: 0 0 6px 0; padding-bottom: 4px;" +
  " border-bottom: 1px solid var(--ax-border-subtle);";

const metricRowStyle =
  "display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px 8px; padding: 2px 0;" +
  " font-size: 11px; color: var(--ios-text-secondary);";

const metricValueStyle =
  "font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; color: var(--ios-text-primary); overflow-wrap: anywhere;";

const expandBtnStyle =
  "background: none; border: none; cursor: pointer; font-size: 11px; color: var(--ios-blue);" +
  " font-weight: 600; padding: 2px 4px; font-family: var(--ios-font);";

const violationRowStyle =
  "font-size: 10px; color: var(--ios-text-secondary); padding: 2px 8px; font-variant-numeric: tabular-nums;";

export function renderDataQuality(
  quality: DataQualityReport,
  volDiag: VolSurfaceDiagnostics,
  liquidity: LiquidityScoreData,
): HTMLElement & {
  cleanup?: () => void;
  update?: (
    q: DataQualityReport,
    v: VolSurfaceDiagnostics,
    l: LiquidityScoreData,
  ) => void;
} {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (
      q: DataQualityReport,
      v: VolSurfaceDiagnostics,
      l: LiquidityScoreData,
    ) => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Data Quality & Diagnostics",
      styleString: DS_TYPOGRAPHY.panelTitle,
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "Quote completeness, spread filters, and surface coverage in a unified quality score.",
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  const contentContainer = ui_createElement("div", {});

  function buildGauge(score: number, grade: string): HTMLElement {
    const gc = gradeColor(grade);
    const pct = Math.max(0, Math.min(100, score));

    const gauge = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 10px; margin-bottom: 8px;",
    });

    const circle = ui_createElement("div", {
      styleString:
        `width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center;` +
        ` flex-direction: column; border: 3px solid ${gc.border}; background: ${gc.bg};`,
      children: [
        ui_createElement("span", {
          text: grade,
          styleString: `font-size: 16px; font-weight: 800; color: ${gc.text}; line-height: 1;`,
        }),
        ui_createElement("span", {
          text: String(Math.round(pct)),
          styleString: `font-size: 10px; font-weight: 600; color: ${gc.text}; line-height: 1;`,
        }),
      ],
    });

    const barTrack = ui_createElement("div", {
      styleString:
        "flex: 1; height: 6px; border-radius: 999px; background: var(--ax-bg-glass-inset); overflow: hidden;",
    });

    const barFill = ui_createElement("div", {
      styleString:
        `height: 100%; border-radius: 999px; width: ${pct}%; background: ${gc.text};` +
        " transition: width 0.4s ease;",
    });

    barTrack.appendChild(barFill);
    gauge.appendChild(circle);
    gauge.appendChild(barTrack);

    return gauge;
  }

  function buildExpandable(
    label: string,
    count: number,
    details: { text: string }[],
  ): HTMLElement {
    const wrapper = ui_createElement("div", {
      styleString: "margin-bottom: 2px;",
    });
    let expanded = false;

    const row = ui_createElement("div", { styleString: metricRowStyle });
    const labelEl = ui_createElement("span", { text: label });

    const rightSide = ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 4px;",
    });

    const countEl = ui_createElement("span", {
      text: String(count),
      styleString:
        metricValueStyle + (count > 0 ? " color: var(--ios-orange);" : ""),
    });

    const detailContainer = ui_createElement("div", {
      styleString: "display: none; padding: 2px 0 4px 0;",
    });

    for (const d of details) {
      detailContainer.appendChild(
        ui_createElement("div", {
          text: d.text,
          styleString: violationRowStyle,
        }),
      );
    }

    if (count > 0 && details.length > 0) {
      const toggleBtn = ui_createElement("button", {
        text: "[+]",
        styleString: expandBtnStyle,
        events: {
          click: () => {
            expanded = !expanded;
            detailContainer.style.display = expanded ? "block" : "none";
            toggleBtn.textContent = expanded ? "[-]" : "[+]";
          },
        },
      });
      rightSide.appendChild(countEl);
      rightSide.appendChild(toggleBtn);
    } else {
      rightSide.appendChild(countEl);
    }

    row.appendChild(labelEl);
    row.appendChild(rightSide);
    wrapper.appendChild(row);
    wrapper.appendChild(detailContainer);

    return wrapper;
  }

  function renderContent(
    q: DataQualityReport,
    v: VolSurfaceDiagnostics,
    l: LiquidityScoreData,
  ): void {
    contentContainer.innerHTML = "";

    const section1 = ui_createElement("div", {
      styleString: "margin-bottom: 12px;",
    });
    section1.appendChild(
      ui_createElement("div", {
        text: "Quality Score",
        styleString: sectionHeaderStyle,
      }),
    );
    section1.appendChild(buildGauge(q.qualityScore, q.qualityGrade));

    section1.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Missing quotes" }),
          ui_createElement("span", {
            text: `${q.missingQuoteCount}/${q.totalStrikes} (${q.missingQuotePct.toFixed(1)}%)`,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    section1.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Wide spreads filtered" }),
          ui_createElement("span", {
            text: `${q.wideSpreadFilteredCount}/${l.totalCount} (${q.wideSpreadFilteredPct.toFixed(1)}%)`,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    section1.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Interpolated points (surface)" }),
          ui_createElement("span", {
            text: `${q.interpolatedPointCount}/${v.totalPoints} (${q.interpolatedPointPct.toFixed(1)}%)`,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    contentContainer.appendChild(section1);

    const section2 = ui_createElement("div", {
      styleString: "margin-bottom: 12px;",
    });
    section2.appendChild(
      ui_createElement("div", {
        text: "Surface No-Arb Checks",
        styleString: sectionHeaderStyle,
      }),
    );

    const calDetails = v.calendarViolations.map((cv) => ({
      text: `K=${cv.strike}: ${cv.exp1} (${cv.iv1.toFixed(1)}%) vs ${cv.exp2} (${cv.iv2.toFixed(1)}%)`,
    }));
    section2.appendChild(
      buildExpandable(
        "Calendar violations",
        v.calendarViolations.length,
        calDetails,
      ),
    );

    const bflyDetails = v.butterflyViolations.map((bv) => ({
      text: `K=${bv.strike} (${bv.exp}): ${bv.detail}`,
    }));
    section2.appendChild(
      buildExpandable(
        "Butterfly violations",
        v.butterflyViolations.length,
        bflyDetails,
      ),
    );

    const missingLabel = `${v.missingPointPct.toFixed(1)}% missing (${v.filledPoints}/${v.totalPoints} filled)`;
    section2.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Surface gaps" }),
          ui_createElement("span", {
            text: missingLabel,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    section2.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Interpolation method" }),
          ui_createElement("span", {
            text: v.interpolationMethod,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    contentContainer.appendChild(section2);

    const section3 = ui_createElement("div", {});
    section3.appendChild(
      ui_createElement("div", {
        text: "Data Freshness",
        styleString: sectionHeaderStyle,
      }),
    );

    section3.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "OI timestamp" }),
          ui_createElement("span", {
            text: (formatTimestampCT(q.oiTimestamp) || "N/A") + " CT",
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    if (q.isPreMarket) {
      section3.appendChild(
        ui_createElement("div", {
          styleString:
            "display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 8px;" +
            " background: rgba(215, 129, 0, 0.10); border: 1px solid rgba(215, 129, 0, 0.25);" +
            " font-size: 11px; font-weight: 600; color: var(--ios-orange); margin: 4px 0;",
          innerHTML:
            '<span style="font-size: 12px;">&#9888;</span><span>Pre-market data: OI may be stale from previous close</span>',
        }),
      );
    }

    const freshCount = q.freshPositionStrikes.length;
    const topStrikes = q.freshPositionStrikes
      .slice(0, 5)
      .map((s) => `$${s}`)
      .join(", ");
    section3.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Fresh positions" }),
          ui_createElement("span", {
            text: `${freshCount} strike${freshCount !== 1 ? "s" : ""}`,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    if (freshCount > 0) {
      section3.appendChild(
        ui_createElement("div", {
          text: `Top: ${topStrikes}${freshCount > 5 ? " ..." : ""}`,
          styleString:
            "font-size: 10px; color: var(--ios-text-secondary); padding-left: 4px; margin-bottom: 2px;",
        }),
      );
    }

    section3.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Zero-OI expirations" }),
          ui_createElement("span", {
            text: String(q.zeroOIExpirations),
            styleString:
              metricValueStyle +
              (q.zeroOIExpirations > 0 ? " color: var(--ios-orange);" : ""),
          }),
        ],
      }),
    );

    section3.appendChild(
      ui_createElement("div", {
        styleString: metricRowStyle,
        children: [
          ui_createElement("span", { text: "Missing IV (selected exp)" }),
          ui_createElement("span", {
            text: `${q.missingIVPct.toFixed(1)}%`,
            styleString: metricValueStyle,
          }),
        ],
      }),
    );

    contentContainer.appendChild(section3);
  }

  renderContent(quality, volDiag, liquidity);
  panel.appendChild(contentContainer);

  panel.update = (
    q: DataQualityReport,
    v: VolSurfaceDiagnostics,
    l: LiquidityScoreData,
  ) => {
    renderContent(q, v, l);
  };

  panel.cleanup = () => {};

  return panel;
}
