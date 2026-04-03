import type{ OptionsChain, OptionsChainsResponse, OptionsLeg } from "shared/types/options";
import type { OptionCaptureStrikeLegRow } from "backend/core/db/capture/optionMonitorTypes";
import { blackScholes } from "../../math/blackScholes";

function midPrice(leg: OptionsLeg | null): number | null {
  if (!leg) return null;
  if (leg.bid != null && leg.ask != null && leg.bid > 0 && leg.ask > 0) {
    return (leg.bid + leg.ask) / 2;
  }
  if (leg.mark != null && leg.mark > 0) return leg.mark;
  if (leg.last != null && leg.last > 0) return leg.last;
  return null;
}

function spreadPct(leg: OptionsLeg | null): number | null {
  if (!leg || leg.bid == null || leg.ask == null || leg.bid <= 0) return null;
  const mid = (leg.bid + leg.ask) / 2;
  return mid > 0 ? (leg.ask - leg.bid) / mid : null;
}

export interface StrikeLegsBSFallback {
  riskFreeRate: number;
  daysToExpiry: number;
  dividendYield?: number;
}

function computeStrikeGex(
  leg: OptionsLeg | null,
  side: "C" | "P",
  spot: number,
  multiplier: number,
  strike?: number,
  bsFallback?: StrikeLegsBSFallback,
): number | null {
  if (!leg || leg.oi == null || spot <= 0) return null;

  let gamma = leg.gamma;

  // BS fallback when Schwab gamma is missing but IV is available
  if (
    (gamma == null || gamma === 0) &&
    bsFallback &&
    strike != null &&
    leg.iv != null &&
    leg.iv > 0
  ) {
    gamma = blackScholes({
      spot,
      strike,
      timeToExpiry: bsFallback.daysToExpiry / 365,
      riskFreeRate: bsFallback.riskFreeRate,
      iv: leg.iv,
      dividendYield: bsFallback.dividendYield,
    }).gamma;
  }

  if (gamma == null) return null;

  const raw = (leg.oi * gamma * spot * spot * multiplier) / 100;
  return side === "P" ? -raw : raw;
}

function buildLegRow(
  openingId: string,
  symbol: string,
  expiryLabel: string,
  dte: number,
  chain: OptionsChain,
  leg: OptionsLeg,
  side: "C" | "P",
  spot: number,
  multiplier: number,
  bsFallback?: StrikeLegsBSFallback,
): OptionCaptureStrikeLegRow {
  const callGex =
    side === "C"
      ? computeStrikeGex(leg, "C", spot, multiplier, chain.strike, bsFallback)
      : null;
  const putGex =
    side === "P"
      ? computeStrikeGex(leg, "P", spot, multiplier, chain.strike, bsFallback)
      : null;
  const netGex = callGex != null ? callGex : putGex != null ? putGex : null;

  return {
    openingId: openingId,
    symbol,
    expiryLabel: expiryLabel,
    dte,
    strike: chain.strike,
    optionType: side,
    bid: leg.bid,
    ask: leg.ask,
    last: leg.last,
    mark: leg.mark,
    vol: leg.vol,
    oi: leg.oi,
    iv: leg.iv,
    delta: leg.delta,
    gamma: leg.gamma,
    theta: leg.theta,
    vega: leg.vega,
    rho: leg.rho,
    intrinsic: leg.intrinsic,
    extrinsic: leg.extrinsic,
    theoVal: leg.theoVal,
    bidSize: leg.bidSize,
    askSize: leg.askSize,
    spreadPct: spreadPct(leg),
    midPrice: midPrice(leg),
    callGex: callGex,
    putGex: putGex,
    netGex: netGex,
  };
}

export function buildStrikeLegsRows(
  response: OptionsChainsResponse,
  openingId: string,
  symbol: string,
  bsFallbackConfig?: Omit<StrikeLegsBSFallback, "daysToExpiry">,
): OptionCaptureStrikeLegRow[] {
  const spot = response.underlyingPrice ?? 0;
  const multiplier = response.contractMultiplier;
  const rows: OptionCaptureStrikeLegRow[] = [];

  const lower = spot > 0 ? spot * 0.75 : 0;
  const upper = spot > 0 ? spot * 1.25 : Infinity;

  for (const exp of response.expirations) {
    const bsFallback: StrikeLegsBSFallback | undefined = bsFallbackConfig
      ? { ...bsFallbackConfig, daysToExpiry: exp.daysUntil }
      : undefined;

    for (const chain of exp.chains) {
      if (spot > 0 && (chain.strike < lower || chain.strike > upper)) continue;

      if (chain.call) {
        rows.push(
          buildLegRow(
            openingId,
            symbol,
            exp.label,
            exp.daysUntil,
            chain,
            chain.call,
            "C",
            spot,
            multiplier,
            bsFallback,
          ),
        );
      }
      if (chain.put) {
        rows.push(
          buildLegRow(
            openingId,
            symbol,
            exp.label,
            exp.daysUntil,
            chain,
            chain.put,
            "P",
            spot,
            multiplier,
            bsFallback,
          ),
        );
      }
    }
  }

  return rows;
}
