import { ui_createElement } from "../../components/core/createElement";
import {
  DS_COLORS,
  DS_RADIUS,
  DS_COMPONENTS,
} from "../../components/core/theme";
import { formatPct } from "shared/utils/formatters";
import { formatCurrency, formatQty } from "../formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";
import {
  createHiDpiSparklineCanvas,
  drawIntradaySparkline,
} from "./sparkline/SparklineRenderer";
import type { IntradaySparklineStore } from "./sparkline/IntradaySparklineStore";
import type{ HierarchicalHoldings, HoldingsBlock, TickerBlock } from "../../../shared/types/derived";

/** Display-level aliases for verbose Schwab labels. */
const DISPLAY_SYMBOL_ALIASES: Record<string, string> = {
  "Futures Positions Market Value": "FMktV",
  "Futures Cash": "FCash",
};

// ── Types ───────────────────────────────────────────────────────────────────

export type MobileCardUpdateContext = {
  hierarchy: HierarchicalHoldings | null;
};

export type MobileCardController = {
  container: HTMLElement;
  update: (ctx: MobileCardUpdateContext) => void;
  destroy: () => void;
};

// ── Factory ─────────────────────────────────────────────────────────────────

export function createMobileCardView(opts: {
  sparklineStore: IntradaySparklineStore;
}): MobileCardController {
  const { sparklineStore } = opts;

  const container = ui_createElement("div", {
    className: "holdings-mobile-cards",
    styleString:
      "display: flex; flex-direction: column; gap: 8px;" +
      " flex: 1 1 auto; min-height: 0; overflow-y: auto;" +
      " -webkit-overflow-scrolling: touch; padding-bottom: 8px;",
  });

  // Track sparkline canvases for update
  const canvasMap = new Map<
    string,
    { canvas: HTMLCanvasElement; changePct: number }
  >();
  let sparklineUnsub: (() => void) | null = null;

  function onSparklineUpdate(symbol: string) {
    const entry = canvasMap.get(symbol);
    if (!entry) return;
    const data = sparklineStore.get(symbol);
    if (data?.prices?.length) {
      drawIntradaySparkline(entry.canvas, data.prices, entry.changePct, data.previousClose);
    }
  }

  function renderCards(hierarchy: HierarchicalHoldings | null) {
    container.innerHTML = "";
    canvasMap.clear();
    if (sparklineUnsub) {
      sparklineUnsub();
      sparklineUnsub = null;
    }
    if (!hierarchy) return;

    const symbols: string[] = [];

    for (const ac of hierarchy.assetClasses) {
      // Asset class header
      if (ac.groupName) {
        const groupHeader = ui_createElement("div", {
          text: ac.groupName,
          styleString:
            "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary, #8e8e93);" +
            ` text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 4px 2px;`,
        });
        container.appendChild(groupHeader);
      }

      for (const ticker of ac.tickers) {
        const card = renderTickerCard(ticker, symbols);
        container.appendChild(card);
      }
    }

    // Grand total card
    if (hierarchy.grandTotal) {
      const totalCard = renderTotalCard(hierarchy.grandTotal);
      container.appendChild(totalCard);
    }

    // Request sparkline data
    if (symbols.length) {
      sparklineStore.requestSymbols(symbols);
      sparklineUnsub = sparklineStore.onUpdate(onSparklineUpdate);

      // Draw any already-cached sparklines
      for (const sym of symbols) {
        const data = sparklineStore.get(sym);
        if (data?.prices?.length) onSparklineUpdate(sym);
      }
    }
  }

  function renderTickerCard(
    ticker: TickerBlock,
    symbols: string[],
  ): HTMLElement {
    const sym = DISPLAY_SYMBOL_ALIASES[ticker.underlyingKey] ?? ticker.underlyingKey;
    const agg = ticker.aggregated;
    const price = ticker.underlyingPrice;
    const dayChg = agg.totalDayChangeDollar ?? 0;
    const dayPct = agg.dayChangePercent ?? 0;
    const mktVal = agg.totalMarketValue ?? 0;
    const isPositive = dayChg >= 0;
    const changeColor = isPositive ? DS_COLORS.positive : DS_COLORS.negative;

    symbols.push(sym);

    // ── Card wrapper ──
    const card = ui_createElement("div", {
      styleString:
        DS_COMPONENTS.card +
        ` padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; cursor: pointer;`,
    });

    // ── Top row: symbol + sparkline + price ──
    const topRow = ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 8px;",
    });

    // Symbol + badges
    const symWrap = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;",
    });
    const symLabel = ui_createElement("span", {
      text: sym,
      styleString:
        "font-size: 15px; font-weight: 600; color: var(--ios-text-primary);",
    });
    symWrap.appendChild(symLabel);

    // Asset badges
    const badges = ticker.assetBadges;
    const badgeParts: string[] = [];
    if (badges.hasEquity) badgeParts.push("E");
    if (badges.buyPut > 0) badgeParts.push("P");
    if (badges.sellPut > 0) badgeParts.push("P\u0336");
    if (badges.buyCall > 0) badgeParts.push("C");
    if (badges.sellCall > 0) badgeParts.push("C\u0336");
    if (badgeParts.length) {
      const badgeEl = ui_createElement("span", {
        text: badgeParts.join(" "),
        styleString:
          "font-size: var(--ax-fs-xs); color: var(--ax-fg-2); font-weight: var(--ax-fw-medium);" +
          ` background: var(--ax-bg-glass-inset); padding: 1px 5px; border-radius: ${DS_RADIUS.sm};`,
      });
      symWrap.appendChild(badgeEl);
    }
    topRow.appendChild(symWrap);

    // Sparkline canvas
    const canvas = createHiDpiSparklineCanvas();
    canvas.style.cssText += " flex-shrink: 0;";
    canvasMap.set(sym, { canvas, changePct: dayPct });
    topRow.appendChild(canvas);

    // Price
    const priceLabel = ui_createElement("span", {
      text:
        price != null
          ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "-",
      styleString:
        "font-size: 15px; font-weight: 500; color: var(--ios-text-primary); text-align: right; min-width: 70px;",
    });
    topRow.appendChild(priceLabel);

    card.appendChild(topRow);

    // ── Bottom row: market value, day change, % ──
    const bottomRow = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 6px; font-size: 12px;",
    });

    const _masked = isShareMasked();
    const mvLabel = ui_createElement("span", {
      text: _masked ? SHARE_MASKED_TEXT : formatCurrency(shareScaleValue(mktVal)),
      styleString: "color: var(--ios-text-secondary); flex: 1;",
    });
    bottomRow.appendChild(mvLabel);

    const dayChgLabel = ui_createElement("span", {
      text: _masked ? SHARE_MASKED_TEXT : formatCurrency(shareScaleValue(dayChg), { showSign: true }),
      styleString: `color: ${changeColor}; font-weight: 500;`,
    });
    bottomRow.appendChild(dayChgLabel);

    const dayPctLabel = ui_createElement("span", {
      text: formatPct(dayPct, { showSign: true }),
      styleString:
        `color: ${changeColor}; font-weight: 500;` +
        ` background: ${isPositive ? "rgba(52,199,89,0.1)" : "rgba(215,49,38,0.1)"};` +
        ` padding: 1px 6px; border-radius: ${DS_RADIUS.sm};`,
    });
    bottomRow.appendChild(dayPctLabel);

    card.appendChild(bottomRow);

    // ── Expandable child positions ──
    if (ticker.holdings.length > 0) {
      const childContainer = ui_createElement("div", {
        styleString:
          "display: none; flex-direction: column; gap: 4px; padding-top: 6px; border-top: 1px solid var(--ax-border-subtle);",
      });

      for (const pos of ticker.holdings) {
        childContainer.appendChild(renderChildPosition(pos));
      }

      card.appendChild(childContainer);

      card.addEventListener("click", () => {
        const isOpen = childContainer.style.display !== "none";
        childContainer.style.display = isOpen ? "none" : "flex";
      });
    }

    return card;
  }

  function renderChildPosition(pos: HoldingsBlock): HTMLElement {
    const row = pos.row as any;
    const sym = row?.symbol?.symbol || row?.dataSymbol || "";
    const qty = row?.qty?.qty ?? row?.qty?.val ?? row?.qty;
    const mktVal = row?.marketValue?.val;
    const price = row?.lastPrice?.val ?? row?.price?.val;

    const posRow = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 6px; font-size: 11px;" +
        ` padding: 4px 0; color: var(--ios-text-secondary);`,
    });

    const label =
      pos.kind === "OPTION" && pos.optionMeta
        ? `${pos.optionMeta.callPut === "C" ? "Call" : "Put"} ${pos.optionMeta.strike} (${pos.optionMeta.dte}d)`
        : sym;

    const nameEl = ui_createElement("span", {
      text: label,
      styleString:
        "flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
    });
    posRow.appendChild(nameEl);

    const qtyEl = ui_createElement("span", {
      text: formatQty(qty),
      styleString: "min-width: 40px; text-align: right;",
    });
    posRow.appendChild(qtyEl);

    const priceEl = ui_createElement("span", {
      text: price != null ? `$${Number(price).toFixed(2)}` : "-",
      styleString: "min-width: 55px; text-align: right;",
    });
    posRow.appendChild(priceEl);

    const valEl = ui_createElement("span", {
      text: isShareMasked() ? SHARE_MASKED_TEXT : formatCurrency(shareScaleValue(mktVal)),
      styleString: "min-width: 60px; text-align: right;",
    });
    posRow.appendChild(valEl);

    return posRow;
  }

  function renderTotalCard(grandTotal: any): HTMLElement {
    const card = ui_createElement("div", {
      styleString:
        DS_COMPONENTS.card +
        ` padding: 12px 14px; display: flex; align-items: center; gap: 8px;` +
        " font-weight: 600;",
    });

    const label = ui_createElement("span", {
      text: "Total Account",
      styleString: "flex: 1; font-size: 12px; color: var(--ios-text-primary);",
    });
    card.appendChild(label);

    const totalMv = grandTotal.totalMarketValue ?? grandTotal.mktVal;
    const valEl = ui_createElement("span", {
      text: isShareMasked() ? SHARE_MASKED_TEXT : formatCurrency(shareScaleValue(totalMv)),
      styleString: "font-size: 12px; color: var(--ios-text-primary);",
    });
    card.appendChild(valEl);

    return card;
  }

  return {
    container,
    update(ctx: MobileCardUpdateContext) {
      renderCards(ctx.hierarchy);
    },
    destroy() {
      if (sparklineUnsub) sparklineUnsub();
      canvasMap.clear();
      container.innerHTML = "";
    },
  };
}
