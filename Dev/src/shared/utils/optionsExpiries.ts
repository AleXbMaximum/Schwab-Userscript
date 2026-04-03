export type Ymd = {
  year: number;
  month: number;
  day: number;
};

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad2(v: number): string {
  return String(v).padStart(2, "0");
}

export function parseExpiryLabelToYmd(label: string): Ymd | null {
  if (!label) return null;
  const m = String(label)
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = MONTH_MAP[m[1].slice(0, 3).toLowerCase()];
  const day = Number.parseInt(m[2], 10);
  const year = Number.parseInt(m[3], 10);
  if (!month || !Number.isInteger(day) || !Number.isInteger(year)) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

export function ymdToIsoDate(ymd: Ymd): string {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

export function ymdToRequestDate(ymd: Ymd): string {
  return `${ymd.month}/${ymd.day}/${ymd.year}`;
}

export function requestDateFromExpiryLabel(label: string): string | null {
  const ymd = parseExpiryLabelToYmd(label);
  return ymd ? ymdToRequestDate(ymd) : null;
}

export function compareYmd(a: Ymd, b: Ymd): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}
