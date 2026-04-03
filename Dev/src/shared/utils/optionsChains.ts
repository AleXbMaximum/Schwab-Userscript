import type{ OptionsChainsResponse, OptionsExpiration } from "shared/types/options";

function getExpirationOI(expiration: OptionsExpiration): number {
  let total = 0;
  for (const chain of expiration.chains) {
    total += (chain.call?.oi ?? 0) + (chain.put?.oi ?? 0);
  }
  return total;
}

/**
 * Remove expirations whose total OI is below 1% of the average. These rows are
 * often far-dated placeholders returned by Schwab.
 */
export function pruneLowOIExpirations(response: OptionsChainsResponse): void {
  if (response.expirations.length <= 1) return;
  const oiPerExp = response.expirations.map((expiration) =>
    getExpirationOI(expiration),
  );
  const avgOI = oiPerExp.reduce((a, b) => a + b, 0) / oiPerExp.length;
  const threshold = avgOI / 100;
  response.expirations = response.expirations.filter(
    (_expiration, i) => oiPerExp[i] >= threshold,
  );
}
