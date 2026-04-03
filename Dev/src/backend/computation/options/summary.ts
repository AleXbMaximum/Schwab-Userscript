/**
 * Summary metrics, pricing analysis, trading insights, key levels ladder,
 * and state vector computation.
 */
import type{ OptionsChain, OptionsChainsResponse, OptionsExpiration } from "shared/types/options";
import type {
  SummaryMetrics,
  PricingPoint,
  TradingInsightsData,
  TradingInsight,
  GexAnalytics,
  OptionsWallData,
  TermStructurePoint,
  ExpectedMoveData,
  KeyLevelsLadderData,
  ScenarioOutput,
  StateVectorData,
  EventFlag,
} from "./types";
import {
  computeMaxPain,
  findATMStrike,
  computeForwardPrice,
  compute25DeltaRR,
  keyLevelEntry,
} from "./chainHelpers";
import { computeTermStructure } from "./volatility";

export function computeSummaryMetrics(
  response: OptionsChainsResponse,
  selectedExpiration: OptionsExpiration | null,
): SummaryMetrics {
  const chains = selectedExpiration?.chains ?? [];
  let totalCallVolume = 0;
  let totalPutVolume = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (const c of chains) {
    totalCallVolume += c.call?.vol ?? 0;
    totalPutVolume += c.put?.vol ?? 0;
    totalCallOI += c.call?.oi ?? 0;
    totalPutOI += c.put?.oi ?? 0;
  }

  const pcRatioVolume =
    totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null;
  const pcRatioOI = totalCallOI > 0 ? totalPutOI / totalCallOI : null;
  const maxPainStrike = computeMaxPain(chains);
  const atmStrike = findATMStrike(chains, response.underlyingPrice);

  return {
    underlyingPrice: response.underlyingPrice,
    totalCallVolume,
    totalPutVolume,
    totalCallOI,
    totalPutOI,
    pcRatioVolume,
    pcRatioOI,
    maxPainStrike,
    atmStrike,
  };
}

export function computePricingAnalysis(chains: OptionsChain[]): PricingPoint[] {
  return chains.map((c) => ({
    strike: c.strike,
    callBid: c.call?.bid ?? null,
    callAsk: c.call?.ask ?? null,
    callMark: c.call?.mark ?? null,
    callLast: c.call?.last ?? null,
    callOI: c.call?.oi ?? null,
    callVol: c.call?.vol ?? null,
    callTheo: c.call?.theoVal ?? null,
    callIntrinsic: c.call?.intrinsic ?? null,
    callExtrinsic: c.call?.extrinsic ?? null,
    putBid: c.put?.bid ?? null,
    putAsk: c.put?.ask ?? null,
    putMark: c.put?.mark ?? null,
    putLast: c.put?.last ?? null,
    putOI: c.put?.oi ?? null,
    putVol: c.put?.vol ?? null,
    putTheo: c.put?.theoVal ?? null,
    putIntrinsic: c.put?.intrinsic ?? null,
    putExtrinsic: c.put?.extrinsic ?? null,
  }));
}

