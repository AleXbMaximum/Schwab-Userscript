/**
 * Liquidity scoring, bid-ask spread analysis, and data quality reporting.
 */
import type{ OptionsChain, OptionsChainsResponse, OptionsExpiration } from "shared/types/options";
import type {
  SpreadPoint,
  LiquidityScoreData,
  LiquidityStrikeData,
  DataQualityReport,
  VolSurfaceDiagnostics,
} from "./types";
import { clamp } from "shared/utils/math/numeric";
import { spreadPct, gradeFromSpreadPct, gradeFromScore } from "./chainHelpers";

export function computeBidAskSpread(chains: OptionsChain[]): SpreadPoint[] {
  return chains.map((c) => ({
    strike: c.strike,
    callSpread:
      c.call?.bid != null && c.call?.ask != null
        ? c.call.ask - c.call.bid
        : null,
    putSpread:
      c.put?.bid != null && c.put?.ask != null ? c.put.ask - c.put.bid : null,
  }));
}

export function computeLiquidityScore(
  chains: OptionsChain[],
  underlyingPrice: number | null,
  threshold: number,
): LiquidityScoreData {
  const byStrike: LiquidityStrikeData[] = [];
  let filteredCount = 0;
  let weightedScore = 0;
  let totalWeight = 0;

  for (const c of chains) {
    const cSpread = spreadPct(c.call?.bid, c.call?.ask);
    const pSpread = spreadPct(c.put?.bid, c.put?.ask);
    const avgSpread =
      cSpread != null && pSpread != null
        ? (cSpread + pSpread) / 2
        : (cSpread ?? pSpread);

    const grade = gradeFromSpreadPct(avgSpread);

    if (threshold > 0 && avgSpread != null && avgSpread > threshold) {
      filteredCount++;
    }

    const dist =
      underlyingPrice != null
        ? Math.abs(c.strike - underlyingPrice) / underlyingPrice
        : 0.5;
    const weight = Math.max(0, 1 - dist * 4); // 0 at ±25%

    const gradeScore =
      grade === "A"
        ? 100
        : grade === "B"
          ? 80
          : grade === "C"
            ? 60
            : grade === "D"
              ? 40
              : 20;
    weightedScore += gradeScore * weight;
    totalWeight += weight;

    byStrike.push({
      strike: c.strike,
      callSpreadPct: cSpread,
      putSpreadPct: pSpread,
      callVolume: c.call?.vol ?? 0,
      putVolume: c.put?.vol ?? 0,
      qualityGrade: grade,
    });
  }

  const overallScore =
    totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  const overallGrade = gradeFromSpreadPct(
    overallScore >= 90
      ? 0.005
      : overallScore >= 70
        ? 0.015
        : overallScore >= 50
          ? 0.03
          : overallScore >= 30
            ? 0.07
            : 0.15,
  );

  return {
    overallScore,
    overallGrade,
    byStrike,
    filteredCount,
    totalCount: chains.length,
  };
}

export function computeDataQuality(
  response: OptionsChainsResponse,
  expiration: OptionsExpiration,
  liquidityData: LiquidityScoreData,
  volDiag: VolSurfaceDiagnostics,
): DataQualityReport {
  const chains = expiration.chains;
  let missingQuotes = 0;
  let missingIV = 0;
  const freshPositionStrikes: number[] = [];

  for (const c of chains) {
    const callMissing =
      c.call != null &&
      (c.call.bid == null ||
        c.call.ask == null ||
        c.call.bid <= 0 ||
        c.call.ask <= 0);
    const putMissing =
      c.put != null &&
      (c.put.bid == null ||
        c.put.ask == null ||
        c.put.bid <= 0 ||
        c.put.ask <= 0);
    if (callMissing || putMissing) {
      missingQuotes++;
    }

    if ((c.call && c.call.iv == null) || (c.put && c.put.iv == null)) {
      missingIV++;
    }

    const totalVol = (c.call?.vol ?? 0) + (c.put?.vol ?? 0);
    const totalOI = (c.call?.oi ?? 0) + (c.put?.oi ?? 0);
    if (totalVol > totalOI && totalOI > 0) {
      if (freshPositionStrikes.length < 10) {
        freshPositionStrikes.push(c.strike);
      }
    }
  }

  const zeroOIExpirations = response.expirations.filter((e) => {
    let total = 0;
    for (const c of e.chains) total += (c.call?.oi ?? 0) + (c.put?.oi ?? 0);
    return total === 0;
  }).length;

  const totalStrikes = chains.length;
  const missingQuotePct =
    totalStrikes > 0 ? missingQuotes / totalStrikes : 0;
  const missingIVPct =
    chains.length > 0 ? missingIV / chains.length : 0;
  const wideSpreadFilteredCount = liquidityData.filteredCount;
  const wideSpreadFilteredPct =
    liquidityData.totalCount > 0
      ? wideSpreadFilteredCount / liquidityData.totalCount
      : 0;
  const interpolatedPointCount = Math.max(
    0,
    volDiag.totalPoints - volDiag.filledPoints,
  );
  const interpolatedPointPct =
    volDiag.totalPoints > 0
      ? (interpolatedPointCount / volDiag.totalPoints) * 100
      : 0;

  const qualityScoreRaw =
    100 -
    missingQuotePct * 0.45 -
    wideSpreadFilteredPct * 0.35 -
    interpolatedPointPct * 0.2;
  const qualityScore = clamp(qualityScoreRaw, 0, 100);
  const qualityGrade = gradeFromScore(qualityScore);

  return {
    zeroOIExpirations,
    missingIVPct,
    missingQuoteCount: missingQuotes,
    missingQuotePct,
    wideSpreadFilteredCount,
    wideSpreadFilteredPct,
    interpolatedPointCount,
    interpolatedPointPct,
    qualityScore,
    qualityGrade,
    oiTimestamp: response.currentDateTime ?? "Unknown",
    isPreMarket: false, // Schwab doesn't expose this directly
    freshPositionStrikes,
    totalStrikes,
  };
}
