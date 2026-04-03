import type{ HoldingsRow } from "../types/holdings";
import type{ HoldingsKey, InstrumentKind, UnderlyingKey } from "../types/derived";

export const DEFAULT_OPTION_MULTIPLIER = 100;

export type OptionContractMeta = {
  underlying: string;
  expDate: string;
  dte: number | null;
  strike: number;
  callPut: "C" | "P";
  multiplier: number;
};

const toYmdUtc = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dteFromYmdUtc = (ymd: string): number | null => {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d))
    return null;
  const expUtc = Date.UTC(y, mo - 1, d);
  const now = new Date();
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.floor((expUtc - nowUtc) / (24 * 60 * 60 * 1000));
};

const parseYmdFromYyMmDd = (
  yy: string,
  mm: string,
  dd: string,
): string | null => {
  const y2 = Number(yy);
  const m2 = Number(mm);
  const d2 = Number(dd);
  if (!Number.isFinite(y2) || !Number.isFinite(m2) || !Number.isFinite(d2))
    return null;
  const fullY = 2000 + y2;
  const date = new Date(Date.UTC(fullY, m2 - 1, d2));

  if (
    date.getUTCFullYear() !== fullY ||
    date.getUTCMonth() !== m2 - 1 ||
    date.getUTCDate() !== d2
  )
    return null;
  return toYmdUtc(date);
};

const parseYmdFromMdY = (
  mm: string,
  dd: string,
  yearRaw: string,
): string | null => {
  const m2 = Number(mm);
  const d2 = Number(dd);
  let y2 = Number(yearRaw);
  if (!Number.isFinite(m2) || !Number.isFinite(d2) || !Number.isFinite(y2))
    return null;
  if (yearRaw.length === 2) y2 = 2000 + y2;
  const date = new Date(Date.UTC(y2, m2 - 1, d2));
  if (
    date.getUTCFullYear() !== y2 ||
    date.getUTCMonth() !== m2 - 1 ||
    date.getUTCDate() !== d2
  )
    return null;
  return toYmdUtc(date);
};

const parseStrikeFromOccInt = (strike8: string): number | null => {
  const n = Number(strike8);
  if (!Number.isFinite(n)) return null;
  return n / 1000;
};

export function parseOptionContractMeta(
  row: HoldingsRow,
): OptionContractMeta | null {
  const rawSym = (row?.dataSymbol ?? row?.symbol?.symbol ?? "")
    .toString()
    .trim();
  if (!rawSym) return null;

  const occ = rawSym.match(/^([A-Z0-9.]{1,15})\s+(\d{6})([CP])(\d{8})$/);
  if (occ) {
    const underlying = occ[1];
    const ymd = parseYmdFromYyMmDd(
      occ[2].slice(0, 2),
      occ[2].slice(2, 4),
      occ[2].slice(4, 6),
    );
    const callPut = occ[3] as "C" | "P";
    const strike = parseStrikeFromOccInt(occ[4]);
    if (ymd && strike != null) {
      return {
        underlying,
        expDate: ymd,
        dte: dteFromYmdUtc(ymd),
        strike,
        callPut,
        multiplier: DEFAULT_OPTION_MULTIPLIER,
      };
    }
  }

  const tokens = rawSym.replace(/\s+/g, " ").trim();

  const withUnd = tokens.match(
    /^([A-Z0-9.]{1,15})\s+(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d+(?:\.\d+)?)\s+([CP])$/,
  );
  if (withUnd) {
    const underlying = withUnd[1];
    const ymd = parseYmdFromMdY(withUnd[2], withUnd[3], withUnd[4]);
    const strike = Number(withUnd[5]);
    const callPut = withUnd[6] as "C" | "P";
    if (ymd && Number.isFinite(strike)) {
      return {
        underlying,
        expDate: ymd,
        dte: dteFromYmdUtc(ymd),
        strike,
        callPut,
        multiplier: DEFAULT_OPTION_MULTIPLIER,
      };
    }
  }

  const ymdLike = tokens.match(
    /^(\d{2})\/(\d{2})\/(\d{2})\s+(\d+(?:\.\d+)?)\s+([CP])$/,
  );
  if (ymdLike) {
    const ymd = parseYmdFromYyMmDd(ymdLike[1], ymdLike[2], ymdLike[3]);
    const strike = Number(ymdLike[4]);
    const callPut = ymdLike[5] as "C" | "P";
    if (ymd && Number.isFinite(strike)) {
      return {
        underlying: "",
        expDate: ymd,
        dte: dteFromYmdUtc(ymd),
        strike,
        callPut,
        multiplier: DEFAULT_OPTION_MULTIPLIER,
      };
    }
  }

  return null;
}

export function getInstrumentKind(row: HoldingsRow): InstrumentKind {
  if (isOption(row)) return "OPTION";

  const sym = row?.symbol?.symbol ?? row?.dataSymbol ?? "";
  if (typeof sym === "string" && sym.startsWith("$")) return "INDEX";

  if (row?.securityType != null) return "EQUITY";

  return "OTHER";
}

export function isOption(row: HoldingsRow): boolean {
  return (
    row?.securityType === 4 ||
    row?.symbol?.secGrpCd === "OPTION" ||
    row?.symbol?.isEqtOpt === true
  );
}

/** Returns true if a raw symbol string is an OCC-format options contract. */
export function isOptionSymbol(sym: string): boolean {
  return /\s\s+\d{6}[CP]\d{8}$/i.test(sym) || /\d{6}[CP]\d{8}$/i.test(sym);
}

export function getStreamingKey(row: HoldingsRow): string | null {
  const kind = getInstrumentKind(row);
  if (kind === "OPTION" && row?.dataSymbol) return row.dataSymbol.trim() || null;
  const sym = (row?.symbol?.symbol ?? row?.dataSymbol) || null;
  return sym ? sym.trim() || null : null;
}

export function getHoldingsKey(row: HoldingsRow): HoldingsKey {
  return getStreamingKey(row) ?? row?.dataSymbol ?? row?.symbol?.symbol ?? "";
}

export function getUnderlyingKey(
  row: HoldingsRow,
  parentEquitySymbol?: string | null,
): UnderlyingKey | null {
  const kind = getInstrumentKind(row);
  if (kind === "OPTION") {
    if (parentEquitySymbol && parentEquitySymbol.trim())
      return parentEquitySymbol.trim();

    const meta = parseOptionContractMeta(row);
    if (meta?.underlying && meta.underlying.trim())
      return meta.underlying.trim();
    return null;
  }

  const sym = row?.symbol?.symbol ?? row?.dataSymbol;
  if (typeof sym === "string" && sym.trim()) {
    return sym.trim();
  }

  return null;
}
