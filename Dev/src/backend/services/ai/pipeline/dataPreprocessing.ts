import type { DataQualityFlags, MarketDataBundle } from "../types";
import type { FundamentalsData } from "shared/marketDataTypes";
import type { BarronsDataBundle } from "../../../core/network/barrons/types";

// ── Barrons → Fundamentals Backfill ─────────────────────────────────────────

/** Try to parse a Barrons ratio string (e.g. "75.54") into a number. */
function parseRatio(
  table: Record<string, string> | null | undefined,
  ...keys: string[]
): number | null {
  if (!table) return null;
  for (const k of keys) {
    const v = table[k];
    if (v == null) continue;
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    if (!isNaN(n)) return n;
  }
  return null;
}

/** Try to parse a Barrons percentage string (e.g. "45.99%") into a decimal (0.4599). */
function parsePct(
  table: Record<string, string> | null | undefined,
  ...keys: string[]
): number | null {
  if (!table) return null;
  for (const k of keys) {
    const v = table[k];
    if (v == null) continue;
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    if (!isNaN(n)) return n / 100;
  }
  return null;
}

/** Parse a Barrons percentage string from companyDetails (e.g. "34.34%") into decimal. */
function parsePctStr(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return null;
  return n / 100;
}

/**
 * Backfill null fields in `fundamentals` with data from Barrons.
 * Mutates `fundamentals` in-place — only fills fields that are currently null/undefined.
 */
export function backfillFundamentalsFromBarrons(
  fundamentals: FundamentalsData,
  barrons: BarronsDataBundle,
): void {
  const val = barrons.ratios?.valuation;
  const prof = barrons.ratios?.profitability;
  const liq = barrons.ratios?.liquidity;
  const cap = barrons.ratios?.capitalization;

  // Valuation ratios
  fundamentals.peRatio ??= parseRatio(
    val,
    "P/E Current",
    "P/E Ratio (TTM)",
    "P/E Ratio",
  );
  fundamentals.forwardPE ??= parseRatio(
    val,
    "Forward P/E",
    "P/E Ratio (w/o extraordinary items)",
  );
  fundamentals.priceToBook ??= parseRatio(val, "Price to Book Ratio");
  fundamentals.priceToSales ??= parseRatio(val, "Price to Sales Ratio");
  fundamentals.evToEbitda ??= parseRatio(val, "Enterprise Value to EBITDA");

  // Profitability margins (Barrons stores as "45.99%" → convert to 0.4599)
  fundamentals.grossMargin ??= parsePct(prof, "Gross Margin");
  fundamentals.operatingMargin ??= parsePct(prof, "Operating Margin");
  fundamentals.netMargin ??= parsePct(prof, "Net Margin");

  // Liquidity & capitalization
  fundamentals.currentRatio ??= parseRatio(liq, "Current Ratio");
  fundamentals.debtToEquity ??= parseRatio(cap, "Total Debt to Total Equity");

  // Revenue growth from company details
  fundamentals.revenueGrowthYoy ??= parsePctStr(
    barrons.companyDetails?.salesGrowth,
  );

  // Free cash flow from cash flow statement (latest year, "Free Cash Flow" row)
  if (fundamentals.freeCashFlow == null && barrons.cashFlowStatement?.rows.length) {
    const fcfRow = barrons.cashFlowStatement.rows.find((r) =>
      /free cash flow/i.test(r.name),
    );
    if (fcfRow?.rawValues?.[0] != null) {
      fundamentals.freeCashFlow = fcfRow.rawValues[0];
    }
  }
}

// ── Data Quality Validation ─────────────────────────────────────────────────

const FUNDAMENTAL_KEYS: (keyof FundamentalsData)[] = [
  "peRatio",
  "forwardPE",
  "priceToBook",
  "evToEbitda",
  "revenueGrowthYoy",
  "earningsGrowthYoy",
  "netMargin",
  "freeCashFlow",
  "grossMargin",
  "operatingMargin",
  "debtToEquity",
  "currentRatio",
];

