/**
 * Format a number as locale-aware USD currency, e.g. "$1,234" or "$1,234.56".
 * Zero is rendered as "$0" (not dash). This is the shared canonical formatter;
 * prefer it over inline `toLocaleString` calls.
 *
 * This is a pure formatting function — no share-mode logic.
 * Callers that display portfolio values should pre-scale with shareScaleValue().
 */
export function formatCurrencyLocale(
  value: number | null | undefined,
  decimals: number = 0,
): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number with locale grouping, e.g. "1,234" or "1,234.56".
 */
export function formatNumberLocale(
  value: number,
  decimals: number = 0,
): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export interface FormatSignedCurrencyOptions {
  /** Decimal places. Default: 2 */
  decimals?: number;
  /** Show '+' for positive values. Default: true */
  showPlus?: boolean;
  /** Null fallback. Default: '--' */
  nullText?: string;
}

export function formatSignedCurrencyLocale(
  value: number | null | undefined,
  options: FormatSignedCurrencyOptions = {},
): string {
  const { decimals = 2, showPlus = true, nullText = "--" } = options;

  if (value == null || !Number.isFinite(value)) return nullText;

  const sign = value < 0 ? "-" : showPlus && value > 0 ? "+" : "";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${formatted}`;
}

export interface CompactDollarOptions {
  /** Show sign prefix: '+'/'-'/'−'. Default: false */
  sign?: boolean;
  /** Use unicode minus '−' instead of '-'. Default: false */
  unicodeMinus?: boolean;
  /** Null fallback string. Default: '--' */
  nullText?: string;
  /** Include '$' prefix. Default: true */
  dollar?: boolean;
  /** Decimal places for M/B tiers. Default: 1 */
  decimals?: number;
}

/**
 * Format a number as compact dollar string, e.g. +$1.2M, -$340K, $99.
 * Handles T/B/M/K tiers with configurable sign display.
 */
export function formatCompactDollar(
  value: number | null | undefined,
  options: CompactDollarOptions = {},
): string {
  const {
    sign = false,
    unicodeMinus = false,
    nullText = "--",
    dollar = true,
    decimals = 1,
  } = options;

  if (value == null || !Number.isFinite(value)) return nullText;

  const abs = Math.abs(value);
  const minus = unicodeMinus ? "\u2212" : "-";
  const prefix = value < 0 ? minus : sign && value > 0 ? "+" : "";
  const d = dollar ? "$" : "";

  if (abs >= 1e12) return `${prefix}${d}${(abs / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9) return `${prefix}${d}${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${prefix}${d}${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${prefix}${d}${(abs / 1e3).toFixed(decimals)}K`;
  return `${prefix}${d}${abs.toFixed(0)}`;
}

/**
 * Format a number as compact string without dollar sign, e.g. 1.2M, 340K.
 */
export function formatCompactNumber(
  value: number | null | undefined,
  options: Omit<CompactDollarOptions, "dollar"> = {},
): string {
  return formatCompactDollar(value, { ...options, dollar: false });
}

/**
 * Format a strike price: $123.45 (2 decimals) or $123 (integer strikes).
 */
export function formatStrike(
  value: number | null | undefined,
  nullText = "--",
): string {
  if (value == null || !Number.isFinite(value)) return nullText;
  return `$${value.toFixed(2)}`;
}

export function formatNum(
  val: unknown,
  options: { decimals?: number; showSign?: boolean } = {},
): string {
  const { decimals = 2, showSign = false } = options;

  if (val == null) return "";
  const numVal = parseFloat(String(val));
  if (Number.isNaN(numVal)) return String(val);

  if (numVal === 0) return "";

  const s = numVal.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSign && numVal > 0 ? "+" + s : s;
}

export interface FormatPercentOptions {
  /** Decimal places. Default: 2 */
  decimals?: number;
  /** Show sign prefix. Default: false */
  showSign?: boolean;
  /** Multiply by 100 (ratio → display %). Default: true */
  multiply?: boolean;
  /** Null fallback. Default: '--' */
  nullText?: string;
}

/**
 * Canonical percentage formatter. All Pct-suffixed fields store ratios (0–1)
 * unless a caller explicitly passes `multiply: false`.
 *
 * Format a ratio (0–1) as percentage string, e.g. "12.30%", "+0.50%".
 * Pass `multiply: false` when the value is already in 0–100 form.
 */
export function formatPct(
  value: number | null | undefined,
  options: FormatPercentOptions = {},
): string {
  const {
    decimals = 2,
    showSign = false,
    multiply = true,
    nullText = "--",
  } = options;

  if (value == null || !Number.isFinite(value)) return nullText;

  const v = multiply ? value * 100 : value;
  const sign = showSign && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}
