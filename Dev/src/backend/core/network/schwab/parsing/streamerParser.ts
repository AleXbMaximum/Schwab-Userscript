// Normalize streamer numerics and percent-point fields without a deep traversal.
import type { StreamerUpdate } from "../../types";
import { pctPointsToRatio, toFiniteNumberOrNull } from "./numberParsers";

// isHardToBorrow and isShortable use -1 as a sentinel for "no data".
// Normalize to null/-1→null, 1→true, 0→false to match official semantics.
const BORROW_BOOL_KEYS = ["isHardToBorrow", "isShortable"] as const;

const PERCENT_KEYS = [
  "netPercentChange",
  "markPercentChange",
  "regularMarketPercentChange",
  "postMarketPercentChange",
  "dividendYield",
] as const;

const NUMERIC_KEYS = [
  "lastPrice",
  "bidPrice",
  "askPrice",
  "netChange",
  "mark",
  "lastSize",
  "bidSize",
  "askSize",
  "totalVolume",
] as const;

function normalizePercentField(
  update: Record<string, unknown>,
  key: string,
): void {
  if (!(key in update)) return;
  const ratio = pctPointsToRatio(update[key]);
  if (ratio == null) return;
  update[key] = ratio;
}

export function parseStreamerUpdate(raw: StreamerUpdate): StreamerUpdate {
  const update: Record<string, unknown> = { ...raw } as any;

  for (const k of BORROW_BOOL_KEYS) {
    if (!(k in update)) continue;
    const v = update[k];
    if (v === -1) update[k] = null;
    else if (v === 1) update[k] = true;
    else if (v === 0) update[k] = false;
  }

  for (const k of PERCENT_KEYS) normalizePercentField(update, k);

  for (const k of NUMERIC_KEYS) {
    if (!(k in update)) continue;
    const n = toFiniteNumberOrNull(update[k]);
    if (n != null) update[k] = n;
  }

  // Streamer updates are flat objects — use a shallow round instead of
  // the recursive normalizeNumbersDeepInPlace to avoid overhead.
  const DECIMALS = 6;
  const p = 10 ** DECIMALS;
  for (const k in update) {
    if (!Object.prototype.hasOwnProperty.call(update, k)) continue;
    const v = update[k];
    if (typeof v === "number" && Number.isFinite(v) && !Number.isInteger(v)) {
      const rounded = Math.round((v as number) * p) / p;
      update[k] = Object.is(rounded, -0) ? 0 : rounded;
    }
  }

  return update as StreamerUpdate;
}