export function computeTradingInsights(
  metrics: SummaryMetrics,
  gexAnalytics: GexAnalytics,
  wallData: OptionsWallData,
  termStructure: TermStructurePoint[],
  expMoveData: ExpectedMoveData,
): TradingInsightsData {
  const insights: TradingInsight[] = [];
  let score = 0;
  const fmtLevel = (v: number): string => v.toFixed(2);

  const spot = metrics.underlyingPrice;

  if (gexAnalytics.isPositiveGamma) {
    insights.push({
      category: "regime",
      signal: "info",
      title: "Positive Gamma Environment",
      description:
        "Dealers are long gamma — they buy dips and sell rips, suppressing volatility. Mean-reversion strategies favored. Expect range-bound behavior near key strikes.",
    });
    score += 5;
  } else {
    insights.push({
      category: "regime",
      signal: "info",
      title: "Negative Gamma Environment",
      description:
        "Dealers are short gamma — they must sell into dips and buy into rallies, amplifying moves. Trend-following strategies favored. Watch for breakouts beyond key levels.",
    });
    score -= 5;
  }

  const pcOI = metrics.pcRatioOI;
  const pcVol = metrics.pcRatioVolume;

  if (pcOI != null) {
    if (pcOI > 1.3) {
      insights.push({
        category: "flow",
        signal: "bearish",
        title: `High Put/Call OI Ratio (${pcOI.toFixed(2)})`,
        description:
          "Put open interest dominates, indicating hedging or bearish positioning. However, extreme readings can be contrarian bullish if used as a sentiment indicator.",
      });
      score -= 10;
    } else if (pcOI < 0.7) {
      insights.push({
        category: "flow",
        signal: "bullish",
        title: `Low Put/Call OI Ratio (${pcOI.toFixed(2)})`,
        description:
          "Call open interest dominates, reflecting bullish positioning or call selling. Extreme readings can signal complacency.",
      });
      score += 10;
    } else {
      insights.push({
        category: "flow",
        signal: "neutral",
        title: `Balanced P/C OI Ratio (${pcOI.toFixed(2)})`,
        description:
          "Put and call open interest are roughly balanced. No strong directional signal from positioning.",
      });
    }
  }

  if (pcVol != null) {
    if (pcVol > 1.5) {
      insights.push({
        category: "flow",
        signal: "bearish",
        title: `Elevated Put Volume (P/C Vol: ${pcVol.toFixed(2)})`,
        description:
          "Today's put volume is significantly above call volume, suggesting active hedging or directional bearish bets.",
      });
      score -= 8;
    } else if (pcVol < 0.5) {
      insights.push({
        category: "flow",
        signal: "bullish",
        title: `Elevated Call Volume (P/C Vol: ${pcVol.toFixed(2)})`,
        description:
          "Today's call volume significantly exceeds put volume, suggesting bullish sentiment or speculative call buying.",
      });
      score += 8;
    }
  }

  if (spot != null && wallData.maxPainStrike != null) {
    const diff = spot - wallData.maxPainStrike;
    const pct = (diff / spot) * 100;
    if (Math.abs(pct) > 2) {
      const direction = diff > 0 ? "above" : "below";
      const pull = diff > 0 ? "downward" : "upward";
      insights.push({
        category: "levels",
        signal: diff > 0 ? "bearish" : "bullish",
        title: `Spot ${Math.abs(pct).toFixed(1)}% ${direction} Max Pain ($${fmtLevel(wallData.maxPainStrike)})`,
        description: `Price tends to gravitate toward max pain as expiration approaches, implying ${pull} pressure. This effect strengthens in the last 2-3 days before expiry.`,
      });
      score += diff > 0 ? -6 : 6;
    } else {
      insights.push({
        category: "levels",
        signal: "neutral",
        title: `Spot Near Max Pain ($${fmtLevel(wallData.maxPainStrike)})`,
        description:
          "Price is pinned near max pain, where dealer hedging flows are at equilibrium. Expect reduced directional movement near expiry.",
      });
    }
  }

  if (spot != null && gexAnalytics.flipPoint != null) {
    const flipDist = spot - gexAnalytics.flipPoint;
    const flipPct = (flipDist / spot) * 100;
    if (flipPct > 1) {
      insights.push({
        category: "regime",
        signal: "bullish",
        title: `Spot ${flipPct.toFixed(1)}% Above Gamma Flip ($${fmtLevel(gexAnalytics.flipPoint)})`,
        description:
          "Price sits comfortably in the positive gamma zone. Dealer hedging acts as a cushion. Dips toward the flip point may find support.",
      });
      score += 5;
    } else if (flipPct < -1) {
      insights.push({
        category: "regime",
        signal: "bearish",
        title: `Spot ${Math.abs(flipPct).toFixed(1)}% Below Gamma Flip ($${fmtLevel(gexAnalytics.flipPoint)})`,
        description:
          "Price is in the negative gamma zone. Moves are amplified by dealer hedging. A rally back above the flip point could stabilize price action.",
      });
      score -= 5;
    }
  }

  const gexPutWall = gexAnalytics.putWallStrike;
  if (spot != null && wallData.callWallStrike != null) {
    const callDist = ((wallData.callWallStrike - spot) / spot) * 100;

    if (callDist < 2 && callDist > 0) {
      insights.push({
        category: "levels",
        signal: "bearish",
        title: `Approaching Call Wall Resistance ($${fmtLevel(wallData.callWallStrike)})`,
        description: `Spot is only ${callDist.toFixed(1)}% from the highest call OI concentration. This level acts as a resistance ceiling where call sellers and delta hedgers create selling pressure.`,
      });
      score -= 4;
    }
  }
  if (spot != null && gexPutWall != null) {
    const putDist = ((spot - gexPutWall) / spot) * 100;
    if (putDist < 2 && putDist > 0) {
      insights.push({
        category: "levels",
        signal: "bullish",
        title: `Approaching Put Wall Support ($${fmtLevel(gexPutWall)})`,
        description: `Spot is only ${putDist.toFixed(1)}% from the highest dealer put gamma concentration. This level acts as a support floor where dealer gamma hedging creates buying pressure.`,
      });
      score += 4;
    }
  }

  const validTerm = termStructure.filter(
    (t) => t.avgIV != null && t.daysUntil > 0,
  );
  if (validTerm.length >= 2) {
    const nearIV = validTerm[0].avgIV!;
    const farIV = validTerm[validTerm.length - 1].avgIV!;
    const diff = nearIV - farIV;

    if (diff > 3) {
      insights.push({
        category: "volatility",
        signal: "bearish",
        title: "Inverted Term Structure (Backwardation)",
        description: `Near-term IV (${nearIV.toFixed(1)}%) exceeds far-term IV (${farIV.toFixed(1)}%) by ${diff.toFixed(1)} pts. This signals elevated near-term risk — a catalyst event, earnings, or stress is being priced in.`,
      });
      score -= 5;
    } else if (diff < -3) {
      insights.push({
        category: "volatility",
        signal: "neutral",
        title: "Normal Term Structure (Contango)",
        description: `Far-term IV (${farIV.toFixed(1)}%) exceeds near-term IV (${nearIV.toFixed(1)}%) — normal market conditions. Consider selling near-term premium or calendar spreads.`,
      });
    }
  }

  if (expMoveData.expectedMovePct != null) {
    const emPct = expMoveData.expectedMovePct;
    insights.push({
      category: "volatility",
      signal: "info",
      title: `Expected Move (Straddle-mid): \u00B1${emPct.toFixed(1)}% ($${expMoveData.expectedMove?.toFixed(2) ?? "--"})`,
      description: `ATM straddle-mid implies a \u00B1${emPct.toFixed(1)}% move by ${expMoveData.expLabel}. Range: $${expMoveData.lowerBound1Sigma?.toFixed(2) ?? "--"} \u2014 $${expMoveData.upperBound1Sigma?.toFixed(2) ?? "--"} (1\u03C3).`,
    });
  }

  score = Math.max(-100, Math.min(100, score));
  const overallBias: "bullish" | "bearish" | "neutral" =
    score > 10 ? "bullish" : score < -10 ? "bearish" : "neutral";

  return {
    insights,
    overallBias,
    biasScore: score,
    keyLevels: {
      putWall: gexAnalytics.putWallStrike,
      callWall: wallData.callWallStrike,
      maxPain: wallData.maxPainStrike,
      gammaFlip: gexAnalytics.flipPoint,
      spot: metrics.underlyingPrice,
    },
  };
}

