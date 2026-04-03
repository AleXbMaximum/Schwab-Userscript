/**
 * Text formatters for the AI analysis pipeline.
 *
 * Converts raw market data structures (balance sheets, cash flows,
 * income statements, insider transactions, news, Barron's bundles,
 * OHLCV features, memory entries) into human-readable strings that
 * are injected into LLM prompts.
 */

import type { MemoryEntry, OHLCVFeatures } from "../types";
import type {
  BalanceSheetData,
  CashFlowData,
  IncomeStatementData,
  InsiderTransaction,
  NewsItem,
} from "shared/marketDataTypes";
import type {
  BarronsDataBundle,
  BarronsFinancialStatement,
} from "../../../core/network/barrons/types";
import { formatCompactDollar, formatPct } from "shared/utils/formatters";

// ── Primitive formatters ─────────────────────────────────────────────────────

export function fmt(v: number | null | undefined, decimals = 2): string {
  return v != null ? v.toFixed(decimals) : "N/A";
}
export function fmtPct(v: number | null | undefined): string {
  return formatPct(v, { decimals: 1, nullText: "N/A" });
}
export function fmtBig(v: number | null | undefined): string {
  return formatCompactDollar(v, { nullText: "N/A" });
}

// ── Yahoo financial-statement formatters ─────────────────────────────────────

export function formatBalanceSheet(bs: BalanceSheetData): string {
  if (!bs.quarters.length) return "No balance sheet data available.";
  return bs.quarters
    .map(
      (q) =>
        `[${q.date}] Assets: ${fmtBig(q.totalAssets)} | Liabilities: ${fmtBig(q.totalLiabilities)} | Equity: ${fmtBig(q.totalEquity)} | Debt: ${fmtBig(q.totalDebt)} | Cash: ${fmtBig(q.cash)} | CurrentRatio: ${q.currentAssets != null && q.currentLiabilities != null && q.currentLiabilities !== 0 ? (q.currentAssets / q.currentLiabilities).toFixed(2) : "N/A"}`,
    )
    .join("\n");
}

export function formatCashFlow(cf: CashFlowData): string {
  if (!cf.quarters.length) return "No cash flow data available.";
  return cf.quarters
    .map(
      (q) =>
        `[${q.date}] Op. CF: ${fmtBig(q.operatingCashFlow)} | Capex: ${fmtBig(q.capitalExpenditures)} | FCF: ${fmtBig(q.freeCashFlow)} | Net Income: ${fmtBig(q.netIncome)} | Dividends: ${fmtBig(q.dividendsPaid)}`,
    )
    .join("\n");
}

export function formatIncomeStatement(is: IncomeStatementData): string {
  if (!is.quarters.length) return "No income statement data available.";
  return is.quarters
    .map(
      (q) =>
        `[${q.date}] Revenue: ${fmtBig(q.totalRevenue)} | Gross Profit: ${fmtBig(q.grossProfit)} | Op. Income: ${fmtBig(q.operatingIncome)} | Net Income: ${fmtBig(q.netIncome)} | EBITDA: ${fmtBig(q.ebitda)} | EPS: ${fmt(q.eps)}`,
    )
    .join("\n");
}

export function formatInsiderTransactions(txns: InsiderTransaction[]): string {
  if (!txns.length) return "No recent insider transactions.";
  return txns
    .slice(0, 10)
    .map(
      (t) =>
        `${t.date} | ${t.name} (${t.relation}) — ${t.transactionDescription} | Shares: ${t.shares != null ? t.shares.toLocaleString() : "N/A"} | Value: ${fmtBig(t.value)}`,
    )
    .join("\n");
}

// ── News formatters ──────────────────────────────────────────────────────────

export function formatNewsItems(news: NewsItem[], label: string): string {
  if (!news.length) return `No ${label} available.`;
  return news
    .slice(0, 10)
    .map(
      (n, i) =>
        `${i + 1}. [${n.source}] ${n.title}\n   ${n.summary}\n   Date: ${n.publishedAt.slice(0, 10)}`,
    )
    .join("\n\n");
}

// ── Barron's formatters ──────────────────────────────────────────────────────

export function formatBarronsAnalystData(b: BarronsDataBundle): string {
  const parts: string[] = [];
  if (b.analystSnapshot) {
    const s = b.analystSnapshot;
    parts.push(
      `Consensus: ${s.meanRating ?? "N/A"} (${s.numRatings ?? "?"} ratings)`,
    );
    parts.push(`Mean Target: ${s.meanTargetPrice ?? "N/A"}`);
    if (s.currentQtrEst) parts.push(`Current Qtr Est: ${s.currentQtrEst}`);
    if (s.currentYearEst) parts.push(`Current Year Est: ${s.currentYearEst}`);
  }
  if (b.priceTarget) {
    parts.push(
      `Price Target Range: ${b.priceTarget.low ?? "N/A"} – ${b.priceTarget.high ?? "N/A"} (Avg: ${b.priceTarget.average ?? "N/A"})`,
    );
  }
  if (b.ratingsTable?.current) {
    const c = b.ratingsTable.current;
    parts.push(
      `Current Ratings: Buy:${c.Buy ?? "-"} Over:${c.Overweight ?? "-"} Hold:${c.Hold ?? "-"} Under:${c.Underweight ?? "-"} Sell:${c.Sell ?? "-"}`,
    );
  }
  return parts.join("\n") || "No Barron's analyst data.";
}

