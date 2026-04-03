import { ui_createElement } from "../core/createElement";
import {
  DS_COLORS,
  DS_TYPOGRAPHY,
  DS_COMPONENTS,
  DS_SPACING,
  DS_RADIUS,
} from "../core/theme";
import type { BarronsDataBundle } from "../../../backend/core/network/barrons/types";

// ── Shared style fragments ──────────────────────────────────────────────────

const SECTION_CARD =
  `background: ${DS_COLORS.bgPanel}; border: 1px solid var(--ios-border);` +
  ` border-radius: ${DS_RADIUS.lg}; padding: ${DS_SPACING.lg} ${DS_SPACING.xl};`;

const KV_CELL = `${DS_COMPONENTS.metricCell} padding: 6px 10px; gap: 2px;`;

const GRID_4 = `display: grid; grid-template-columns: repeat(4, 1fr); gap: ${DS_SPACING.sm};`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function sectionTitle(text: string): HTMLElement {
  return ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; margin-bottom: 2px;",
    children: [
      ui_createElement("span", {
        text,
        styleString: DS_TYPOGRAPHY.metricLabel,
      }),
      ui_createElement("span", {
        styleString:
          "flex: 1; height: 1px; background: var(--ios-border); opacity: 0.6;",
      }),
    ],
  });
}

function subLabel(text: string): HTMLElement {
  return ui_createElement("span", {
    text,
    styleString:
      `font-size: 10px; font-weight: 600; color: ${DS_COLORS.info};` +
      " text-transform: uppercase; letter-spacing: 0.3px; margin-top: 4px;",
  });
}

function kvCell(label: string, value: string): HTMLElement {
  return ui_createElement("div", {
    styleString: KV_CELL,
    children: [
      ui_createElement("span", {
        text: label,
        styleString: DS_TYPOGRAPHY.metricLabelMini,
      }),
      ui_createElement("span", {
        text: value || "—",
        styleString: DS_TYPOGRAPHY.metricValue,
      }),
    ],
  });
}

// ── Section builders ────────────────────────────────────────────────────────

function buildCompanyProfile(b: BarronsDataBundle): HTMLElement {
  const section = ui_createElement("div", {
    styleString:
      SECTION_CARD + " display: flex; flex-direction: column; gap: 6px;",
  });
  section.appendChild(sectionTitle("Company Profile"));

  const d = b.companyDetails;
  const items: Array<[string, string]> = [];
  if (d?.industry) items.push(["Industry", d.industry]);
  if (d?.sector) items.push(["Sector", d.sector]);
  if (d?.revenue) items.push(["Revenue", d.revenue]);
  if (d?.netIncome) items.push(["Net Income", d.netIncome]);
  if (d?.salesGrowth) items.push(["Sales Growth", d.salesGrowth]);
  if (d?.employees) items.push(["Employees", d.employees]);
  if (d?.fiscalYearEnd) items.push(["Fiscal Year End", d.fiscalYearEnd]);

  if (items.length === 0) {
    section.appendChild(
      ui_createElement("span", {
        text: "No company details available.",
        styleString: DS_TYPOGRAPHY.bodyText,
      }),
    );
    return section;
  }

  // Use 4-column grid for the wider panel
  const grid = ui_createElement("div", {
    styleString: GRID_4,
  });
  for (const [lbl, val] of items) grid.appendChild(kvCell(lbl, val));
  section.appendChild(grid);

  if (b.about) {
    section.appendChild(
      ui_createElement("div", {
        text: b.about.slice(0, 400) + (b.about.length > 400 ? "..." : ""),
        styleString:
          DS_TYPOGRAPHY.bodyText +
          " margin-top: 4px; padding-top: 6px; border-top: 1px solid var(--ios-border);",
      }),
    );
  }

  return section;
}