export function computeKeyLevelsLadder(
  wallData: OptionsWallData,
  gexAnalytics: GexAnalytics,
  scenarioOutput: ScenarioOutput | null,
  scenarioActive: boolean,
): KeyLevelsLadderData {
  return {
    spot: wallData.underlyingPrice,
    entries: [
      keyLevelEntry(
        "putWall",
        "Put Wall",
        "GEX",
        gexAnalytics.putWallStrike,
        scenarioActive ? (scenarioOutput?.shiftedPutWall ?? null) : null,
        scenarioActive ? "Model" : null,
      ),
      keyLevelEntry(
        "flip",
        "Gamma Flip",
        "GEX",
        gexAnalytics.flipPoint,
        scenarioActive ? (scenarioOutput?.shiftedFlip ?? null) : null,
        scenarioActive ? "Model" : null,
      ),
      keyLevelEntry(
        "maxPain",
        "Max Pain",
        "OI",
        wallData.maxPainStrike,
        null,
        null,
      ),
      keyLevelEntry(
        "callWall",
        "Call Wall",
        "OI",
        wallData.callWallStrike,
        scenarioActive ? (scenarioOutput?.shiftedCallWall ?? null) : null,
        scenarioActive ? "Model" : null,
      ),
    ],
  };
}

export function computeStateVector(
  response: OptionsChainsResponse,
  expiration: OptionsExpiration,
  gexAnalytics: GexAnalytics,
  emData: ExpectedMoveData,
): StateVectorData {
  const spot = response.underlyingPrice;
  const dte = expiration.daysUntil;
  const forward = computeForwardPrice(
    spot,
    response.interestRate ?? null,
    response.dividendYield ?? null,
    dte,
  );

  const termData = computeTermStructure([expiration], spot);
  const atmIV = termData.length > 0 ? termData[0].avgIV : null;
  const skewMetric = compute25DeltaRR(expiration.chains);

  const eventFlags: EventFlag[] = [];

  return {
    spot,
    forward,
    forwardCarry: {
      rate: response.interestRate ?? null,
      divYield: response.dividendYield ?? null,
    },
    selectedExpiry: expiration.label.split(",")[0],
    dte,
    eventFlags,
    atmIV,
    skewMetric,
    impliedMove1Sigma: emData.expectedMove,
    impliedMovePct: emData.expectedMovePct,
    netGex: gexAnalytics.totalNetGex,
    gammaFlip: gexAnalytics.flipPoint,
    dataTimestamp: response.currentDateTime ?? new Date().toISOString(),
    isDelayed: response.isDelayed ?? false,
  };
}
