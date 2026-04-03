import type{ OptionsChain, OptionsExpiration, OptionsLeg } from "shared/types/options";
import type { ScopeMode } from "../types";
import type { OptionsSavedView } from "./savedViewTypes";

export function normalizeScopeMode(
  mode: ScopeMode | "selected" | "custom" | string | undefined,
): ScopeMode {
  if (mode === "single" || mode === "multi" || mode === "all") return mode;
  if (mode === "selected") return "single";
  if (mode === "custom") return "multi";
  return "single";
}

export function decodeSavedView(encoded: string): OptionsSavedView | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || parsed.version !== 1) return null;
    return parsed as OptionsSavedView;
  } catch {
    return null;
  }
}

export function compactLegForCopy(
  leg: OptionsLeg | null,
): Record<string, string | number | null> | null {
  if (!leg) return null;
  return {
    sym: leg.sym,
    bid: leg.bid,
    ask: leg.ask,
    mark: leg.mark,
    vol: leg.vol,
    oi: leg.oi,
    iv: leg.iv,
    delta: leg.delta,
    gamma: leg.gamma,
    theta: leg.theta,
    vega: leg.vega,
  };
}

export function compactChainsForCopy(
  chains: OptionsChain[],
): Array<Record<string, unknown>> {
  return chains.map((chain) => ({
    strike: chain.strike,
    call: compactLegForCopy(chain.call),
    put: compactLegForCopy(chain.put),
  }));
}

export function summarizeExpirationForCopy(
  expiration: OptionsExpiration,
): Record<string, unknown> {
  let callOi = 0;
  let putOi = 0;
  let callVol = 0;
  let putVol = 0;
  for (const chain of expiration.chains) {
    callOi += chain.call?.oi ?? 0;
    putOi += chain.put?.oi ?? 0;
    callVol += chain.call?.vol ?? 0;
    putVol += chain.put?.vol ?? 0;
  }
  return {
    label: expiration.label,
    daysUntil: expiration.daysUntil,
    expirationType: expiration.expirationType,
    chainCount: expiration.chains.length,
    callOi,
    putOi,
    callVol,
    putVol,
  };
}

export function formatTimeLabel(iso: string): string {
  if (!iso) return "--";
  const schwab = iso.match(
    /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*(?:ET|EDT|EST),?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/i,
  );
  if (schwab) {
    let h = parseInt(schwab[1], 10);
    const min = schwab[2];
    const sec = schwab[3];
    const ap = schwab[4].toUpperCase();
    const mo = schwab[5];
    const day = schwab[6];
    const year = schwab[7];
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    h = (h + 23) % 24;
    const ctAP = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${mo}/${day}/${year}, ${h12}:${min}:${sec} ${ctAP} CT`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}