function buildPeople(b: BarronsDataBundle): HTMLElement | null {
  const execs = b.people?.executives ?? [];
  const board = b.people?.boardMembers ?? [];
  if (execs.length === 0 && board.length === 0) return null;

  const section = ui_createElement("div", {
    styleString:
      SECTION_CARD + " display: flex; flex-direction: column; gap: 6px;",
  });
  section.appendChild(sectionTitle("Key People"));

  // Side-by-side columns for executives and board
  const columns = ui_createElement("div", {
    styleString: "display: grid; grid-template-columns: 1fr 1fr; gap: 12px;",
  });

  const renderGroup = (title: string, people: typeof execs): HTMLElement => {
    const col = ui_createElement("div", {
      styleString: "display: flex; flex-direction: column; gap: 4px;",
    });
    col.appendChild(subLabel(title));
    for (const p of people.slice(0, 6)) {
      col.appendChild(
        ui_createElement("div", {
          styleString:
            `display: flex; align-items: center; gap: 6px; padding: 5px 10px;` +
            ` ${DS_COMPONENTS.metricCell} flex-direction: row; background: rgba(0,0,0,0.025);`,
          children: [
            ui_createElement("span", {
              text: p.name,
              styleString:
                "font-size: 11px; font-weight: 600; color: var(--ios-text-primary);" +
                " flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
            }),
            ui_createElement("span", {
              text: p.title,
              styleString:
                "font-size: 10px; color: var(--ios-text-secondary);" +
                " flex-shrink: 0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
            }),
            ...(p.age
              ? [
                  ui_createElement("span", {
                    text: `${p.age}`,
                    styleString:
                      `font-size: 10px; color: ${DS_COLORS.muted}; flex-shrink: 0;` +
                      ` background: rgba(0,0,0,0.04); border-radius: 4px; padding: 1px 5px;`,
                  }),
                ]
              : []),
          ],
        }),
      );
    }
    return col;
  };

  if (execs.length > 0) columns.appendChild(renderGroup("Executives", execs));
  if (board.length > 0)
    columns.appendChild(renderGroup("Board Members", board));
  section.appendChild(columns);
  return section;
}

function buildRatiosGrid(b: BarronsDataBundle): HTMLElement | null {
  const r = b.ratios;
  const categories = [
    { label: "Valuation", data: r.valuation },
    { label: "Profitability", data: r.profitability },
    { label: "Efficiency", data: r.efficiency },
    { label: "Capitalization", data: r.capitalization },
    { label: "Liquidity", data: r.liquidity },
  ].filter((c) => c.data && Object.keys(c.data).length > 0);

  if (categories.length === 0) return null;

  const section = ui_createElement("div", {
    styleString:
      SECTION_CARD + " display: flex; flex-direction: column; gap: 8px;",
  });
  section.appendChild(sectionTitle("Financial Ratios"));

  for (const cat of categories) {
    section.appendChild(subLabel(cat.label));
    const grid = ui_createElement("div", {
      styleString: GRID_4,
    });
    for (const [k, v] of Object.entries(cat.data!).slice(0, 12)) {
      grid.appendChild(kvCell(k, String(v)));
    }
    section.appendChild(grid);
  }

  return section;
}

function buildKeyData(b: BarronsDataBundle): HTMLElement | null {
  const kd = b.keyData;
  if (!kd || Object.keys(kd).length === 0) return null;

  const section = ui_createElement("div", {
    styleString:
      SECTION_CARD + " display: flex; flex-direction: column; gap: 6px;",
  });
  section.appendChild(sectionTitle("Key Data"));

  const grid = ui_createElement("div", {
    styleString: GRID_4,
  });
  for (const [k, v] of Object.entries(kd).slice(0, 16)) {
    grid.appendChild(kvCell(k, String(v)));
  }
  section.appendChild(grid);

  return section;
}

function buildAnalystConsensus(b: BarronsDataBundle): HTMLElement | null {
  const snap = b.analystSnapshot;
  const pt = b.priceTarget;
  if (!snap && !pt) return null;

  const section = ui_createElement("div", {
    styleString:
      SECTION_CARD + " display: flex; flex-direction: column; gap: 6px;",
  });
  section.appendChild(sectionTitle("Analyst Consensus"));

  const items: Array<[string, string]> = [];
  if (snap?.avgRecommendation) items.push(["Rec", snap.avgRecommendation]);
  if (snap?.meanRating) items.push(["Rating", snap.meanRating]);
  if (snap?.numRatings) items.push(["# Ratings", snap.numRatings]);
  if (snap?.meanTargetPrice) items.push(["Avg Target", snap.meanTargetPrice]);
  if (pt?.high) items.push(["Target High", pt.high]);
  if (pt?.low) items.push(["Target Low", pt.low]);
  if (snap?.currentQtrEst) items.push(["Cur Qtr Est", snap.currentQtrEst]);
  if (snap?.currentYearEst) items.push(["Cur Yr Est", snap.currentYearEst]);

  const grid = ui_createElement("div", {
    styleString: GRID_4,
  });
  for (const [lbl, val] of items) grid.appendChild(kvCell(lbl, val));
  section.appendChild(grid);

  return section;
}

