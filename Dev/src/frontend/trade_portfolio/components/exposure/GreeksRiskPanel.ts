import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, DS_COLORS } from "../../../components/core/theme";
import type { RiskMetrics } from "../../../../backend/computation/risk/RiskMetricsCalculator";
import type{ DerivedState } from "../../../../shared/types/derived";
import { logService } from "../../../../shared/log/core/LogService";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";
import { formatCurrencyLocale as fmtCurrencyLocale } from "shared/utils/formatters";

const log = logService.namespace("render");

function fmtGreekDol(v: number | null | undefined, decimals = 0): string {
  if (isShareMasked()) return SHARE_MASKED_TEXT;
  return fmtCurrencyLocale(Number(shareScaleValue(v) ?? 0), decimals);
}

const panelTitleStyle = DS_TYPOGRAPHY.panelTitle + " margin-bottom: 14px;";
const thStyle = DS_COMPONENTS.tableHeader;
const tdStyle = DS_COMPONENTS.tableCell;
const tableStyle = DS_COMPONENTS.table;

export function renderGreeksRiskPanel(
  riskMetrics: RiskMetrics,
  derived: DerivedState,
): HTMLElement {
  const container = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (metrics: RiskMetrics, derived: DerivedState) => void;
  };

  container.appendChild(
    ui_createElement("h3", {
      text: "Greeks Risk Dashboard",
      styleString: panelTitleStyle,
    }),
  );

  const statsContainer = ui_createElement("div", {
    styleString:
      "display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;",
  });

  const createStatItem = (
    label: string,
    value: string,
    color: string = "var(--ios-text-primary)",
  ) => {
    const item = ui_createElement("div", {
      styleString:
        "display: flex; flex-direction: column; padding: 10px 14px; border-radius: 12px;" +
        " background: rgba(255,255,255,0.5); border: 1px solid var(--ios-border);" +
        " min-width: 100px; flex: 1;",
    });
    item.appendChild(
      ui_createElement("span", {
        text: label,
        styleString:
          "font-size: 11px; font-weight: 500; color: var(--ios-text-secondary); margin-bottom: 3px;",
      }),
    );
    item.appendChild(
      ui_createElement("span", {
        text: value,
        styleString: `font-size: 15px; font-weight: 700; color: ${color}; font-variant-numeric: tabular-nums;`,
      }),
    );
    return item;
  };

  const pnlColor = (v: number) =>
    v >= 0 ? DS_COLORS.positive : DS_COLORS.negative;

  statsContainer.appendChild(
    createStatItem(
      "Net Delta",
      fmtGreekDol(riskMetrics.netDeltaDollars),
      pnlColor(riskMetrics.netDeltaDollars),
    ),
  );
  statsContainer.appendChild(
    createStatItem(
      "Gamma Exposure (1%)",
      fmtGreekDol(riskMetrics.totalGammaDollarExposure),
    ),
  );
  statsContainer.appendChild(
    createStatItem(
      "Daily Theta",
      fmtGreekDol(riskMetrics.dailyThetaDecay, 2),
      pnlColor(riskMetrics.dailyThetaDecay),
    ),
  );
  statsContainer.appendChild(
    createStatItem(
      "Total Vega",
      fmtGreekDol(riskMetrics.totalAbsVega, 2),
    ),
  );
  statsContainer.appendChild(
    createStatItem("Total Rho", fmtGreekDol(riskMetrics.totalRho, 2)),
  );
  container.appendChild(statsContainer);

  const byUnderlying = derived?.byUnderlying || {};
  const underlyings = Object.entries(byUnderlying)
    .map(([key, underlying]) => {
      const price = underlying.underlyingPrice ?? 0;
      const gamma = underlying.totalGammaSharesPerDol ?? 0;
      const gammaDollarExposure =
        price > 0 ? Math.abs(gamma) * price * price * 0.01 : 0;
      return {
        key,
        delta: underlying.deltaNotionalDol ?? 0,
        gamma: gammaDollarExposure,
        theta: underlying.totalThetaPerDay ?? 0,
        vega: underlying.totalVegaPerVolPoint ?? 0,
      };
    })
    .filter((u) => Math.abs(u.delta) > 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10);

  if (underlyings.length > 0) {
    const table = ui_createElement("table", {
      styleString: tableStyle,
    }) as HTMLTableElement;

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Underlying", "Delta", "Gamma (1%)", "Theta", "Vega"].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      th.style.cssText = thStyle;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    underlyings.forEach((u, idx) => {
      const row = document.createElement("tr");
      row.style.cssText = idx % 2 === 1 ? "background: rgba(0,0,0,0.02);" : "";

      const cells = [
        { text: u.key, color: "var(--ios-text-primary)", weight: "600" },
        {
          text: fmtGreekDol(u.delta),
          color: u.delta >= 0 ? DS_COLORS.positive : DS_COLORS.negative,
          weight: "500",
        },
        {
          text: fmtGreekDol(u.gamma),
          color: "var(--ios-text-primary)",
          weight: "500",
        },
        {
          text: fmtGreekDol(u.theta),
          color: u.theta >= 0 ? DS_COLORS.positive : DS_COLORS.negative,
          weight: "500",
        },
        {
          text: fmtGreekDol(u.vega),
          color: "var(--ios-text-primary)",
          weight: "500",
        },
      ];

      cells.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell.text;
        td.style.cssText =
          tdStyle +
          ` color: ${cell.color}; font-weight: ${cell.weight}; font-variant-numeric: tabular-nums;`;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  } else {
    container.appendChild(
      ui_createElement("div", {
        text: "No Greeks data available",
        styleString:
          "padding: 16px; color: var(--ios-text-secondary); font-size: 13px; text-align: center;",
      }),
    );
  }

  container.update = (metrics: RiskMetrics, derivedData: DerivedState) => {
    const statItems = statsContainer.querySelectorAll("div > span:last-child");
    if (statItems.length >= 5) {
      statItems[0].textContent = fmtGreekDol(metrics.netDeltaDollars);
      (statItems[0] as HTMLElement).style.color = pnlColor(
        metrics.netDeltaDollars,
      );
      statItems[1].textContent = fmtGreekDol(
        metrics.totalGammaDollarExposure,
      );
      statItems[2].textContent = fmtGreekDol(metrics.dailyThetaDecay, 2);
      (statItems[2] as HTMLElement).style.color = pnlColor(
        metrics.dailyThetaDecay,
      );
      statItems[3].textContent = fmtGreekDol(metrics.totalAbsVega, 2);
      statItems[4].textContent = fmtGreekDol(metrics.totalRho, 2);
    }

    const byUnderlying = derivedData?.byUnderlying || {};
    const updatedUnderlyings = Object.entries(byUnderlying)
      .map(([key, underlying]) => {
        const price = underlying.underlyingPrice ?? 0;
        const gamma = underlying.totalGammaSharesPerDol ?? 0;
        const gammaDollarExposure =
          price > 0 ? Math.abs(gamma) * price * price * 0.01 : 0;
        return {
          key,
          delta: underlying.deltaNotionalDol ?? 0,
          gamma: gammaDollarExposure,
          theta: underlying.totalThetaPerDay ?? 0,
          vega: underlying.totalVegaPerVolPoint ?? 0,
        };
      })
      .filter((u) => Math.abs(u.delta) > 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 10);

    if (updatedUnderlyings.length > 0) {
      const tbody = container.querySelector("tbody");
      if (tbody) {
        tbody.innerHTML = "";
        updatedUnderlyings.forEach((u, idx) => {
          const row = document.createElement("tr");
          row.style.cssText =
            idx % 2 === 1 ? "background: rgba(0,0,0,0.02);" : "";
          const cells = [
            { text: u.key, color: "var(--ios-text-primary)", weight: "600" },
            {
              text: fmtGreekDol(u.delta),
              color: u.delta >= 0 ? DS_COLORS.positive : DS_COLORS.negative,
              weight: "500",
            },
            {
              text: fmtGreekDol(u.gamma),
              color: "var(--ios-text-primary)",
              weight: "500",
            },
            {
              text: fmtGreekDol(u.theta),
              color: u.theta >= 0 ? DS_COLORS.positive : DS_COLORS.negative,
              weight: "500",
            },
            {
              text: fmtGreekDol(u.vega),
              color: "var(--ios-text-primary)",
              weight: "500",
            },
          ];
          cells.forEach((cell) => {
            const td = document.createElement("td");
            td.textContent = cell.text;
            td.style.cssText =
              tdStyle +
              ` color: ${cell.color}; font-weight: ${cell.weight}; font-variant-numeric: tabular-nums;`;
            row.appendChild(td);
          });
          tbody.appendChild(row);
        });
      }
    }
  };

  container.cleanup = () => {
    log.debug("greeks.cleanup.done");
  };
  return container;
}
