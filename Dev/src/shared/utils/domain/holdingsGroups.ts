import type { HoldingsGroup, HoldingsRow } from "../../types/holdings";

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRowSymbol(row: HoldingsRow | null | undefined): string | null {
  if (!row) return null;
  return normalizeSymbol(row.symbol?.symbol) ?? normalizeSymbol(row.dataSymbol);
}

export function extractEtfUnderlyingKeysFromGroups(
  groupedPositions: HoldingsGroup[] | null | undefined,
): Set<string> {
  const keys = new Set<string>();

  for (const group of groupedPositions ?? []) {
    if (!/etf/i.test(group.groupName ?? "")) continue;

    for (const row of group.holdingsRows ?? []) {
      const symbol = resolveRowSymbol(row);
      if (symbol) keys.add(symbol);
    }
  }

  return keys;
}
