/**
 * Monitor universe selection — pure functions for choosing which expirations
 * to track per symbol based on the active MonitorUniverseMode.
 */

import {
  parseExpiryLabelToYmd,
  requestDateFromExpiryLabel,
  ymdToIsoDate,
  ymdToRequestDate,
  compareYmd,
  type Ymd,
} from "shared/utils/domain/optionsExpiries";
import type{ OptionsChainsResponse, OptionsExpiration } from "shared/types/options";
import type { ExpirySelectionContext } from "backend/computation/options/monitor/etl/ExpiryMetricsETL";
import {
  FIXED_SLOTS,
  type MonitorFixedSlot,
  type MonitorUniverseMode,
} from "./monitorSettings";
import { getCtYmd } from "./monitorCapture";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpiryUniverseItem = {
  requestDate: string;
  isoDate: string;
  expiryLabel: string;
  dte: number;
  totalOi: number;
  totalVol: number;
  slot: MonitorFixedSlot | null;
  rank: number | null;
};

export type SymbolUniverseCacheEntry = {
  ctDate: string;
  mode: MonitorUniverseMode;
  topN: number;
  items: ExpiryUniverseItem[];
};

export type SymbolRefreshContext = {
  response: OptionsChainsResponse;
  selectionContext: ExpirySelectionContext;
};

// ---------------------------------------------------------------------------
// Universe helpers
// ---------------------------------------------------------------------------

export function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