function computeHolderStaleness(barrons: BarronsDataBundle | null): {
  stale: boolean;
  avgDays: number;
} {
  if (!barrons?.holders) return { stale: false, avgDays: 0 };

  const now = Date.now();
  const allDates: number[] = [];

  const collectDates = (holders: typeof barrons.holders.institutional) => {
    for (const h of holders) {
      if (!h.asOf) continue;
      const d = Date.parse(h.asOf);
      if (!isNaN(d)) allDates.push(Math.floor((now - d) / 86_400_000));
    }
  };

  collectDates(barrons.holders.institutional);
  collectDates(barrons.holders.mutualFunds);
  collectDates(barrons.holders.individuals);

  if (!allDates.length) return { stale: false, avgDays: 0 };

  const avgDays = Math.round(
    allDates.reduce((s, d) => s + d, 0) / allDates.length,
  );
  return { stale: avgDays > 180, avgDays };
}

function checkPEConflict(
  yahooFund: FundamentalsData,
  barrons: BarronsDataBundle | null,
): string | null {
  if (!barrons?.ratios?.valuation) return null;

  const yahooPE = yahooFund.peRatio;
  const barronsValuation = barrons.ratios.valuation;

  // Try to find PE in Barron's valuation table
  const barronsPEStr =
    barronsValuation["P/E Ratio (TTM)"] ??
    barronsValuation["P/E Current"] ??
    barronsValuation["P/E Ratio"];
  if (!barronsPEStr || yahooPE == null) return null;

  const barronsPE = parseFloat(barronsPEStr);
  if (isNaN(barronsPE) || barronsPE === 0) return null;

  const divergence = Math.abs(yahooPE - barronsPE) / barronsPE;
  if (divergence > 0.05) {
    return `barrons_pe_vs_yahoo_pe_divergence_${(divergence * 100).toFixed(1)}%`;
  }
  return null;
}

/** Validate market data completeness and quality. Pure TypeScript — no LLM. */
export function validateAndFlag(data: MarketDataBundle): DataQualityFlags {
  const f = data.fundamentals;
  const b = data.barrons;

  // Missing fundamentals fields
  const missingFields: string[] = FUNDAMENTAL_KEYS.filter(
    (k) => f[k] == null,
  ) as string[];

  // Check financial statements
  const hasYahooStatements =
    (data.balanceSheet?.quarters?.length ?? 0) > 0 ||
    (data.cashFlow?.quarters?.length ?? 0) > 0 ||
    (data.incomeStatement?.quarters?.length ?? 0) > 0;
  const hasBarronsStatements =
    !!b?.incomeStatement || !!b?.balanceSheet || !!b?.cashFlowStatement;

  if (!hasYahooStatements && !hasBarronsStatements) {
    missingFields.push("financial_statements");
  }
  if (!data.insiderTransactions?.length) {
    missingFields.push("insider_transactions");
  }

  // Stale fields
  const staleFields: Record<string, number> = {};
  const holderInfo = computeHolderStaleness(b);
  if (holderInfo.avgDays > 0) {
    staleFields["holders"] = holderInfo.avgDays;
  }

  // Conflict flags
  const conflictFlags: string[] = [];
  const peConflict = checkPEConflict(f, b);
  if (peConflict) conflictFlags.push(peConflict);

  // Estimates availability
  const estimatesAvailable = !!(
    b?.yearlyEstimates?.length ||
    b?.quarterlyEstimates?.length ||
    b?.analystSnapshot
  );

  // Overall grade
  const fundamentalsComplete =
    missingFields.length <= 3 && (hasYahooStatements || hasBarronsStatements);
  const totalMissing = missingFields.length;
  let overallGrade: DataQualityFlags["overallGrade"];
  if (totalMissing > 8 && !hasYahooStatements && !b) {
    overallGrade = "critical";
  } else if (
    totalMissing > 6 ||
    (!hasYahooStatements && !hasBarronsStatements)
  ) {
    overallGrade = "low";
  } else if (totalMissing > 3 || conflictFlags.length > 0) {
    overallGrade = "medium";
  } else {
    overallGrade = "high";
  }

  return {
    overallGrade,
    missingFields,
    staleFields,
    conflictFlags,
    fundamentalsComplete,
    estimatesAvailable,
    holdersStale: holderInfo.stale,
  };
}

