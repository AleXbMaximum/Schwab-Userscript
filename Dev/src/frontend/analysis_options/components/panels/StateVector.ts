import { ui_createElement } from "../../../components/core/createElement";
import { DS_COLORS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import { formatTimestampCT } from "shared/utils/time";
import {
  formatCompactDollar,
  formatPct as fmtPctShared,
} from "shared/utils/formatters";
import type { StateVectorData, SummaryMetrics } from "backend/computation/options/types";
import type { ActiveFilterState, StateVectorFilterCallbacks } from "../../types";

const COLORS = {
  spot: "#007AFF",
  forward: "#00C7BE",
  putWall: "#d73126",
  callWall: "#20a945",
  maxPain: "#D78100",
  flip: "#8E44AD",
  positive: "#20a945",
  negative: "#d73126",
  dimmed: "var(--ax-fg-muted)",
  delayed: "#d73126",
  label: "var(--ios-text-secondary)",
  value: "var(--ios-text-primary)",
} as const;

const barStyle =
  "position: sticky; top: 0; z-index: var(--z-sticky-state, 120);" +
  " background: var(--ax-glass-2-bg);" +
  " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
  " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
  " border-bottom: 1px solid var(--ax-border-subtle);" +
  " padding: 6px 12px 4px;" +
  " font-family: var(--ax-font-body);";

const groupRowStyle =
  "display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap;";

const groupBoxStyle =
  "display: flex; flex-direction: column; gap: 2px; padding: 2px 0;";

const groupTitleStyle =
  "font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;" +
  " color: var(--ios-text-secondary); opacity: 0.7; line-height: 1; margin-bottom: 2px;"; /* DS_OPACITY.muted */

const groupFieldsStyle =
  "display: flex; align-items: stretch; gap: 10px; flex-wrap: wrap;";

const fieldBoxStyle =
  "display: flex; flex-direction: column; gap: 1px; min-width: 0;";

const fieldLabelStyle =
  "font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px;" +
  ` color: ${COLORS.label}; line-height: 1.2; white-space: nowrap;`;

const fieldValueStyle =
  DS_TYPOGRAPHY.heading +
  " font-variant-numeric: tabular-nums lining-nums;" +
  " white-space: nowrap;";

const groupDividerStyle =
  "width: 1px; align-self: stretch; background: var(--ax-border); margin: 4px 2px;";

const fieldDividerStyle =
  "width: 1px; align-self: stretch; background: var(--ax-border-subtle); margin: 2px 0;";

const badgeBaseStyle =
  "display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 4px;" +
  " font-size: 9px; font-weight: 700; letter-spacing: 0.3px; line-height: 1.5; white-space: nowrap;";

const eventBadgeColors: Record<string, { bg: string; fg: string }> = {
  earnings: { bg: "rgba(215, 129, 0, 0.15)", fg: "#D78100" },
  cpi: { bg: "rgba(88, 86, 214, 0.15)", fg: DS_COLORS.raw.purple },
  fomc: { bg: "rgba(0, 122, 255, 0.15)", fg: "#007AFF" },
  custom: { bg: "var(--ax-tone-muted-soft-bg)", fg: "#8E8E93" },
};

const filterTagStyle =
  "display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px;" +
  " font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s;" +
  " background: rgba(0, 122, 255, 0.08); color: #007AFF; border: 1px solid rgba(0, 122, 255, 0.15);" +
  " font-family: var(--ios-font); white-space: nowrap;";

const filterRowStyle =
  "display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 0 0 0;" +
  " border-top: 1px solid var(--ax-border-subtle); margin-top: 6px;";

const filterInlineStyle =
  "display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;" +
  " min-width: 0;";

function fmtPrice(v: number | null, decimals: number = 2): string {
  if (v == null) return "--";
  return "$" + v.toFixed(decimals);
}

function fmtPct(v: number | null, decimals: number = 1): string {
  return fmtPctShared(v, { decimals });
}

function fmtIV(v: number | null): string {
  return fmtPctShared(v);
}

function fmtGex(v: number | null): string {
  return formatCompactDollar(v);
}

function fmtSkew(v: number | null): string {
  return fmtPctShared(v, { showSign: true });
}

function fmtTimestamp(ts: string): string {
  return formatTimestampCT(ts);
}

function fmtRatio(v: number | null): string {
  if (v == null) return "--";
  return v.toFixed(2);
}

function fmtInt(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function createField(label: string, contentEl: HTMLElement): HTMLElement {
  const box = ui_createElement("div", { styleString: fieldBoxStyle });
  box.appendChild(
    ui_createElement("div", { text: label, styleString: fieldLabelStyle }),
  );
  box.appendChild(contentEl);
  return box;
}

function createFieldDivider(): HTMLElement {
  return ui_createElement("div", { styleString: fieldDividerStyle });
}

function createGroupDivider(): HTMLElement {
  return ui_createElement("div", { styleString: groupDividerStyle });
}

function createValueSpan(text: string, color?: string): HTMLElement {
  const style = fieldValueStyle + (color ? ` color: ${color};` : "");
  return ui_createElement("span", { text, styleString: style });
}

function createEventBadge(type: string, label: string): HTMLElement {
  const colors = eventBadgeColors[type] ?? eventBadgeColors["custom"];
  return ui_createElement("span", {
    text: label,
    styleString:
      badgeBaseStyle + ` background: ${colors.bg}; color: ${colors.fg};`,
  });
}

export function renderActiveFilterTags(
  filters: ActiveFilterState,
  callbacks: StateVectorFilterCallbacks,
  layout: "row" | "inline" = "row",
): HTMLElement {
  const row = ui_createElement("div", {
    styleString: layout === "inline" ? filterInlineStyle : filterRowStyle,
  });

  const scopeLabels: Record<string, string> = {
    single: "Single expiry",
    all: "All expiries",
    multi: "Multi expiry",
    selected: "Single expiry",
    custom: "Multi expiry",
  };
  const addTag = (text: string, onClick?: () => void) => {
    const tag = ui_createElement("span", {
      text,
      styleString: filterTagStyle,
      events: onClick ? { click: onClick } : {},
    });
    tag.title = onClick ? "Click to reset" : "";
    row.appendChild(tag);
  };

  addTag(
    `Scope=${scopeLabels[filters.scopeMode] ?? filters.scopeMode}`,
    callbacks.onResetScope,
  );

  if (filters.localWindowMode === "pct") {
    addTag(
      `Local=\u00B1${filters.localWindowPct}%`,
      callbacks.onResetLocalWindow,
    );
  } else if (filters.localWindowMode === "delta") {
    const [lo, hi] = filters.localWindowDeltaRange;
    addTag(
      `Local=${Math.round(lo * 100)}\u0394\u2013${Math.round(hi * 100)}\u0394`,
      callbacks.onResetLocalWindow,
    );
  } else {
    addTag("Local=Global", callbacks.onResetLocalWindow);
  }

  addTag(
    `Liquidity=${filters.liquidityPreset.charAt(0).toUpperCase() + filters.liquidityPreset.slice(1)}`,
    callbacks.onResetLiquidity,
  );
  addTag(
    `Greeks=${filters.greeksBasis === "mid" ? "Mid" : "Mark"}`,
    callbacks.onResetGreeks,
  );
  if (filters.gammaSource === "bs") {
    addTag("Gamma=BS Model", callbacks.onResetGreeks);
  }

  if (filters.strikeMode === "count") {
    addTag(
      `Strikes=\u00B1${filters.selectedStrikeCount || "All"}`,
      callbacks.onResetStrikes,
    );
  } else if (filters.strikeMode === "dollarWidth") {
    addTag(
      `Strikes=\u00B1$${filters.strikeDollarWidth}`,
      callbacks.onResetStrikes,
    );
  } else {
    addTag("Strikes=Auto", callbacks.onResetStrikes);
  }

  return row;
}

function createGroup(title: string): {
  wrapper: HTMLElement;
  fields: HTMLElement;
} {
  const wrapper = ui_createElement("div", { styleString: groupBoxStyle });
  wrapper.appendChild(
    ui_createElement("div", { text: title, styleString: groupTitleStyle }),
  );
  const fields = ui_createElement("div", { styleString: groupFieldsStyle });
  wrapper.appendChild(fields);
  return { wrapper, fields };
}

type StateVectorElement = HTMLElement & {
  cleanup?: () => void;
  update?: (sv: StateVectorData, m: SummaryMetrics) => void;
};

export function renderStateVector(
  stateVector: StateVectorData,
  metrics: SummaryMetrics,
): StateVectorElement {
  const panel = ui_createElement("div", {
    styleString: barStyle,
  }) as StateVectorElement;

  let currentSV = stateVector;
  let currentMetrics = metrics;
  const groupRow = ui_createElement("div", { styleString: groupRowStyle });
  panel.appendChild(groupRow);

  const render = () => {
    const sv = currentSV;
    const m = currentMetrics;

    groupRow.innerHTML = "";

    const market = createGroup("Market");

    const spotFwdVal = ui_createElement("div", {
      styleString: "display: flex; align-items: baseline; gap: 4px;",
    });
    spotFwdVal.appendChild(createValueSpan(fmtPrice(sv.spot), COLORS.spot));
    spotFwdVal.appendChild(
      ui_createElement("span", {
        text: `/ ${fmtPrice(sv.forward)}`,
        styleString:
          "font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;" +
          ` color: ${COLORS.forward};`,
      }),
    );
    const spotField = createField("Spot / Forward", spotFwdVal);
    const carryParts: string[] = [];
    if (sv.forwardCarry.rate != null)
      carryParts.push(`Rate: ${fmtPct(sv.forwardCarry.rate)}`);
    if (sv.forwardCarry.divYield != null)
      carryParts.push(`Div: ${fmtPct(sv.forwardCarry.divYield)}`);
    if (carryParts.length > 0) spotField.title = carryParts.join("  |  ");
    market.fields.appendChild(spotField);
    market.fields.appendChild(createFieldDivider());

    const expiryVal = ui_createElement("div", {
      styleString: "display: flex; align-items: baseline; gap: 4px;",
    });
    expiryVal.appendChild(
      ui_createElement("span", {
        text: sv.selectedExpiry,
        styleString: fieldValueStyle,
      }),
    );
    expiryVal.appendChild(
      ui_createElement("span", {
        text: `(${sv.dte}d)`,
        styleString:
          "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary); font-variant-numeric: tabular-nums;",
      }),
    );
    market.fields.appendChild(createField("Expiry / DTE", expiryVal));
    market.fields.appendChild(createFieldDivider());

    const eventVal = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 4px; flex-wrap: wrap;",
    });
    if (sv.eventFlags.length === 0) {
      eventVal.appendChild(
        ui_createElement("span", {
          text: "No events",
          styleString: `font-size: 11px; font-weight: 500; font-style: italic; color: ${COLORS.dimmed};`,
        }),
      );
    } else {
      for (const flag of sv.eventFlags) {
        const badgeLabel =
          flag.daysUntil != null
            ? `${flag.label} (${flag.daysUntil}d)`
            : flag.label;
        eventVal.appendChild(createEventBadge(flag.type, badgeLabel));
      }
    }
    market.fields.appendChild(createField("Events", eventVal));
    groupRow.appendChild(market.wrapper);
    groupRow.appendChild(createGroupDivider());

    const vol = createGroup("Vol");

    const ivRrVal = ui_createElement("div", {
      styleString: "display: flex; align-items: baseline; gap: 4px;",
    });
    ivRrVal.appendChild(createValueSpan(fmtIV(sv.atmIV)));
    const rrColor =
      sv.skewMetric != null
        ? sv.skewMetric >= 0
          ? COLORS.positive
          : COLORS.negative
        : undefined;
    ivRrVal.appendChild(
      ui_createElement("span", {
        text: `RR ${fmtSkew(sv.skewMetric)}`,
        styleString:
          "font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums;" +
          (rrColor ? ` color: ${rrColor};` : ` color: ${COLORS.label};`),
      }),
    );
    vol.fields.appendChild(createField("ATM IV + 25\u0394 RR", ivRrVal));
    vol.fields.appendChild(createFieldDivider());

    const moveVal = ui_createElement("div", {
      styleString: "display: flex; align-items: baseline; gap: 4px;",
    });
    moveVal.appendChild(
      createValueSpan(
        sv.impliedMove1Sigma != null
          ? `\u00B1${fmtPrice(sv.impliedMove1Sigma)}`
          : "--",
      ),
    );
    moveVal.appendChild(
      ui_createElement("span", {
        text:
          sv.impliedMovePct != null
            ? `(\u00B1${fmtPct(sv.impliedMovePct)})`
            : "",
        styleString:
          "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary); font-variant-numeric: tabular-nums;",
      }),
    );
    vol.fields.appendChild(createField("Implied Move (1\u03C3)", moveVal));
    groupRow.appendChild(vol.wrapper);
    groupRow.appendChild(createGroupDivider());

    const flow = createGroup("Flow");

    flow.fields.appendChild(
      createField(
        "Call Vol",
        createValueSpan(fmtInt(m.totalCallVolume), COLORS.positive),
      ),
    );
    flow.fields.appendChild(createFieldDivider());
    flow.fields.appendChild(
      createField(
        "Put Vol",
        createValueSpan(fmtInt(m.totalPutVolume), COLORS.negative),
      ),
    );
    flow.fields.appendChild(createFieldDivider());

    const pcVolColor =
      m.pcRatioVolume != null
        ? m.pcRatioVolume > 1
          ? COLORS.negative
          : COLORS.positive
        : undefined;
    flow.fields.appendChild(
      createField(
        "P/C Vol",
        createValueSpan(fmtRatio(m.pcRatioVolume), pcVolColor),
      ),
    );
    flow.fields.appendChild(createFieldDivider());

    flow.fields.appendChild(
      createField(
        "Call OI",
        createValueSpan(fmtInt(m.totalCallOI), COLORS.positive),
      ),
    );
    flow.fields.appendChild(createFieldDivider());
    flow.fields.appendChild(
      createField(
        "Put OI",
        createValueSpan(fmtInt(m.totalPutOI), COLORS.negative),
      ),
    );
    flow.fields.appendChild(createFieldDivider());

    const pcOIColor =
      m.pcRatioOI != null
        ? m.pcRatioOI > 1
          ? COLORS.negative
          : COLORS.positive
        : undefined;
    flow.fields.appendChild(
      createField("P/C OI", createValueSpan(fmtRatio(m.pcRatioOI), pcOIColor)),
    );
    groupRow.appendChild(flow.wrapper);
    groupRow.appendChild(createGroupDivider());

    const dealer = createGroup("Dealer");

    const gexColor =
      sv.netGex != null
        ? sv.netGex >= 0
          ? COLORS.positive
          : COLORS.negative
        : undefined;
    const gexVal = ui_createElement("div", {
      styleString: "display: flex; align-items: baseline; gap: 4px;",
    });
    gexVal.appendChild(createValueSpan(fmtGex(sv.netGex), gexColor));
    gexVal.appendChild(
      ui_createElement("span", {
        text: "$/1%",
        styleString:
          "font-size: 10px; font-weight: 500; color: var(--ios-text-secondary);",
      }),
    );
    dealer.fields.appendChild(createField("Net GEX", gexVal));
    dealer.fields.appendChild(createFieldDivider());

    dealer.fields.appendChild(
      createField(
        "Gamma Flip",
        createValueSpan(
          sv.gammaFlip != null ? fmtPrice(sv.gammaFlip) : "--",
          COLORS.flip,
        ),
      ),
    );
    dealer.fields.appendChild(createFieldDivider());

    const tsVal = ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 4px;",
    });
    tsVal.appendChild(
      ui_createElement("span", {
        text: fmtTimestamp(sv.dataTimestamp),
        styleString:
          fieldValueStyle +
          " font-size: 12px; font-variant-numeric: tabular-nums;",
      }),
    );
    if (sv.isDelayed) {
      tsVal.appendChild(
        ui_createElement("span", {
          text: "DELAYED",
          styleString:
            badgeBaseStyle +
            ` background: rgba(215, 49, 38, 0.12); color: ${COLORS.delayed}; font-size: 9px;`,
        }),
      );
    }
    dealer.fields.appendChild(createField("Timestamp", tsVal));
    groupRow.appendChild(dealer.wrapper);
  };

  render();

  panel.update = (sv: StateVectorData, m: SummaryMetrics) => {
    currentSV = sv;
    currentMetrics = m;
    render();
  };

  panel.cleanup = () => {
    /* No external resources */
  };

  return panel;
}
