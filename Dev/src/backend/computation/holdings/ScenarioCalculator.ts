import type{ DerivedMetricsRow, PortfolioAgg } from "../../../shared/types/derived";
import type {
  HoldingsIndex,
  HoldingsIndexEntry,
} from "../../pipeline/ingestion/holdingsIndexTypes";
import type { UnderlyingAggMap } from "./UnderlyingAggregator";
import { isOption } from "../../../shared/utils/holdingsKeys";

export class ScenarioCalculator {
  private isSummaryRow(meta: HoldingsIndexEntry): boolean {
    return (
      !!meta.underlyingKey &&
      !isOption(meta.row) &&
      meta.parentEquitySymbol == null
    );
  }

  enrichWithScenarios(
    holdingsIndex: HoldingsIndex,
    derivedByHoldings: Record<string, DerivedMetricsRow>,
    underlyingAgg: UnderlyingAggMap,
  ): void {
    for (const [holdingsKey, meta] of holdingsIndex.entries()) {
      const derived = derivedByHoldings[holdingsKey];
      if (!derived) continue;

      const underlyingKey = meta.underlyingKey;
      const underlyingPrice = underlyingKey
        ? (underlyingAgg[underlyingKey]?.underlyingPrice ?? null)
        : null;

      this.classifyRowType(derived, meta);

      this.computeScenarioPnL(derived, underlyingPrice);

      this.computeDeltaNotional(derived, underlyingPrice);

      if (this.isSummaryRow(meta) && underlyingKey) {
        this.enrichSummaryRow(derived, underlyingAgg[underlyingKey]);
      } else {
        this.clearSummaryFields(derived, meta);
      }
    }
  }

  private classifyRowType(
    derived: DerivedMetricsRow,
    meta: HoldingsIndexEntry,
  ): void {
    const isOptionRow = isOption(meta.row);
    const hasUnderlying = !!meta.underlyingKey;

    if (isOptionRow) {
      derived.rowType = "Option";
    } else if (hasUnderlying) {
      derived.rowType = "Equity";
    } else {
      derived.rowType = "Other";
    }
  }

  private computeScenarioPnL(
    derived: DerivedMetricsRow,
    underlyingPrice: number | null,
  ): void {
    if (underlyingPrice == null) {
      derived.pnlUp1PctDol = null;
      derived.pnlDn1PctDol = null;
      derived.carryToStress = null;
      return;
    }

    const du = underlyingPrice * 0.01; // 1% move
    const ds = derived.deltaShares ?? null;
    const gs = derived.gammaSharesPerDol ?? null;

    const gammaTerm = gs != null ? 0.5 * gs * du * du : 0;
    derived.pnlUp1PctDol = ds != null ? ds * du + gammaTerm : null;
    derived.pnlDn1PctDol = ds != null ? -ds * du + gammaTerm : null;
    derived.convexityDol =
      derived.pnlUp1PctDol != null && derived.pnlDn1PctDol != null
        ? derived.pnlUp1PctDol + derived.pnlDn1PctDol
        : null;
    derived.carryToStress = this.computeCarryToStress(
      derived.thetaPerDay ?? null,
      derived.pnlUp1PctDol,
      derived.pnlDn1PctDol,
    );
  }

  private computeDeltaNotional(
    derived: DerivedMetricsRow,
    underlyingPrice: number | null,
  ): void {
    derived.deltaNotionalDol =
      derived.deltaShares != null && underlyingPrice != null
        ? derived.deltaShares * underlyingPrice
        : null;

    const margin = derived.marginReqDol ?? null;
    derived.deltaNotionalPerMargin =
      derived.deltaNotionalDol != null && margin != null && margin !== 0
        ? derived.deltaNotionalDol / margin
        : null;
  }

  private computeCarryToStress(
    thetaPerDay: number | null,
    pnlUp1PctDol: number | null,
    pnlDn1PctDol: number | null,
  ): number | null {
    const upAbs = pnlUp1PctDol != null ? Math.abs(pnlUp1PctDol) : null;
    const dnAbs = pnlDn1PctDol != null ? Math.abs(pnlDn1PctDol) : null;
    const maxStress = Math.max(upAbs ?? 0, dnAbs ?? 0);
    if (thetaPerDay == null || maxStress === 0) return null;
    return thetaPerDay / maxStress;
  }

