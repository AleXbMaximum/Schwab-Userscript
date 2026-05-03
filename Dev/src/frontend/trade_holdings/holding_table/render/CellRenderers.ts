import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import {
  SIGN_COLOR_COLUMNS,
  INVERT_FOR_SHORT_COLUMNS,
  INVERT_FOR_SHORT_SUMMARY_COLUMNS,
} from "../table/columnMetadata";
import { DS_COLORS } from "../../../components/core/styles/theme";
import { createHiDpiSparklineCanvas } from "../sparkline/SparklineRenderer";
import type { AssetBadges } from "../types";

const SCHWAB_STOCK_BASE_URL =
  "https://client.schwab.com/app/research/#/stocks/chart/";
const SCHWAB_OPTIONS_CHAIN_BASE_URL =
  "https://client.schwab.com/app/trade/chains/#/chains/symbol/";

export interface SymbolRenderOptions {
  displayText: string;
  linkSymbol: string | null;
  linkKind: "stock" | "options";
  isChild: boolean;
  assetBadges?: AssetBadges | null;
  /** When true, insert a sparkline canvas placeholder (for summary rows). */
  showSparkline?: boolean;
}

export interface NumericRenderOptions {
  value: string;
  columnId: HoldingsTableColumnId;
  isShort: boolean;
  isSummary?: boolean;
}

export interface GroupRenderOptions {
  name: string;
  totals: any | null;
}

export function normalizeLinkSymbol(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;

  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  const cleaned = firstToken.replace(/[^$A-Za-z0-9.]/g, "");
  return cleaned || null;
}

export function renderSymbolCell(
  td: HTMLTableCellElement,
  options: SymbolRenderOptions,
): void {
  const {
    displayText,
    linkSymbol,
    linkKind,
    isChild,
    assetBadges,
    showSparkline,
  } = options;

  td.innerHTML = "";

  td.className = isChild
    ? "table-cell-symbol table-cell-symbol--child"
    : "table-cell-symbol";

  const symbolNode = document.createElement(linkSymbol ? "a" : "span");
  symbolNode.textContent = displayText;
  symbolNode.classList.add("table-symbol-label");
  if (showSparkline) {
    symbolNode.classList.add("table-symbol-label--summary");
  }

  if (linkSymbol) {
    const anchor = symbolNode as HTMLAnchorElement;
    anchor.href =
      linkKind === "options"
        ? `${SCHWAB_OPTIONS_CHAIN_BASE_URL}${encodeURIComponent(linkSymbol)}`
        : `${SCHWAB_STOCK_BASE_URL}${encodeURIComponent(linkSymbol)}`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.classList.add("table-symbol-link");
    anchor.title =
      linkKind === "options"
        ? `Open Schwab options chain for ${linkSymbol}`
        : `Open Schwab stock page for ${linkSymbol}`;
    anchor.addEventListener("click", (e) => e.stopPropagation());
  }

  const inline = document.createElement("span");
  inline.className = "table-symbol-inline";
  inline.appendChild(symbolNode);

  // Insert sparkline canvas placeholder for summary rows.
  // Render order: ticker -> sparkline -> badges.
  if (showSparkline && linkSymbol) {
    td.classList.add("table-cell-symbol--has-sparkline");
    const wrap = document.createElement("span");
    wrap.className = "table-sparkline-wrap";
    const canvas = createHiDpiSparklineCanvas();
    canvas.setAttribute("data-sparkline", linkSymbol);
    wrap.appendChild(canvas);
    inline.appendChild(wrap);
  }

  if (assetBadges && hasAnyBadge(assetBadges)) {
    const badgeWrap = createBadgeWrap(assetBadges);
    inline.appendChild(badgeWrap);
  }

  td.appendChild(inline);
}

function hasAnyBadge(badges: AssetBadges): boolean {
  return (
    badges.hasEquity ||
    badges.buyPut > 0 ||
    badges.sellPut > 0 ||
    badges.buyCall > 0 ||
    badges.sellCall > 0
  );
}