function buildPeersTable(b: BarronsDataBundle): HTMLElement | null {
  const peers = b.peers;
  if (!peers || peers.length === 0) return null;

  const section = ui_createElement("div", {
    styleString:
      SECTION_CARD + " display: flex; flex-direction: column; gap: 6px;",
  });
  section.appendChild(sectionTitle("Peers"));

  // Table-style header row
  section.appendChild(
    ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 8px; padding: 4px 10px;",
      children: [
        ui_createElement("span", {
          text: "Symbol",
          styleString:
            DS_TYPOGRAPHY.metricLabelMini + " width: 64px; flex-shrink: 0;",
        }),
        ui_createElement("span", {
          text: "Name",
          styleString: DS_TYPOGRAPHY.metricLabelMini + " flex: 1;",
        }),
        ui_createElement("span", {
          text: "Price",
          styleString:
            DS_TYPOGRAPHY.metricLabelMini +
            " width: 60px; text-align: right; flex-shrink: 0;",
        }),
        ui_createElement("span", {
          text: "Change",
          styleString:
            DS_TYPOGRAPHY.metricLabelMini +
            " width: 56px; text-align: right; flex-shrink: 0;",
        }),
        ui_createElement("span", {
          text: "Mkt Cap",
          styleString:
            DS_TYPOGRAPHY.metricLabelMini +
            " width: 68px; text-align: right; flex-shrink: 0;",
        }),
      ],
    }),
  );

  const list = ui_createElement("div", {
    styleString: "display: flex; flex-direction: column; gap: 2px;",
  });

  for (const p of peers.slice(0, 10)) {
    const chgColor =
      p.changePct && p.changePct.startsWith("-")
        ? DS_COLORS.negative
        : DS_COLORS.positive;
    list.appendChild(
      ui_createElement("div", {
        styleString:
          "display: flex; align-items: center; gap: 8px; padding: 5px 10px;" +
          ` background: ${DS_COLORS.bgSubtle}; border-radius: ${DS_RADIUS.sm};` +
          " transition: background 0.15s;",
        children: [
          ui_createElement("span", {
            text: p.symbol ?? "—",
            styleString:
              `font-size: 11px; font-weight: 700; color: ${DS_COLORS.info};` +
              " width: 64px; flex-shrink: 0;",
          }),
          ui_createElement("span", {
            text: p.name ?? "",
            styleString:
              "font-size: 11px; color: var(--ios-text-primary);" +
              " flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
          }),
          ui_createElement("span", {
            text: p.price ?? "—",
            styleString:
              `font-size: 11px; font-weight: 600; color: var(--ios-text-primary);` +
              ` width: 60px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums;`,
          }),
          ui_createElement("span", {
            text: p.changePct ?? "—",
            styleString:
              `font-size: 10px; font-weight: 600; color: ${chgColor};` +
              ` width: 56px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums;`,
          }),
          ui_createElement("span", {
            text: p.marketCap ?? "—",
            styleString:
              `font-size: 10px; color: var(--ios-text-secondary);` +
              ` width: 68px; text-align: right; flex-shrink: 0;`,
          }),
        ],
      }),
    );
  }
  section.appendChild(list);
  return section;
}

export function renderPanelContent(b: BarronsDataBundle): HTMLElement {
  const content = ui_createElement("div", {
    styleString: `display: flex; flex-direction: column; gap: ${DS_SPACING.xl};`,
  });

  content.appendChild(buildCompanyProfile(b));

  const people = buildPeople(b);
  if (people) content.appendChild(people);

  const ratios = buildRatiosGrid(b);
  if (ratios) content.appendChild(ratios);

  const keyData = buildKeyData(b);
  if (keyData) content.appendChild(keyData);

  const analyst = buildAnalystConsensus(b);
  if (analyst) content.appendChild(analyst);

  const peers = buildPeersTable(b);
  if (peers) content.appendChild(peers);

  return content;
}
