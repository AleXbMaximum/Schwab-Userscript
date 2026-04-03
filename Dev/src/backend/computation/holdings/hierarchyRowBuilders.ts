import type{ HoldingsRow } from "../../../shared/types/holdings";
import type{
  DerivedState,
  HoldingsBlock,
  HoldingsKey,
  TickerBlock,
  UnderlyingAggRow,
  UnderlyingKey,
  WarningState,
} from "../../../shared/types/derived";
import {
  getHoldingsKey,
  getUnderlyingKey,
  getInstrumentKind,
  parseOptionContractMeta,
} from "../../../shared/utils/holdingsKeys";
import {
  extractPrice,
  extractQty,
} from "./valueExtractors";

export type TickerBucket = {
  equityInfoRow: HoldingsRow | null;
  positions: { row: HoldingsRow; holdingsKey: HoldingsKey }[];
};

/** Shorten verbose Schwab-generated symbol labels for compact display. */
const SYMBOL_ALIASES: Record<string, string> = {
  "Futures Positions Market Value": "FMktV",
  "Futures Cash": "FCash",
};

function extractSymbol(row: HoldingsRow): string | null {
  const sym = (row as any)?.symbol?.symbol ?? (row as any)?.dataSymbol ?? null;
  return typeof sym === "string" && sym.trim() ? sym.trim() : null;
}

function createEmptyAggRow(underlyingKey: UnderlyingKey): UnderlyingAggRow {
  return {
    underlyingKey,
    totalDeltaShares: 0,
    totalOptDeltaShares: 0,
    totalGammaSharesPerDol: 0,
    totalThetaPerDay: 0,
    totalVegaPerVolPoint: 0,
    underlyingPrice: null,
  };
}

export function processRow(
  row: HoldingsRow,
  parentSymbol: string | null,
  tickerMap: Map<UnderlyingKey, TickerBucket>,
): void {
  const holdingsKey = getHoldingsKey(row);
  if (!holdingsKey) return;

  const rawKey =
    getUnderlyingKey(row, parentSymbol) ?? extractSymbol(row) ?? "UNKNOWN";
  const underlyingKey = SYMBOL_ALIASES[rawKey] ?? rawKey;
  const kind = getInstrumentKind(row);

  if (!tickerMap.has(underlyingKey)) {
    tickerMap.set(underlyingKey, {
      equityInfoRow: null,
      positions: [],
    });
  }

  const bucket = tickerMap.get(underlyingKey)!;

  if (kind !== "OPTION" && !bucket.equityInfoRow) {
    bucket.equityInfoRow = row;
  }

  bucket.positions.push({ row, holdingsKey });
}

export function buildTickerBlock(
  underlyingKey: UnderlyingKey,
  equityInfoRow: HoldingsRow | null,
  positions: { row: HoldingsRow; holdingsKey: HoldingsKey }[],
  derivedState: DerivedState,
  warningState?: WarningState | null,
): TickerBlock {
  const aggregated =
    derivedState.byUnderlying?.[underlyingKey] ??
    createEmptyAggRow(underlyingKey);
  const underlyingPrice =
    extractPrice(equityInfoRow) ?? aggregated.underlyingPrice ?? null;

  const holdingsBlocks: HoldingsBlock[] = [];
  const assetBadges = {
    hasEquity: false,
    buyPut: 0,
    sellPut: 0,
    buyCall: 0,
    sellCall: 0,
  };

  for (const { row, holdingsKey } of positions) {
    const derived = derivedState.byHoldingsKey?.[holdingsKey] ?? null;
    const warnings = warningState?.byHoldingsKey?.[holdingsKey] ?? null;
    const kind = getInstrumentKind(row);

    let optionMeta: HoldingsBlock["optionMeta"] = null;
    if (kind === "OPTION") {
      const meta = parseOptionContractMeta(row);
      if (meta) {
        optionMeta = {
          expDate: meta.expDate ?? "",
          strike: meta.strike ?? 0,
          callPut: meta.callPut as "C" | "P",
          dte: derived?.dte ?? 0,
        };

        const qty = extractQty(row);
        const isShort = typeof qty === "number" && qty < 0;
        if (meta.callPut === "P") {
          if (isShort) assetBadges.sellPut++;
          else assetBadges.buyPut++;
        } else if (meta.callPut === "C") {
          if (isShort) assetBadges.sellCall++;
          else assetBadges.buyCall++;
        }
      }
    } else if (kind === "EQUITY") {
      const qty = extractQty(row);
      if (typeof qty === "number" && qty !== 0) {
        assetBadges.hasEquity = true;
      } else {
        continue;
      }
    }

    holdingsBlocks.push({
      holdingsKey,
      row,
      derived,
      warnings,
      kind,
      optionMeta,
    });
  }

  holdingsBlocks.sort((a, b) => {
    if (a.kind !== "OPTION" && b.kind === "OPTION") return -1;
    if (a.kind === "OPTION" && b.kind !== "OPTION") return 1;
    if (a.optionMeta && b.optionMeta) {
      const expCmp = a.optionMeta.expDate.localeCompare(b.optionMeta.expDate);
      if (expCmp !== 0) return expCmp;
      return a.optionMeta.strike - b.optionMeta.strike;
    }
    return 0;
  });

  return {
    underlyingKey,
    underlyingPrice,
    aggregated,
    equityInfoRow,
    holdings: holdingsBlocks,
    assetBadges,
  };
}
