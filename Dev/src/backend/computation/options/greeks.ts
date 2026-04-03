/**
 * Greeks exposure aggregation across strikes.
 */
import type{ OptionsChain } from "shared/types/options";
import type {
  GreeksExposurePoint,
  GreeksExposureData,
  GreeksBasis,
} from "./types";
import { greekBasisScale } from "./chainHelpers";

export function computeGreeksExposure(
  chains: OptionsChain[],
  multiplier: number,
  underlyingPrice: number | null,
  basis: GreeksBasis = "mid",
): GreeksExposureData {
  const spot = underlyingPrice ?? 0;
  const delta: GreeksExposurePoint[] = [];
  const theta: GreeksExposurePoint[] = [];
  const vega: GreeksExposurePoint[] = [];
  const gamma: GreeksExposurePoint[] = [];
  const vanna: GreeksExposurePoint[] = [];
  const charm: GreeksExposurePoint[] = [];

  for (const chain of chains) {
    const callOI = chain.call?.oi ?? 0;
    const putOI = chain.put?.oi ?? 0;

    const callScale = greekBasisScale(chain.call, basis);
    const putScale = greekBasisScale(chain.put, basis);

    const callDelta =
      callOI * (chain.call?.delta ?? 0) * callScale * multiplier * spot;
    const putDelta = putOI * (chain.put?.delta ?? 0) * putScale * multiplier * spot;
    delta.push({
      strike: chain.strike,
      callVal: callDelta,
      putVal: putDelta,
      netVal: callDelta + putDelta,
    });

    const callTheta = callOI * (chain.call?.theta ?? 0) * callScale * multiplier;
    const putTheta = putOI * (chain.put?.theta ?? 0) * putScale * multiplier;
    theta.push({
      strike: chain.strike,
      callVal: callTheta,
      putVal: putTheta,
      netVal: callTheta + putTheta,
    });

    const callVega = callOI * (chain.call?.vega ?? 0) * callScale * multiplier;
    const putVega = putOI * (chain.put?.vega ?? 0) * putScale * multiplier;
    vega.push({
      strike: chain.strike,
      callVal: callVega,
      putVal: putVega,
      netVal: callVega + putVega,
    });

    const callGamma =
      (callOI * (chain.call?.gamma ?? 0) * callScale * spot * spot * multiplier) /
      100;
    const putGamma = -(
      (putOI * (chain.put?.gamma ?? 0) * putScale * spot * spot * multiplier) /
      100
    );
    gamma.push({
      strike: chain.strike,
      callVal: callGamma,
      putVal: putGamma,
      netVal: callGamma + putGamma,
    });

    const callVanna =
      spot > 0
        ? callOI *
          (((chain.call?.vega ?? 0) * callScale) / spot) *
          spot *
          multiplier
        : 0;
    const putVanna =
      spot > 0
        ? -(
            putOI *
            (((chain.put?.vega ?? 0) * putScale) / spot) *
            spot *
            multiplier
          )
        : 0;
    vanna.push({
      strike: chain.strike,
      callVal: callVanna,
      putVal: putVanna,
      netVal: callVanna + putVanna,
    });

    const callCharm =
      spot > 0
        ? callOI *
          (-((chain.call?.theta ?? 0) * callScale) / spot) *
          spot *
          multiplier
        : 0;
    const putCharm =
      spot > 0
        ? -(
            putOI *
            (-((chain.put?.theta ?? 0) * putScale) / spot) *
            spot *
            multiplier
          )
        : 0;
    charm.push({
      strike: chain.strike,
      callVal: callCharm,
      putVal: putCharm,
      netVal: callCharm + putCharm,
    });
  }

  return { delta, theta, vega, gamma, vanna, charm };
}
