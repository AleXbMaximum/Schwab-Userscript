import { formatSignedCurrencyLocale } from "shared/utils/formatters";

export const formatOptionSymbol = (symbol: string): string => {
  const match = symbol.match(/^.+?\s+(\d{2})\/(\d{2})\/(\d{4})\s+(.+)$/);
  if (match) {
    const [, month, day, year, rest] = match;
    return `${year.slice(-2)}/${month}/${day} ${rest}`;
  }
  return symbol;
};

export const formatCurrency = (
  val: unknown,
  options: { decimals?: number; showSign?: boolean } = {},
): string => {
  const num = coerceNumber(val);
  if (num == null || num === 0) return "-";
  return formatSignedCurrencyLocale(num, {
    decimals: options.decimals ?? 2,
    showPlus: options.showSign ?? false,
    nullText: "-",
  });
};

export const formatPlainOrDash = (val: unknown): string => {
  if (val == null) return "-";
  const s = String(val).trim();
  return s.length > 0 ? s : "-";
};

export const formatQty = (val: unknown): string => {
  if (val == null) return "-";
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "-";
    if (val === 0) return "-";
    return val.toLocaleString();
  }
  const s = String(val).trim();
  if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "nan")
    return "-";
  return s;
};

export const normalizeSingleLine = (val: unknown): string => {
  if (val == null) return "-";
  const s = String(val).replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : "-";
};

const coerceNumber = (val: unknown): number | null => {
  const num = typeof val === "number" ? val : Number(val);
  return Number.isFinite(num) ? num : null;
};

export const formatSignedCurrencyFull = (val: unknown): string => {
  const num = coerceNumber(val);
  if (num == null) return "-";
  return formatSignedCurrencyLocale(num, {
    decimals: 2,
    nullText: "-",
  });
};
