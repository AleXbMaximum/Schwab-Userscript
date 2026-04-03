import type { BetaHorizon, ThreeFactorBundle } from "./types";

export function computeLinkedBenchmarkMoves(
  spxMove: number,
  threeFactorData: Map<string, ThreeFactorBundle> | null,
  byUnderlying: Record<string, { deltaNotionalDol?: number | null }>,
  horizon: BetaHorizon,
): { ndxMove: number; djiMove: number } {
  if (!threeFactorData || threeFactorData.size === 0) {
    return {
      ndxMove: Math.round(spxMove * 1.2 * 10) / 10,
      djiMove: Math.round(spxMove * 0.8 * 10) / 10,
    };
  }

  let weightedNdxRel = 0;
  let weightedDjiRel = 0;
  let totalWeight = 0;

  for (const [sym, bundle] of threeFactorData) {
    const result = bundle[horizon];
    if (!result) continue;
    const w = Math.abs(byUnderlying[sym]?.deltaNotionalDol ?? 0);
    if (w <= 0) continue;
    weightedNdxRel += result.betaNdxRel * w;
    weightedDjiRel += result.betaDjiRel * w;
    totalWeight += w;
  }

  if (totalWeight <= 0) {
    return {
      ndxMove: Math.round(spxMove * 1.2 * 10) / 10,
      djiMove: Math.round(spxMove * 0.8 * 10) / 10,
    };
  }

  const avgNdxRel = weightedNdxRel / totalWeight;
  const avgDjiRel = weightedDjiRel / totalWeight;

  const ndxMove = Math.round((spxMove + avgNdxRel * spxMove) * 10) / 10;
  const djiMove = Math.round((spxMove + avgDjiRel * spxMove) * 10) / 10;

  return { ndxMove, djiMove };
}
