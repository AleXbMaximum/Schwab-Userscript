import type{ OptionsExpiration } from "shared/types/options";
import { formatCompactNumber } from "shared/utils/format/formatters";
import { isDarkTheme } from "frontend/components/core/axTheme";

const MONTH_MAP: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

export function getExpOI(exp: OptionsExpiration): number {
  let total = 0;
  for (const c of exp.chains) total += (c.call?.oi ?? 0) + (c.put?.oi ?? 0);
  return total;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function parseMonthDayDet(exp: OptionsExpiration): {
  mm: string;
  dd: string;
  det: string;
} {
  const m = exp.label.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*\d{4}\s*\(([^)]+)\)/);
  if (m) {
    const mm =
      MONTH_MAP[m[1].slice(0, 3).toUpperCase()] ??
      m[1].slice(0, 2).padStart(2, "0");
    const dd = String(Number(m[2])).padStart(2, "0");
    const det = m[3] || exp.expirationType || "NA";
    return { mm, dd, det };
  }

  const d = new Date(exp.label);
  if (!Number.isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const det = d.toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
    });
    return { mm, dd, det };
  }

  return {
    mm: "??",
    dd: "??",
    det: exp.expirationType || "NA",
  };
}

export function expirationOptionLabel(
  exp: OptionsExpiration,
  oi: number,
): string {
  const { mm, dd, det } = parseMonthDayDet(exp);
  return `${mm} ${dd} (${exp.daysUntil}d (${det})) OI ${formatCompactNumber(oi)}`;
}

export function oiColors(
  oi: number,
  minOI: number,
  maxOI: number,
): { optionBg: string; optionFg: string; selectBg: string } {
  const span = Math.max(1, maxOI - minOI);
  const t = clamp01((oi - minOI) / span);
  if (isDarkTheme()) {
    const optionBg = `hsl(138 ${6 + t * 40}% ${14 + t * 12}%)`;
    const optionFg = `hsl(138 ${16 + t * 44}% ${74 + t * 14}%)`;
    const selectBg = `hsl(138 ${8 + t * 36}% ${16 + t * 10}%)`;
    return { optionBg, optionFg, selectBg };
  }
  const optionBg = `hsl(138 ${6 + t * 56}% ${100 - t * 18}%)`;
  const optionFg = `hsl(138 ${20 + t * 48}% ${24 + (1 - t) * 12}%)`;
  const selectBg = `hsl(138 ${10 + t * 48}% ${99 - t * 10}%)`;
  return { optionBg, optionFg, selectBg };
}
