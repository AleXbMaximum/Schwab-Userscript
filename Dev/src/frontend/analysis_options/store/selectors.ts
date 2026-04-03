import type { DataQualityReport, VolSurfaceDiagnostics, LiquidityScoreData, StateVectorData } from "backend/computation/options/types";
import type { AlertItem, OptionsViewState } from "../types";
import type { SavedViewState } from "../savedView/savedViewTypes";

export function projectSavedViewState(state: OptionsViewState): SavedViewState {
  return {
    selectedExpirationIdx: state.selectedExpirationIdx,
    selectedStrikeCount: state.selectedStrikeCount,
    customExpirationIdxs: state.customExpirationIdxs,
    scopeMode: state.scopeMode,
    greeksBasis: state.greeksBasis,
    gammaSource: state.gammaSource,
    liquidityThreshold: state.liquidityThreshold,
    localWindowMode: state.localWindowMode,
    localWindowPct: state.localWindowPct,
    localWindowDeltaRange: state.localWindowDeltaRange,
    strikeMode: state.strikeMode,
    strikeDollarWidth: state.strikeDollarWidth,
    liquidityPreset: state.liquidityPreset,
    liquidityAdvanced: state.liquidityAdvanced,
    expectedMoveMode: state.expectedMoveMode,
    ivMetric: state.ivMetric,
    ivSlice: state.ivSlice,
  };
}

export function deriveAlerts(
  _quality: DataQualityReport,
  volDiag: VolSurfaceDiagnostics,
  liquidity: LiquidityScoreData,
  sv: StateVectorData,
): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (sv.isDelayed) {
    alerts.push({
      severity: "P0",
      reason: "Data is delayed / stale",
      cardId: "dataQuality",
      sectionId: "diagnostics",
    });
  }
  if (volDiag.missingPointPct > 30) {
    alerts.push({
      severity: "P0",
      reason: `${volDiag.missingPointPct.toFixed(0)}% vol surface points missing`,
      cardId: "dataQuality",
      sectionId: "diagnostics",
    });
  }
  if (liquidity.overallGrade === "D" || liquidity.overallGrade === "F") {
    alerts.push({
      severity: "P1",
      reason: `Low liquidity (grade ${liquidity.overallGrade})`,
      cardId: "dataQuality",
      sectionId: "diagnostics",
    });
  }
  if (
    volDiag.calendarViolations.length + volDiag.butterflyViolations.length >
    0
  ) {
    const count =
      volDiag.calendarViolations.length + volDiag.butterflyViolations.length;
    alerts.push({
      severity: "P1",
      reason: `${count} no-arb violation${count > 1 ? "s" : ""} detected`,
      cardId: "dataQuality",
      sectionId: "diagnostics",
    });
  }
  if (sv.netGex == null && sv.spot != null) {
    alerts.push({
      severity: "P1",
      reason: "GEX data unavailable",
      cardId: "walls",
      sectionId: "signal",
    });
  }

  return alerts;
}