  private enrichSummaryRow(
    derived: DerivedMetricsRow,
    underlyingAgg: any,
  ): void {
    if (!underlyingAgg) return;

    derived.optDeltaShares = underlyingAgg.totalOptDeltaShares ?? null;

    derived.totalGammaByUnderlying =
      underlyingAgg.totalGammaSharesPerDol ?? null;
    derived.totalThetaByUnderlying = underlyingAgg.totalThetaPerDay ?? null;
    derived.totalVegaByUnderlying = underlyingAgg.totalVegaPerVolPoint ?? null;
    derived.totalRhoByUnderlying = underlyingAgg.totalRhoPer1pctRate ?? null;
    derived.totalMarginReqByUnderlying =
      underlyingAgg.totalMarginReqDol ?? null;
    derived.gammaDensityNearTerm = underlyingAgg.nearTermGammaAbs ?? null;
    derived.gammaDensityWeighted = underlyingAgg.nearTermGammaWeighted ?? null;

    derived.absGammaSharesPerDol = underlyingAgg.absGammaSharesPerDol ?? null;
    derived.absVegaPerVolPoint = underlyingAgg.absVegaPerVolPoint ?? null;

    derived.carryPerVega = underlyingAgg.carryPerVega ?? null;
    derived.carryPerGamma = underlyingAgg.carryPerGamma ?? null;
    derived.thetaOnMargin = underlyingAgg.thetaOnMargin ?? null;
    derived.vegaOnMargin = underlyingAgg.vegaOnMargin ?? null;
    derived.gammaOnMargin = underlyingAgg.gammaOnMargin ?? null;
    derived.carryToStress = this.computeCarryToStress(
      derived.totalThetaByUnderlying ?? null,
      underlyingAgg.uPnlUp1PctDol ??
        derived.uPnlUp1PctDol ??
        derived.pnlUp1PctDol ??
        null,
      underlyingAgg.uPnlDn1PctDol ??
        derived.uPnlDn1PctDol ??
        derived.pnlDn1PctDol ??
        null,
    );
  }

  private clearSummaryFields(
    derived: DerivedMetricsRow,
    meta: HoldingsIndexEntry,
  ): void {
    derived.totalGammaByUnderlying = null;
    derived.totalThetaByUnderlying = null;
    derived.totalVegaByUnderlying = null;
    derived.totalMarginReqByUnderlying = null;

    if (!isOption(meta.row)) {
      derived.gammaDensityNearTerm = null;
      derived.gammaDensityWeighted = null;
    }

    if (!isOption(meta.row)) {
      derived.optDeltaShares = null;
    }
  }

  refreshSummaryRowsFromUnderlyingAgg(
    holdingsIndex: HoldingsIndex,
    derivedByHoldings: Record<string, DerivedMetricsRow>,
    underlyingAgg: UnderlyingAggMap,
  ): void {
    for (const [holdingsKey, meta] of holdingsIndex.entries()) {
      const derived = derivedByHoldings[holdingsKey];
      if (!derived) continue;

      if (this.isSummaryRow(meta) && meta.underlyingKey) {
        const aggRow = underlyingAgg[meta.underlyingKey];
        this.enrichSummaryRow(derived, aggRow);
        derived.uPnlUp1PctDol =
          aggRow?.uPnlUp1PctDol ?? derived.uPnlUp1PctDol ?? null;
        derived.uPnlDn1PctDol =
          aggRow?.uPnlDn1PctDol ?? derived.uPnlDn1PctDol ?? null;
        derived.carryToStress = this.computeCarryToStress(
          derived.totalThetaByUnderlying ?? derived.thetaPerDay ?? null,
          derived.uPnlUp1PctDol ?? derived.pnlUp1PctDol ?? null,
          derived.uPnlDn1PctDol ?? derived.pnlDn1PctDol ?? null,
        );
      } else {
        derived.uPnlUp1PctDol = null;
        derived.uPnlDn1PctDol = null;
      }
    }
  }

  enrichWithConcentration(
    holdingsIndex: HoldingsIndex,
    derivedByHoldings: Record<string, DerivedMetricsRow>,
    portfolioAgg: PortfolioAgg,
  ): void {
    const totalAbsDeltaNotional =
      portfolioAgg?.totalAbsDeltaNotionalDol ?? null;
    const totalAbsVega = portfolioAgg?.totalAbsVegaPerVolPoint ?? null;

    for (const [holdingsKey] of holdingsIndex.entries()) {
      const derived = derivedByHoldings[holdingsKey];
      if (!derived) continue;

      const rowDeltaNotional = derived.deltaNotionalDol ?? null;
      if (
        rowDeltaNotional != null &&
        totalAbsDeltaNotional != null &&
        totalAbsDeltaNotional !== 0
      ) {
        derived.deltaNotionalConcentrationPct =
          Math.abs(rowDeltaNotional) / totalAbsDeltaNotional;
      } else {
        derived.deltaNotionalConcentrationPct = null;
      }

      const rowAbsVega =
        derived.absVegaPerVolPoint ??
        (derived.vegaPerVolPoint != null
          ? Math.abs(derived.vegaPerVolPoint)
          : null);
      if (rowAbsVega != null && totalAbsVega != null && totalAbsVega !== 0) {
        derived.vegaConcentrationPct = rowAbsVega / totalAbsVega;
      } else {
        derived.vegaConcentrationPct = null;
      }
    }
  }
}