// ── Format data quality block for agent context ─────────────────────────────

export function formatDataQualityBlock(flags: DataQualityFlags): string {
  const lines: string[] = [`## DATA_QUALITY`, `Overall: ${flags.overallGrade}`];
  if (flags.missingFields.length) {
    lines.push(`Missing: ${flags.missingFields.join(", ")}`);
  }
  if (flags.conflictFlags.length) {
    lines.push(`Conflicts: ${flags.conflictFlags.join(", ")}`);
  }
  if (flags.holdersStale) {
    const days = flags.staleFields["holders"];
    lines.push(`Holder staleness: stale (avg ${days} days)`);
  }
  if (!flags.estimatesAvailable) {
    lines.push(`Estimates: unavailable`);
  }
  return lines.join("\n") + "\n\n";
}

// ── Pre-computed Feature Blocks ─────────────────────────────────────────────

/** Build financial quality metrics block for the financial_quality_analyst. */
export function buildFinancialQualityBlock(b: BarronsDataBundle): string {
  const lines: string[] = ["## BARRONS_FINANCIAL_QUALITY (pre-computed)"];

  // Ratios
  if (b.ratios.profitability) {
    lines.push("\nPROFITABILITY RATIOS:");
    for (const [k, v] of Object.entries(b.ratios.profitability)) {
      lines.push(`  ${k}: ${v}`);
    }
  }
  if (b.ratios.efficiency) {
    lines.push("\nEFFICIENCY RATIOS:");
    for (const [k, v] of Object.entries(b.ratios.efficiency)) {
      lines.push(`  ${k}: ${v}`);
    }
  }
  if (b.ratios.liquidity) {
    lines.push("\nLIQUIDITY RATIOS:");
    for (const [k, v] of Object.entries(b.ratios.liquidity)) {
      lines.push(`  ${k}: ${v}`);
    }
  }
  if (b.ratios.capitalization) {
    lines.push("\nCAPITALIZATION RATIOS:");
    for (const [k, v] of Object.entries(b.ratios.capitalization)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  // Margin trends from annual income statement
  if (b.incomeStatement?.rows.length) {
    lines.push("\nANNUAL INCOME STATEMENT (top-level rows):");
    lines.push(`  Columns: ${b.incomeStatement.columns.join(" | ")}`);
    const topRows = b.incomeStatement.rows.filter(
      (r) => r.isSectionHeader || r.level <= 1,
    );
    for (const r of topRows.slice(0, 20)) {
      if (r.isSectionHeader) {
        lines.push(`  ${r.name}`);
      } else {
        lines.push(
          `  ${"  ".repeat(r.level)}${r.name}: ${r.values.join(" | ")}`,
        );
      }
    }
  }

  // Cash flow for cash conversion
  if (b.cashFlowStatement?.rows.length) {
    lines.push("\nANNUAL CASH FLOW (top-level rows):");
    lines.push(`  Columns: ${b.cashFlowStatement.columns.join(" | ")}`);
    const topRows = b.cashFlowStatement.rows.filter(
      (r) => r.isSectionHeader || r.level <= 1,
    );
    for (const r of topRows.slice(0, 15)) {
      if (r.isSectionHeader) {
        lines.push(`  ${r.name}`);
      } else {
        lines.push(
          `  ${"  ".repeat(r.level)}${r.name}: ${r.values.join(" | ")}`,
        );
      }
    }
  }

  return lines.join("\n") + "\n";
}

/** Build estimate revision block for the sellside_analyst. */
export function buildEstimateRevisionBlock(b: BarronsDataBundle): string {
  const lines: string[] = ["## BARRONS_ESTIMATE_REVISIONS (pre-computed)"];

  // Analyst snapshot
  if (b.analystSnapshot) {
    const s = b.analystSnapshot;
    lines.push("\nANALYST CONSENSUS:");
    lines.push(
      `  Rating: ${s.meanRating ?? "N/A"} (${s.numRatings ?? "?"} analysts)`,
    );
    lines.push(`  Mean Target: ${s.meanTargetPrice ?? "N/A"}`);
    lines.push(`  Current Qtr Est: ${s.currentQtrEst ?? "N/A"}`);
    lines.push(`  Current Year Est: ${s.currentYearEst ?? "N/A"}`);
    lines.push(`  Next FY Est: ${s.nextFYEst ?? "N/A"}`);
    lines.push(`  Last Qtr EPS: ${s.lastQtrEPS ?? "N/A"}`);
    lines.push(`  FY Report Date: ${s.fyReportDate ?? "N/A"}`);
  }

  // Price target
  if (b.priceTarget) {
    lines.push("\nPRICE TARGET:");
    lines.push(
      `  High: ${b.priceTarget.high ?? "N/A"} | Low: ${b.priceTarget.low ?? "N/A"}`,
    );
    lines.push(
      `  Median: ${b.priceTarget.median ?? "N/A"} | Avg: ${b.priceTarget.average ?? "N/A"}`,
    );
    lines.push(`  Current: ${b.priceTarget.currentPrice ?? "N/A"}`);
  }

  // Ratings table (migration)
  if (b.ratingsTable) {
    const fmt = (r: typeof b.ratingsTable.current) =>
      `Buy:${r.Buy ?? "-"} Over:${r.Overweight ?? "-"} Hold:${r.Hold ?? "-"} Under:${r.Underweight ?? "-"} Sell:${r.Sell ?? "-"}`;
    lines.push("\nRATINGS MIGRATION (3M → 1M → Current):");
    lines.push(`  3M Prior: ${fmt(b.ratingsTable.threeMonthsPrior)}`);
    lines.push(`  1M Prior: ${fmt(b.ratingsTable.oneMonthPrior)}`);
    lines.push(`  Current:  ${fmt(b.ratingsTable.current)}`);

    // Compute net migration
    const cur = b.ratingsTable.current;
    const prior = b.ratingsTable.threeMonthsPrior;
    const buyDelta = (cur.Buy ?? 0) - (prior.Buy ?? 0);
    const sellDelta = (cur.Sell ?? 0) - (prior.Sell ?? 0);
    lines.push(
      `  Net Buy Migration (3M): ${buyDelta > 0 ? "+" : ""}${buyDelta}`,
    );
    lines.push(
      `  Net Sell Migration (3M): ${sellDelta > 0 ? "+" : ""}${sellDelta}`,
    );
  }

  // Estimate trends (1M/3M revision deltas)
  if (b.estimateTrends?.length) {
    lines.push("\nESTIMATE TRENDS:");
    for (const t of b.estimateTrends) {
      lines.push(
        `  ${t.period}: Current=${t.current ?? "N/A"} | 1M Ago=${t.oneMonthAgo ?? "N/A"} | 3M Ago=${t.threeMonthsAgo ?? "N/A"}`,
      );
    }
  }

  // Yearly estimates
  if (b.yearlyEstimates?.length) {
    lines.push("\nYEARLY EPS ESTIMATES:");
    for (const e of b.yearlyEstimates) {
      lines.push(
        `  ${e.year}: Avg ${e.average ?? "N/A"} (H: ${e.high ?? "-"}, L: ${e.low ?? "-"}, ${e.count ?? "?"} analysts)`,
      );
    }
  }

  // Quarterly actuals (surprise trend)
  if (b.quarterlyActuals?.length) {
    lines.push("\nQUARTERLY ACTUALS (surprise trend):");
    let beats = 0;
    let misses = 0;
    for (const q of b.quarterlyActuals) {
      lines.push(
        `  ${q.quarter}: Est=${q.estimate ?? "N/A"} | Actual=${q.actual ?? "N/A"} | Surprise=${q.surprise ?? "N/A"}`,
      );
      const surpriseNum = q.surprise
        ? parseFloat(q.surprise.replace(/[^0-9.\-]/g, ""))
        : NaN;
      if (!isNaN(surpriseNum)) {
        if (surpriseNum > 0) beats++;
        else if (surpriseNum < 0) misses++;
      }
    }
    lines.push(
      `  Summary: ${beats} beats, ${misses} misses out of ${b.quarterlyActuals.length} quarters`,
    );
  }

  // Quarterly estimates (forward)
  if (b.quarterlyEstimates?.length) {
    lines.push("\nQUARTERLY ESTIMATES (forward):");
    for (const q of b.quarterlyEstimates) {
      lines.push(
        `  ${q.quarter}: Avg ${q.average ?? "N/A"} (H: ${q.high ?? "-"}, L: ${q.low ?? "-"})`,
      );
    }
  }

  // Upcoming reports
  if (b.upcomingReports) {
    lines.push("\nUPCOMING REPORTS:");
    if (b.upcomingReports.nextQtr)
      lines.push(`  Next Quarter: ${b.upcomingReports.nextQtr}`);
    if (b.upcomingReports.nextYear)
      lines.push(`  Next Year: ${b.upcomingReports.nextYear}`);
  }

  return lines.join("\n") + "\n";
}

/** Build ownership block for the ownership_analyst. */
export function buildOwnershipBlock(b: BarronsDataBundle): string {
  const lines: string[] = ["## BARRONS_OWNERSHIP (pre-computed)"];

  const now = Date.now();
  const staleDays = (asOf: string | null | undefined): string => {
    if (!asOf) return "unknown";
    const d = Date.parse(asOf);
    if (isNaN(d)) return "unknown";
    const days = Math.floor((now - d) / 86_400_000);
    return `${days}d ago`;
  };

  // Short interest from keyData
  if (b.keyData) {
    const shortInterest =
      b.keyData["Short Interest"] ?? b.keyData["Shares Short"];
    const pctFloat =
      b.keyData["% Float Shorted"] ?? b.keyData["Short % of Float"];
    const sharesOutstanding = b.keyData["Shares Outstanding"];
    const floatShares = b.keyData["Float"];

    if (shortInterest || pctFloat) {
      lines.push("\nSHORT INTEREST (relatively fresh data):");
      if (shortInterest) lines.push(`  Shares Short: ${shortInterest}`);
      if (pctFloat) lines.push(`  % Float Shorted: ${pctFloat}`);
      if (sharesOutstanding)
        lines.push(`  Shares Outstanding: ${sharesOutstanding}`);
      if (floatShares) lines.push(`  Float: ${floatShares}`);
    }
  }

  // Holders with staleness annotation
  if (b.holders) {
    const renderHolders = (
      title: string,
      holders: typeof b.holders.institutional,
    ): void => {
      if (!holders.length) return;
      lines.push(`\n${title}:`);

      // Compute concentration
      let totalPctParsed = 0;
      for (const h of holders.slice(0, 10)) {
        const pctStr = h.pctOutstanding ?? "0";
        const pct = parseFloat(pctStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(pct)) totalPctParsed += pct;
      }

      for (const h of holders) {
        const stale = staleDays(h.asOf);
        lines.push(
          `  ${h.name}: ${h.shares ?? "N/A"} shares (${h.pctOutstanding ?? "N/A"} outstanding) | Chg: ${h.chgShares ?? "N/A"} | Data: ${stale}`,
        );
      }

      if (totalPctParsed > 0) {
        lines.push(
          `  Top-${Math.min(10, holders.length)} Concentration: ${totalPctParsed.toFixed(1)}%`,
        );
      }
    };

    renderHolders(
      "INSTITUTIONAL HOLDERS (STALENESS WARNING: data may be 6-18 months old)",
      b.holders.institutional,
    );
    renderHolders("MUTUAL FUND HOLDERS", b.holders.mutualFunds);
    renderHolders("INDIVIDUAL/DIRECT HOLDERS", b.holders.individuals);
  }

  return lines.join("\n") + "\n";
}