export function toCtDateKey(input: Date): string {
  const ymd = getCtYmd(input);
  if (!ymd) return "1970-01-01";
  return `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
}

export function sortByRecentThenDateAsc(
  a: ExpiryUniverseItem,
  b: ExpiryUniverseItem,
): number {
  if (a.dte !== b.dte) return a.dte - b.dte;
  const ymdA = parseExpiryLabelToYmd(a.expiryLabel);
  const ymdB = parseExpiryLabelToYmd(b.expiryLabel);
  if (!ymdA || !ymdB) return 0;
  return compareYmd(ymdA, ymdB);
}

export function expiryLiquidity(exp: OptionsExpiration): {
  totalOi: number;
  totalVol: number;
} {
  let totalOi = 0;
  let totalVol = 0;
  for (const chain of exp.chains) {
    totalOi += (chain.call?.oi ?? 0) + (chain.put?.oi ?? 0);
    totalVol += (chain.call?.vol ?? 0) + (chain.put?.vol ?? 0);
  }
  return { totalOi, totalVol };
}

export function toUniverseItem(
  exp: OptionsExpiration,
  slot: MonitorFixedSlot | null,
): ExpiryUniverseItem | null {
  const ymd = parseExpiryLabelToYmd(exp.label);
  if (!ymd) return null;
  const { totalOi, totalVol } = expiryLiquidity(exp);
  return {
    requestDate: ymdToRequestDate(ymd),
    isoDate: ymdToIsoDate(ymd),
    expiryLabel: exp.label,
    dte: exp.daysUntil,
    totalOi,
    totalVol,
    slot,
    rank: null,
  };
}

export function selectTopNUniverseItems(
  response: OptionsChainsResponse,
  topN: number,
): ExpiryUniverseItem[] {
  const candidates: ExpiryUniverseItem[] = [];
  for (const exp of response.expirations) {
    const item = toUniverseItem(exp, null);
    if (!item) continue;
    candidates.push(item);
  }
  candidates.sort((a, b) => {
    if (b.totalOi !== a.totalOi) return b.totalOi - a.totalOi;
    if (b.totalVol !== a.totalVol) return b.totalVol - a.totalVol;
    return sortByRecentThenDateAsc(a, b);
  });
  const deduped: ExpiryUniverseItem[] = [];
  const used = new Set<string>();
  for (const item of candidates) {
    if (used.has(item.requestDate)) continue;
    used.add(item.requestDate);
    deduped.push(item);
    if (deduped.length >= topN) break;
  }
  for (let i = 0; i < deduped.length; i++) {
    deduped[i].rank = i + 1;
  }
  return deduped;
}

export function pickFirst(
  entries: ExpiryUniverseItem[],
  predicate: (entry: ExpiryUniverseItem, ymd: Ymd) => boolean,
  compareFn: (a: ExpiryUniverseItem, b: ExpiryUniverseItem) => number,
): ExpiryUniverseItem | null {
  let best: ExpiryUniverseItem | null = null;
  for (const entry of entries) {
    const ymd = parseExpiryLabelToYmd(entry.expiryLabel);
    if (!ymd || !predicate(entry, ymd)) continue;
    if (!best || compareFn(entry, best) < 0) best = entry;
  }
  return best;
}

export function selectFixedSlotUniverseItems(
  response: OptionsChainsResponse,
  capturedAtUtc: string,
): ExpiryUniverseItem[] {
  const now = new Date(capturedAtUtc);
  const today = getCtYmd(now);
  if (!today) return [];

  const entries: ExpiryUniverseItem[] = [];
  for (const exp of response.expirations) {
    const item = toUniverseItem(exp, null);
    if (!item) continue;
    entries.push(item);
  }
  if (entries.length === 0) return [];

  const curQuarter = quarterOfMonth(today.month);
  const selectedBySlot = new Map<MonitorFixedSlot, ExpiryUniverseItem | null>();

  const nearestByDte = (a: ExpiryUniverseItem, b: ExpiryUniverseItem): number =>
    sortByRecentThenDateAsc(a, b);
  const latestByDate = (
    a: ExpiryUniverseItem,
    b: ExpiryUniverseItem,
  ): number => {
    const ymdA = parseExpiryLabelToYmd(a.expiryLabel);
    const ymdB = parseExpiryLabelToYmd(b.expiryLabel);
    if (!ymdA || !ymdB) return 0;
    return compareYmd(ymdB, ymdA);
  };
  const farthestByDte = (
    a: ExpiryUniverseItem,
    b: ExpiryUniverseItem,
  ): number => {
    if (a.dte !== b.dte) return b.dte - a.dte;
    return latestByDate(a, b);
  };

  selectedBySlot.set(
    "0dte",
    pickFirst(entries, (entry) => entry.dte === 0, nearestByDte),
  );
  selectedBySlot.set(
    "this_week",
    pickFirst(
      entries,
      (entry) => entry.dte >= 1 && entry.dte <= 7,
      nearestByDte,
    ),
  );
  selectedBySlot.set(
    "next_week",
    pickFirst(
      entries,
      (entry) => entry.dte >= 8 && entry.dte <= 14,
      nearestByDte,
    ),
  );
  selectedBySlot.set(
    "month_end",
    pickFirst(
      entries,
      (_entry, ymd) => ymd.year === today.year && ymd.month === today.month,
      latestByDate,
    ),
  );
  selectedBySlot.set(
    "quarter_end",
    pickFirst(
      entries,
      (_entry, ymd) =>
        ymd.year === today.year && quarterOfMonth(ymd.month) === curQuarter,
      latestByDate,
    ),
  );
  selectedBySlot.set(
    "year_end",
    pickFirst(entries, (_entry, ymd) => ymd.year === today.year, latestByDate),
  );
  selectedBySlot.set(
    "leap",
    pickFirst(entries, (entry) => entry.dte >= 365, farthestByDte),
  );

  const out: ExpiryUniverseItem[] = [];
  const usedDates = new Set<string>();
  for (const slot of FIXED_SLOTS) {
    const picked = selectedBySlot.get(slot);
    if (!picked) continue;
    if (usedDates.has(picked.requestDate)) continue;
    usedDates.add(picked.requestDate);
    out.push({ ...picked, slot });
  }
  out.sort(sortByRecentThenDateAsc);
  return out;
}

export function buildUniverseItems(
  response: OptionsChainsResponse,
  mode: MonitorUniverseMode,
  topN: number,
  capturedAtUtc: string,
): ExpiryUniverseItem[] {
  if (mode === "top_n") {
    return selectTopNUniverseItems(response, topN);
  }
  if (mode === "fixed_slots") {
    const fixed = selectFixedSlotUniverseItems(response, capturedAtUtc);
    if (fixed.length > 0) return fixed;
    return selectTopNUniverseItems(response, topN);
  }
  return [];
}

export function filterResponseByUniverse(
  response: OptionsChainsResponse,
  items: ExpiryUniverseItem[],
): OptionsChainsResponse {
  if (items.length === 0) return response;
  const requestedDates = new Set(items.map((item) => item.requestDate));
  const expirations = response.expirations.filter((exp) => {
    const requestDate = requestDateFromExpiryLabel(exp.label);
    return requestDate != null && requestedDates.has(requestDate);
  });
  return {
    ...response,
    expirations,
  };
}

export function buildSelectionContext(
  mode: MonitorUniverseMode,
  items: ExpiryUniverseItem[],
): ExpirySelectionContext {
  if (mode === "all" || items.length === 0) {
    return { mode: "all" };
  }
  const byRequestDate = new Map<
    string,
    { slot?: string | null; rank?: number | null }
  >();
  for (const item of items) {
    byRequestDate.set(item.requestDate, {
      slot: item.slot ?? null,
      rank: item.rank ?? null,
    });
  }
  return {
    mode,
    byRequestDate,
  };
}
