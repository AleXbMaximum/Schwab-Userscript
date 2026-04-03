/**
 * Context builders for the AI analysis pipeline.
 *
 * Assembles the per-analyst context strings (market, technicals,
 * fundamentals, financial quality, sentiment, sell-side, ownership)
 * from the fetched MarketDataBundle.
 */

import type { MarketDataBundle } from "../types";
import {
  buildEstimateRevisionBlock,
  buildFinancialQualityBlock,
  buildOwnershipBlock,
} from "./dataPreprocessing";
import {
  fmt,
  fmtBig,
  fmtPct,
  formatBalanceSheet,
  formatCashFlow,
  formatIncomeStatement,
  formatInsiderTransactions,
  formatNewsItems,
} from "./formatters";

export interface AnalystContexts {
  market: string;
  technicals: string;
  fundamentals: string;
  financialQuality: string;
  sentimentCompany: string;
  sentimentMacro: string;
  sellside: string;
  ownership: string;
}

export function buildAnalystsContext(
  symbol: string,
  data: MarketDataBundle,
): AnalystContexts {
  const price =
    data.currentPrice != null ? `$${data.currentPrice.toFixed(2)}` : "N/A";
  const bars = data.ohlcv90d;
  const n = bars.length;
  const tech = data.technicals;
  const f = data.fundamentals;
  const b = data.barrons;

  const recentPrices = bars
    .slice(-10)
    .map(
      (bar) =>
        `${bar.date}: O=${bar.open.toFixed(2)} H=${bar.high.toFixed(2)} L=${bar.low.toFixed(2)} C=${bar.close.toFixed(2)} V=${(bar.volume / 1e6).toFixed(1)}M`,
    )
    .join("\n");

  // ── Market Analyst context (unchanged + Barron's performance) ────────
  let marketCtx =
    `SYMBOL: ${symbol}\nCURRENT PRICE: ${price}\nDATA BARS: ${n} days\n\n` +
    `RECENT OHLCV (last 10 days):\n${recentPrices}\n\n` +
    (n > 0
      ? `4-MONTH RANGE: $${Math.min(...bars.map((x) => x.low)).toFixed(2)} – $${Math.max(...bars.map((x) => x.high)).toFixed(2)}\n` +
        `AVG VOLUME: ${Math.round(bars.reduce((s, x) => s + x.volume, 0) / n / 1e6).toFixed(1)}M shares/day\n`
      : "");

  if (b?.performance) {
    marketCtx += "\nBARRON'S PERFORMANCE:\n";
    for (const [period, val] of Object.entries(b.performance)) {
      marketCtx += `  ${period}: ${val}\n`;
    }
  }

  // ── Technicals Analyst context (unchanged) ──────────────────────────
  const techCtx =
    `SYMBOL: ${symbol}\nCURRENT PRICE: ${price}\n\n` +
    `MOVING AVERAGES:\n` +
    `  SMA20: ${fmt(tech.sma20)} | SMA50: ${fmt(tech.sma50)} | SMA200: ${fmt(tech.sma200)}\n` +
    `  EMA12: ${fmt(tech.ema12)} | EMA26: ${fmt(tech.ema26)}\n` +
    `  Trend: ${tech.trendDirection ?? "N/A"}\n\n` +
    `MOMENTUM:\n` +
    `  RSI(14): ${fmt(tech.rsi14, 1)}\n` +
    `  MACD Line: ${fmt(tech.macdLine, 4)} | Signal: ${fmt(tech.macdSignal, 4)} | Histogram: ${fmt(tech.macdHistogram, 4)}\n\n` +
    `VOLATILITY:\n` +
    `  Bollinger Upper: ${fmt(tech.bollingerUpper)} | Mid: ${fmt(tech.bollingerMiddle)} | Lower: ${fmt(tech.bollingerLower)}\n` +
    `  ATR(14): ${fmt(tech.atr14)} (${price !== "N/A" && tech.atr14 && data.currentPrice ? ((tech.atr14 / data.currentPrice) * 100).toFixed(1) + "%" : "N/A"} of price)\n\n` +
    `VOLUME:\n` +
    `  OBV Trend: ${tech.obvTrend ?? "N/A"}\n`;

  // ── Fundamentals Analyst context (narrowed: valuation + growth + peers) ──
  let fundCtx =
    `SYMBOL: ${symbol}\nCURRENT PRICE: ${price}\n\n` +
    `VALUATION:\n` +
    `  Market Cap: ${fmtBig(f.marketCap)}\n` +
    `  P/E (Fwd): ${fmt(f.forwardPE, 1)} | P/B: ${fmt(f.priceToBook)} | EV/EBITDA: ${fmt(f.evToEbitda, 1)}\n` +
    `  P/S: ${fmt(f.priceToSales)}\n` +
    `  Analyst Target: ${f.analystTargetPrice != null ? "$" + f.analystTargetPrice.toFixed(2) : "N/A"}\n` +
    `  52-Week Range: $${fmt(f.week52Low)} – $${fmt(f.week52High)}\n\n` +
    `GROWTH:\n` +
    `  Revenue Growth YoY: ${fmtPct(f.revenueGrowthYoy)}\n` +
    `  Earnings Growth YoY: ${fmtPct(f.earningsGrowthYoy)}\n` +
    (f.sector
      ? `  Sector: ${f.sector}${f.industry ? " / " + f.industry : ""}\n`
      : "");

  // Barron's valuation ratios
  if (b?.ratios?.valuation) {
    fundCtx += `\nBARRON'S VALUATION RATIOS:\n`;
    for (const [k, v] of Object.entries(b.ratios.valuation)) {
      fundCtx += `  ${k}: ${v}\n`;
    }
  }

  // Barron's peer comparison
  if (b?.peers?.length) {
    fundCtx += `\nBARRON'S PEER COMPARISON:\n`;
    for (const p of b.peers) {
      fundCtx += `  ${p.symbol} ${p.name}: ${p.price} (${p.changePct}) MCap ${p.marketCap}\n`;
    }
  }

  // ── Financial Quality Analyst context (new) ─────────────────────────
  let financialQualityCtx = `SYMBOL: ${symbol}\nCURRENT PRICE: ${price}\n\n`;
  financialQualityCtx +=
    `PROFITABILITY (Yahoo):\n` +
    `  Gross Margin: ${fmtPct(f.grossMargin)} | Op Margin: ${fmtPct(f.operatingMargin)} | Net Margin: ${fmtPct(f.netMargin)}\n\n` +
    `FINANCIAL HEALTH (Yahoo):\n` +
    `  Debt/Equity: ${fmt(f.debtToEquity)} | Current Ratio: ${fmt(f.currentRatio)}\n` +
    `  Free Cash Flow: ${fmtBig(f.freeCashFlow)}\n` +
    `  Dividend Yield: ${fmtPct(f.dividendYield)} | Beta: ${fmt(f.beta)}\n`;

  if (data.incomeStatement?.quarters.length) {
    financialQualityCtx += `\nINCOME STATEMENT (quarterly, Yahoo):\n${formatIncomeStatement(data.incomeStatement)}\n`;
  }
  if (data.balanceSheet?.quarters.length) {
    financialQualityCtx += `\nBALANCE SHEET (quarterly, Yahoo):\n${formatBalanceSheet(data.balanceSheet)}\n`;
  }
  if (data.cashFlow?.quarters.length) {
    financialQualityCtx += `\nCASH FLOW (quarterly, Yahoo):\n${formatCashFlow(data.cashFlow)}\n`;
  }
  if (data.insiderTransactions?.length) {
    financialQualityCtx += `\nINSIDER ACTIVITY:\n${formatInsiderTransactions(data.insiderTransactions)}\n`;
  }

  // Barron's pre-computed financial quality block
  if (b) {
    financialQualityCtx += `\n${buildFinancialQualityBlock(b)}`;
  }

  // ── Sentiment Company context (company-specific news only) ──────────
  let sentimentCompanyCtx = `SYMBOL: ${symbol}\n\n`;
  const companyNewsText = formatNewsItems(data.news, "company news");
  sentimentCompanyCtx += `COMPANY NEWS — YAHOO (${Math.min(data.news.length, 10)} items):\n${companyNewsText}`;

  if (b && (b.news.barrons.length || b.news.dowJones.length)) {
    const companyBarronsNews = [...b.news.barrons, ...b.news.dowJones];
    sentimentCompanyCtx += `\n\nCOMPANY NEWS — BARRON'S/DOW JONES (${companyBarronsNews.length} items, PREMIUM — weight HIGHER):\n`;
    for (const [i, s] of companyBarronsNews.slice(0, 15).entries()) {
      sentimentCompanyCtx += `${i + 1}. [${s.provider}] ${s.headline}\n   ${s.summary}\n   Date: ${s.timestamp}\n\n`;
    }
  }

  // ── Sentiment Macro context (macro/market news only) ────────────────
  let sentimentMacroCtx = `SYMBOL: ${symbol}\n\n`;
  if (data.globalMacroNews?.length) {
    sentimentMacroCtx += `GLOBAL MACRO NEWS — YAHOO (${Math.min(data.globalMacroNews.length, 10)} items):\n${formatNewsItems(data.globalMacroNews, "macro news")}`;
  }
  if (b?.news.press.length) {
    sentimentMacroCtx += `\n\nPRESS RELEASES — BARRON'S (${b.news.press.length} items):\n`;
    for (const [i, s] of b.news.press.slice(0, 10).entries()) {
      sentimentMacroCtx += `${i + 1}. [${s.provider}] ${s.headline}\n   ${s.summary}\n   Date: ${s.timestamp}\n\n`;
    }
  }

  // ── Sellside Analyst context (new) ──────────────────────────────────
  let sellsideCtx = `SYMBOL: ${symbol}\nCURRENT PRICE: ${price}\n\n`;
  if (b) {
    sellsideCtx += buildEstimateRevisionBlock(b);
  } else {
    sellsideCtx += "No Barron's analyst/estimate data available.\n";
    // Fallback to Yahoo analyst target
    if (f.analystTargetPrice != null) {
      sellsideCtx += `Yahoo Analyst Target: $${f.analystTargetPrice.toFixed(2)}\n`;
    }
  }

  // ── Ownership Analyst context (new) ─────────────────────────────────
  let ownershipCtx = `SYMBOL: ${symbol}\nCURRENT PRICE: ${price}\n\n`;
  if (b) {
    ownershipCtx += buildOwnershipBlock(b);
  } else {
    ownershipCtx += "No Barron's ownership data available.\n";
  }

  return {
    market: marketCtx,
    technicals: techCtx,
    fundamentals: fundCtx,
    financialQuality: financialQualityCtx,
    sentimentCompany: sentimentCompanyCtx,
    sentimentMacro: sentimentMacroCtx,
    sellside: sellsideCtx,
    ownership: ownershipCtx,
  };
}
