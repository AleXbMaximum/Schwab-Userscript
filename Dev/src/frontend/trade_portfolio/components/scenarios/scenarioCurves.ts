import type { RiskMetrics } from "../../../../backend/computation/risk/RiskMetricsCalculator";

export type DrawdownCurvePoint = {
  marketMove: number;
  pnlDollar: number;
  pnlPct: number;
};

export function buildScenarioHeatmapData(scenarios: RiskMetrics["scenarios"]) {
  const marketMoves = [-5, -2, -1, 0, 1, 2, 5];
  const volMoves = [-10, -5, 0, 5, 10];
  const marketLabels = marketMoves.map(
    (move) => `Mkt ${move > 0 ? "+" : ""}${move}%`,
  );
  const volLabels = volMoves.map(
    (move) => `Vol ${move > 0 ? "+" : ""}${move}%`,
  );

  const pnlMatrix: number[][] = [];
  for (const marketMove of marketMoves) {
    const row: number[] = [];
    for (const volMove of volMoves) {
      const scenario = scenarios.find(
        (entry) => entry.marketMove === marketMove && entry.volMove === volMove,
      );
      row.push(scenario?.expectedPnl ?? 0);
    }
    pnlMatrix.push(row);
  }

  return { marketLabels, volLabels, pnlMatrix };
}

export function computeDrawdownCurveData(
  scenarios: RiskMetrics["scenarios"],
  volAssumption: number,
  marketValue: number,
): DrawdownCurvePoint[] {
  const marketUp1 = scenarios.find(
    (scenario) => scenario.name === "Market +1%",
  );
  const marketDn1 = scenarios.find(
    (scenario) => scenario.name === "Market -1%",
  );
  const pnlPerPctUp = marketUp1?.expectedPnl ?? 0;
  const pnlPerPctDn = marketDn1?.expectedPnl ?? 0;

  const vol5 = scenarios.find(
    (scenario) => scenario.marketMove === 0 && scenario.volMove === 5,
  );
  const vegaPerPoint = vol5 ? vol5.expectedPnl / 5 : 0;
  const volPnl = vegaPerPoint * volAssumption;

  const points: DrawdownCurvePoint[] = [];
  for (let move = -10; move <= 10; move++) {
    const marketPnl =
      move >= 0 ? pnlPerPctUp * move : pnlPerPctDn * Math.abs(move);
    const totalPnl = marketPnl + volPnl;
    const pnlPct = marketValue > 0 ? totalPnl / marketValue : 0;
    points.push({ marketMove: move, pnlDollar: totalPnl, pnlPct });
  }

  return points;
}
