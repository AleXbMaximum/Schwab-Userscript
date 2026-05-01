import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, ds_signColorRaw } from "../../../components/core/theme";
import type { BetaFactorPositionPnl } from "../../../../backend/computation/risk/RiskMetricsCalculator";
import { formatCurrencyLocale as fmtCurrencyLocale } from "shared/utils/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";

const fmtPnl = (v: number): string =>
  isShareMasked() ? SHARE_MASKED_TEXT : fmtCurrencyLocale(shareScaleValue(v) as number, 0);

export function createPositionDrillDown(
  positions: BetaFactorPositionPnl[],
): HTMLElement {
  const table = document.createElement("table");
  table.style.cssText = DS_COMPONENTS.table;

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = [
    "Ticker",
    "Model",
    "β_Mkt",
    "β_NDX",
    "β_DJI",
    "R²",
    "Δ P&L",
    "Γ P&L",
    "V P&L",
    "Θ P&L",
    "Total",
  ];
  for (const h of headers) {
    const th = document.createElement("th");
    th.style.cssText =
      DS_COMPONENTS.tableHeader +
      (h !== "Ticker" && h !== "Model" ? " text-align: right;" : "");
    th.textContent = h;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  for (const pos of positions) {
    if (pos.modelUsed === "none" && pos.totalPnl === 0) continue;
    const tr = document.createElement("tr");
    tr.style.cssText = "border-bottom: 1px solid var(--ax-border-subtle);";

    const cells = [
      { text: pos.underlyingKey, align: "left" },
      {
        text:
          pos.modelUsed === "threeFactor"
            ? "3F"
            : pos.modelUsed === "anchor"
              ? "Anc"
              : "—",
        align: "left",
      },
      { text: pos.betaMkt.toFixed(2), align: "right" },
      {
        text: pos.modelUsed === "threeFactor" ? pos.betaNdxRel.toFixed(2) : "—",
        align: "right",
      },
      {
        text: pos.modelUsed === "threeFactor" ? pos.betaDjiRel.toFixed(2) : "—",
        align: "right",
      },
      {
        text: pos.rSquared > 0 ? `${(pos.rSquared * 100).toFixed(0)}%` : "—",
        align: "right",
      },
      {
        text: fmtPnl(pos.deltaPnl),
        align: "right",
        color: ds_signColorRaw(pos.deltaPnl),
      },
      {
        text: fmtPnl(pos.gammaPnl),
        align: "right",
        color: ds_signColorRaw(pos.gammaPnl),
      },
      {
        text: fmtPnl(pos.vegaPnl),
        align: "right",
        color: ds_signColorRaw(pos.vegaPnl),
      },
      {
        text: fmtPnl(pos.thetaPnl),
        align: "right",
        color: ds_signColorRaw(pos.thetaPnl),
      },
      {
        text: fmtPnl(pos.totalPnl),
        align: "right",
        color: ds_signColorRaw(pos.totalPnl),
      },
    ];

    for (const cell of cells) {
      const td = document.createElement("td");
      td.style.cssText =
        DS_COMPONENTS.tableCell + ` text-align: ${cell.align};`;
      if ((cell as any).color) td.style.color = (cell as any).color;
      td.textContent = cell.text;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const scrollWrap = ui_createElement("div", {
    styleString: "overflow-x: auto; margin-top: 4px;",
  });
  scrollWrap.appendChild(table);
  return scrollWrap;
}