function createBadgeWrap(badges: AssetBadges): HTMLSpanElement {
  const wrap = document.createElement("span");
  wrap.className = "table-asset-badges";

  const addGroup = (letter: string, buyCount: number, sellCount: number) => {
    if (letter === "E" && !badges.hasEquity) return;
    if (letter !== "E" && buyCount === 0 && sellCount === 0) return;

    const g = document.createElement("span");
    g.className = "table-badge-group";

    const l = document.createElement("span");
    l.textContent = letter;
    l.className = "table-badge-letter";
    g.appendChild(l);

    if (buyCount > 0) {
      const s = document.createElement("span");
      s.textContent = String(buyCount);
      s.className = "table-badge-count table-badge-count--positive";
      g.appendChild(s);
    }
    if (sellCount > 0) {
      const s = document.createElement("span");
      s.textContent = String(sellCount);
      s.className = "table-badge-count table-badge-count--negative";
      g.appendChild(s);
    }

    wrap.appendChild(g);
  };

  if (badges.hasEquity) addGroup("E", 0, 0);
  addGroup("P", badges.buyPut, badges.sellPut);
  addGroup("C", badges.buyCall, badges.sellCall);

  return wrap;
}

/**
 * Fast sign detection for formatted numeric strings.
 * Returns 1 for positive, -1 for negative, 0 for zero/unparseable.
 * Handles: "$1,234.56", "-$1,234.56", "+1.23%", "($1,234.56)"
 */
function detectNumericSign(s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 45 /* - */ || c === 40 /* ( */) return -1;
    if (c >= 49 && c <= 57 /* 1-9 */) return 1;
  }
  return 0;
}

export function renderNumericCell(
  td: HTMLTableCellElement,
  options: NumericRenderOptions,
): void {
  const { value, columnId, isShort, isSummary } = options;

  td.textContent = value;
  td.className = "table-cell-numeric";

  // Inline style for color: CSS class color can be overridden by host page
  // selectors (e.g. Schwab's own `table td { color: ... }`), so inline wins.
  if (SIGN_COLOR_COLUMNS.has(columnId)) {
    const sign = detectNumericSign(value);
    if (sign !== 0) {
      // Summary rows use a different inversion set: their computed percentages
      // (dayChangePercent, gainLossPercent) have negative denominators for net-short
      // underlyings, flipping the sign relative to actual profitability.
      const invertSet = isSummary
        ? INVERT_FOR_SHORT_SUMMARY_COLUMNS
        : INVERT_FOR_SHORT_COLUMNS;
      const isInverted = isShort && invertSet.has(columnId);
      const isPositive = sign > 0;
      const isGood = isInverted ? !isPositive : isPositive;
      td.style.color = isGood ? DS_COLORS.raw.positive : DS_COLORS.raw.negative;
    } else {
      td.style.color = "";
    }
  } else {
    td.style.color = "";
  }
}

export function renderGroupCell(
  td: HTMLTableCellElement,
  options: GroupRenderOptions,
): void {
  td.innerHTML = "";
  td.className = "table-cell-group";

  const title = document.createElement("span");
  title.textContent = options.name ?? "";
  title.className = "table-group-title";
  td.appendChild(title);
}

export function renderTextCell(
  td: HTMLTableCellElement,
  value: string,
  align: "left" | "right" = "left",
): void {
  td.textContent = value;
  td.className =
    align === "left"
      ? "table-cell-text"
      : "table-cell-text table-cell-text--right";
}

export function applyStickyClass(td: HTMLTableCellElement): void {
  td.classList.add("table-cell-sticky");
  // Hard fallback with !important in case stylesheet order/caching overrides class rules.
  td.style.setProperty("position", "sticky", "important");
  td.style.setProperty("left", "0", "important");
  td.style.setProperty(
    "z-index",
    "var(--z-table-sticky-cell, 30)",
    "important",
  );
}

export function applyRowClasses(
  row: HTMLTableRowElement,
  options: {
    isChild?: boolean;
    isSummary?: boolean;
    isGroup?: boolean;
    isMajorGroup?: boolean;
  },
): void {
  const classes = ["table-row"];

  if (options.isChild) classes.push("table-row--child");
  if (options.isSummary) classes.push("table-row--summary");
  if (options.isGroup) classes.push("table-row--group");
  if (options.isMajorGroup) classes.push("table-row--major-group");

  row.className = classes.join(" ");
}
