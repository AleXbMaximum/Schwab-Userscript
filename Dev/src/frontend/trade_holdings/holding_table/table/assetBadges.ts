import type { AssetBadges } from "../types";

export const buildBadgeSignature = (
  badges: AssetBadges | null | undefined,
): string => {
  if (!badges) return "";
  return [
    badges.hasEquity ? "1" : "0",
    Number.isFinite(badges.buyPut) ? String(badges.buyPut) : "0",
    Number.isFinite(badges.sellPut) ? String(badges.sellPut) : "0",
    Number.isFinite(badges.buyCall) ? String(badges.buyCall) : "0",
    Number.isFinite(badges.sellCall) ? String(badges.sellCall) : "0",
  ].join(":");
};

export const buildBadgeMeasureText = (
  badges: AssetBadges | null | undefined,
): string => {
  if (!badges) return "";

  const groups: string[] = [];
  if (badges.hasEquity) groups.push("E");

  const buyPut = Math.max(
    0,
    Number.isFinite(badges.buyPut) ? badges.buyPut : 0,
  );
  const sellPut = Math.max(
    0,
    Number.isFinite(badges.sellPut) ? badges.sellPut : 0,
  );
  if (buyPut > 0 || sellPut > 0) {
    const putCounts = `${buyPut > 0 ? String(buyPut) : ""}${sellPut > 0 ? String(sellPut) : ""}`;
    groups.push(`P${putCounts}`);
  }

  const buyCall = Math.max(
    0,
    Number.isFinite(badges.buyCall) ? badges.buyCall : 0,
  );
  const sellCall = Math.max(
    0,
    Number.isFinite(badges.sellCall) ? badges.sellCall : 0,
  );
  if (buyCall > 0 || sellCall > 0) {
    const callCounts = `${buyCall > 0 ? String(buyCall) : ""}${sellCall > 0 ? String(sellCall) : ""}`;
    groups.push(`C${callCounts}`);
  }

  return groups.join(" ");
};
