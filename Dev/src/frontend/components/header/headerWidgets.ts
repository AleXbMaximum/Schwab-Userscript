import { ui_createElement } from "../core/createElement";
import { ds_signColorRaw } from "../core/theme";
import {
  formatPct,
  formatCurrencyLocale as fmtCurrencyLocale,
  formatSignedCurrencyLocale,
} from "shared/utils/formatters";
import type { AccountOverviewMetrics } from "backend/computation/holdings/accountOverviewMetrics";
import {
  drawIntradaySparkline,
  createHiDpiSparklineCanvas,
} from "../../trade_holdings/holding_table/sparkline/SparklineRenderer";
import type { IntradaySparklineData } from "../../trade_holdings/holding_table/sparkline/IntradaySparklineStore";
import { SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";

export function renderTotals(
  overview: AccountOverviewMetrics,
  masked = false,
): HTMLElement {
  const container = ui_createElement("div", {
    styleString:
      "display:flex; gap:20px; align-items:center;" +
      ' font-family:var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);',
  });

  const createPair = (
    topLabel: string,
    topValue: string,
    topColor: string,
    btmLabel: string,
    btmValue: string,
    btmColor: string,
    labelWidth = 45,
  ) => {
    const col = ui_createElement("div", {
      styleString:
        "display:flex; flex-direction:column; align-items:flex-start;",
    });
    const mkLine = (label: string, value: string, color: string) => {
      const row = ui_createElement("div", {
        styleString:
          "display:flex; gap:5px; font-size:14px; white-space:nowrap;",
      });
      row.appendChild(
        ui_createElement("span", {
          text: label,
          styleString: `color:var(--ios-text-primary); display:inline-block; min-width:${labelWidth}px;`,
        }),
      );
      row.appendChild(
        ui_createElement("span", {
          text: value,
          styleString: `color:${color};`,
        }),
      );
      return row;
    };
    col.appendChild(mkLine(topLabel, topValue, topColor));
    col.appendChild(mkLine(btmLabel, btmValue, btmColor));
    return col;
  };

  const M = SHARE_MASKED_TEXT;

  if (masked) {
    container.appendChild(
      createPair("Day:", M, "var(--ios-text-primary)", "Total:", M, "var(--ios-text-primary)", 45),
    );
    const accValPair = createPair("Acc Val:", M, "var(--ios-text-primary)", "Cash:", M, "var(--ios-text-primary)", 55);
    accValPair.classList.add("dock-totals-accval");
    container.appendChild(accValPair);
  } else {
    const dayColor = ds_signColorRaw(overview.dayChangeDollar);
    const totalColor = ds_signColorRaw(overview.gainLossDollar);
    const cashColor =
      overview.cashInvestments >= 0
        ? "var(--ios-text-primary)"
        : "var(--ios-red)";

    container.appendChild(
      createPair(
        "Day:",
        `${formatSignedCurrencyLocale(overview.dayChangeDollar, { decimals: 0 })} (${formatPct(overview.dayChangePercent, { decimals: 2 })})`,
        dayColor,
        "Total:",
        `${formatSignedCurrencyLocale(overview.gainLossDollar, { decimals: 0 })} (${formatPct(overview.gainLossPercent, { decimals: 2 })})`,
        totalColor,
        45,
      ),
    );
    const accValPair = createPair(
      "Acc Val:",
      fmtCurrencyLocale(overview.accountValue, 0),
      "var(--ios-text-primary)",
      "Cash:",
      fmtCurrencyLocale(overview.cashInvestments, 0),
      cashColor,
      55,
    );
    accValPair.classList.add("dock-totals-accval");
    container.appendChild(accValPair);
  }

  return container;
}

export type IndexSparklineGetter = (
  symbol: string,
) => { data: IntradaySparklineData; changePct: number } | null;

export function renderIndices(
  quotes: any[],
  getSparkline?: IndexSparklineGetter,
): HTMLElement {
  const SCHWAB_STOCK_BASE_URL =
    "https://client.schwab.com/app/research/#/stocks/chart/";
  const container = ui_createElement("div", {
    styleString:
      "display:flex; gap:12px; align-items:center;" +
      ' font-family:var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);',
  });

  quotes.forEach((item) => {
    const symbol = item?.reference?.symbol ?? "";
    const price = item.quote.lastPrice;
    const change = item.quote.netChange;
    const percent = item.quote.netChangePercent;
    const color = ds_signColorRaw(change);

    const itemDiv = ui_createElement("div", {
      styleString:
        "display:flex; flex-direction:column; align-items:flex-start; line-height:1.4;",
    });
    itemDiv.dataset.indexSymbol = symbol;

    const line1 = ui_createElement("div", {
      styleString: "display:flex; gap:4px; font-size:14px; align-items:center;",
    });

    const symbolEl = (() => {
      const a = ui_createElement("a", {
        text: symbol,
        styleString:
          "color:var(--ios-blue); text-decoration:none; cursor:pointer;",
      }) as HTMLAnchorElement;
      if (symbol) {
        a.href = `${SCHWAB_STOCK_BASE_URL}${encodeURIComponent(String(symbol))}`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = `Open Schwab stock page for ${symbol}`;
      } else {
        a.href = "#";
        a.style.pointerEvents = "none";
      }
      return a;
    })();

    line1.appendChild(symbolEl);
    line1.appendChild(
      ui_createElement("span", {
        text: price.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        styleString: "color:var(--ios-text-primary);",
      }),
    );

    // Sparkline canvas (right of price)
    if (getSparkline && symbol) {
      const info = getSparkline(symbol);
      if (info && info.data.prices.length >= 2) {
        const canvas = createHiDpiSparklineCanvas();
        drawIntradaySparkline(canvas, info.data.prices, info.changePct, info.data.previousClose);
        canvas.style.marginLeft = "4px";
        line1.appendChild(canvas);
      }
    }

    const line2 = ui_createElement("div", {
      text: `${change > 0 ? "+" : ""}${change.toFixed(2)} (${formatPct(percent, { decimals: 2 })})`,
      styleString: `color:${color}; font-size:13px; white-space:nowrap;`,
    });

    itemDiv.appendChild(line1);
    itemDiv.appendChild(line2);
    itemDiv.classList.add("flash-update");
    container.appendChild(itemDiv);
  });

  return container;
}