export function formatBarronsNews(
  b: BarronsDataBundle,
  maxPerChannel = 8,
): string {
  const formatChannel = (
    stories: BarronsDataBundle["news"]["barrons"],
    label: string,
  ): string => {
    if (!stories.length) return "";
    const items = stories
      .slice(0, maxPerChannel)
      .map(
        (s, i) =>
          `${i + 1}. [${s.provider || label}] ${s.headline}\n   ${s.summary}\n   Date: ${s.timestamp}`,
      )
      .join("\n\n");
    return `${label} (${stories.length} items):\n${items}`;
  };
  const channels = [
    formatChannel(b.news.barrons, "Barron's"),
    formatChannel(b.news.dowJones, "Dow Jones Network"),
    formatChannel(b.news.press, "Press Releases"),
  ].filter(Boolean);
  return channels.join("\n\n") || "No Barron's news.";
}

export function formatBarronsStatement(
  stmt: BarronsFinancialStatement | null | undefined,
  title: string,
): string {
  if (!stmt?.rows.length) return "";
  const importantRows = stmt.rows.filter(
    (r) => r.isSectionHeader || r.level <= 1,
  );
  const lines = [`${title} (${stmt.columns.join(" | ")}):`];
  if (stmt.fiscalYear) lines.push(`  ${stmt.fiscalYear}`);
  for (const row of importantRows.slice(0, 25)) {
    if (row.isSectionHeader) {
      lines.push(`  ${row.name}`);
      continue;
    }
    const indent = "  ".repeat(1 + row.level);
    lines.push(`${indent}${row.name}: ${row.values.join(" | ")}`);
  }
  return lines.join("\n");
}

// ── Memory formatter ─────────────────────────────────────────────────────────

export function formatMemoryContext(memories: MemoryEntry[]): string {
  if (!memories.length) return "";
  const lines = memories.map(
    (m) =>
      `• ${m.date.slice(0, 10)}: ${m.action} (conviction ${m.conviction}/10) at ${m.priceAtAnalysis != null ? "$" + m.priceAtAnalysis.toFixed(2) : "N/A"}\n  Summary: ${m.summary}\n  Bull: ${m.keyBullPoints.slice(0, 2).join("; ")}\n  Bear: ${m.keyBearPoints.slice(0, 2).join("; ")}`,
  );
  return `## Historical Analyses for This Symbol\n${lines.join("\n\n")}\n\n`;
}

// ── OHLCV features formatter ─────────────────────────────────────────────────

export function formatOHLCVFeatures(
  features: OHLCVFeatures,
  currentPrice: number | null,
): string {
  const price = currentPrice != null ? `$${currentPrice.toFixed(2)}` : "N/A";
  const rsiLast =
    features.rsiSeries.length > 0
      ? features.rsiSeries[features.rsiSeries.length - 1].toFixed(1)
      : "N/A";
  const rsiStr = features.rsiSeries.map((v) => v.toFixed(1)).join(", ");
  const swingHighStr =
    features.swingHighs
      .map((s) => `${s.date}:$${s.price.toFixed(2)}`)
      .join(" | ") || "N/A";
  const swingLowStr =
    features.swingLows
      .map((s) => `${s.date}:$${s.price.toFixed(2)}`)
      .join(" | ") || "N/A";
  const volProfileStr =
    features.volumeProfile
      .map(
        (b) =>
          `$${b.priceFrom.toFixed(2)}-$${b.priceTo.toFixed(2)}(${(b.totalVolume / 1e6).toFixed(1)}M)`,
      )
      .join(" | ") || "N/A";
  const gs = features.gapStats;
  const recentGapStr =
    gs.recentGaps
      .map((g) => `${g.date}:${g.direction}${g.magnitudePct.toFixed(1)}%`)
      .join(" | ") || "none";

  return (
    `## OHLCV_FEATURES (pre-computed — use this data only)\n` +
    `Current Price: ${price}\n` +
    `VWAP (full period): ${features.vwap != null ? "$" + features.vwap.toFixed(2) : "N/A"}\n\n` +
    `RSI(14) Series (last 20 values): ${rsiStr}\n` +
    `RSI Latest: ${rsiLast}\n\n` +
    `Swing Highs (last 5): ${swingHighStr}\n` +
    `Swing Lows (last 5): ${swingLowStr}\n\n` +
    `Volume Profile Top Zones: ${volProfileStr}\n\n` +
    `Gap Stats: total=${gs.totalGaps} up=${gs.upGaps} down=${gs.downGaps} ` +
    `avgMag=${gs.avgMagnitudePct.toFixed(2)}%\n` +
    `Recent Gaps: ${recentGapStr}\n`
  );
}
