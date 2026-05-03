import type{ OptionsChainsResponse } from "shared/types/options";
import type { OptionCaptureExpiryMetricsRow } from "backend/core/db/capture/optionMonitorTypes";
import type { GexGammaSource } from "../../types";
import { requestDateFromExpiryLabel } from "shared/utils/domain/optionsExpiries";
import {
  computeSummaryMetrics,
  computeStateVector,
} from "../../summary";
import { computeGexAnalytics } from "../../gex";
import { computeExpectedMove } from "../../expectedMove";
import { computeOptionsWalls } from "../../distribution";
import {
  computeTermStructure,
  computeVolSurface,
  computeVolSurfaceDiagnostics,
} from "../../volatility";
import { computeLiquidityScore, computeDataQuality } from "../../quality";

export type OpeningSelectionMode = "all" | "top_n" | "fixed_slots";

export type ExpirySelectionAnnotation = {
  slot?: string | null;
  rank?: number | null;
};

export type ExpirySelectionContext = {
  mode: OpeningSelectionMode;
  byRequestDate?: Map<string, ExpirySelectionAnnotation>;
};

export interface ETLGexConfig {
  gammaSource: GexGammaSource;
  riskFreeRate: number;
  dividendYield?: number;
}

export function buildExpiryMetricsRows(
  response: OptionsChainsResponse,
  openingId: string,
  symbol: string,
  selectionContext?: ExpirySelectionContext,
  gexConfig?: ETLGexConfig,
): OptionCaptureExpiryMetricsRow[] {
  const spot = response.underlyingPrice;
  const multiplier = response.contractMultiplier;
  const rows: OptionCaptureExpiryMetricsRow[] = [];

  for (const exp of response.expirations) {
    const chains = exp.chains;
    if (chains.length === 0) continue;
    const requestDate = requestDateFromExpiryLabel(exp.label);
    const selectionAnnotation =
      requestDate != null
        ? selectionContext?.byRequestDate?.get(requestDate)
        : undefined;

    const summary = computeSummaryMetrics(response, exp);
    const bsConfig =
      gexConfig?.gammaSource === "bs"
        ? {
            gammaSource: "bs" as const,
            riskFreeRate: gexConfig.riskFreeRate,
            daysToExpiry: exp.daysUntil,
            dividendYield: gexConfig.dividendYield,
          }
        : undefined;
    const gex = computeGexAnalytics(chains, multiplier, spot, "mid", bsConfig);
    const em = computeExpectedMove(
      chains,
      spot,
      exp.daysUntil,
      exp.label,
      "mid",
    );
    const walls = computeOptionsWalls(chains, multiplier, spot, "mid");
    const state = computeStateVector(response, exp, gex, em);
    const term = computeTermStructure([exp], spot);

    const volSurface = computeVolSurface([exp], spot);
    const volDiag = computeVolSurfaceDiagnostics(volSurface);
    const liquidity = computeLiquidityScore(chains, spot, 0);
    const quality = computeDataQuality(response, exp, liquidity, volDiag);

    rows.push({
      openingId: openingId,
      symbol,
      expiryLabel: exp.label,
      selectionMode: selectionContext?.mode ?? null,
      selectionSlot: selectionAnnotation?.slot ?? null,
      selectionRank: selectionAnnotation?.rank ?? null,
      dte: exp.daysUntil,
      atmStrike: summary.atmStrike,
      atmCallIV: term.length > 0 ? term[0].atmCallIV : null,
      atmPutIV: term.length > 0 ? term[0].atmPutIV : null,
      atmIV: state.atmIV,
      rr25: state.skewMetric,
      expectedMove: em.expectedMove,
      expectedMovePct: em.expectedMovePct,
      totalCallVolume: summary.totalCallVolume,
      totalPutVolume: summary.totalPutVolume,
      pcRatioVolume: summary.pcRatioVolume,
      totalCallOI: summary.totalCallOI,
      totalPutOI: summary.totalPutOI,
      pcRatioOI: summary.pcRatioOI,
      totalNetGex: gex.totalNetGex,
      grossGex: gex.grossGex,
      gammaFlip: gex.flipPoint,
      callWallOIStrike: walls.callWallStrike,
      putWallOIStrike: walls.putWallStrike,
      callWallGexStrike: gex.callWallStrike,
      putWallGexStrike: gex.putWallStrike,
      maxPain: walls.maxPainStrike,
      forwardPrice: state.forward,
      qualityScore: quality.qualityScore,
      missingQuotePct: quality.missingQuotePct,
      missingIVPct: quality.missingIVPct,
    });
  }

  return rows;
}
