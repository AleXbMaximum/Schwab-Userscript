import type {
  OptionCaptureMetaRow,
  SessionSegment,
} from "backend/core/db/capture/optionMonitorTypes";
import { CaptureLabelStore } from "backend/core/db/capture/CaptureLabelStore";
import { parseMarketTimeCTToMinutes } from "shared/utils/time";
import { logReturns, annualizedRV } from "shared/utils/math/timeSeries";

/** Structural type for the store dependency — both CaptureMetaStore and CaptureSnapshotStore satisfy this. */
interface MetaLikeRow {
  openingId: string;
  symbol: string;
  capturedAtUtc: string;
  underlyingPrice: number | null;
}
interface MetaLikeStore {
  findNearestBefore(
    symbol: string,
    targetMs: number,
    toleranceMs: number,
  ): Promise<MetaLikeRow | null>;
  getBySymbol(symbol: string): Promise<MetaLikeRow[]>;
}

const LOOKBACK_WINDOWS = [
  { field: "fwdRet10m" as const, ms: 10 * 60_000, tolerance: 3 * 60_000 },
  { field: "fwdRet30m" as const, ms: 30 * 60_000, tolerance: 5 * 60_000 },
  { field: "fwdRet60m" as const, ms: 60 * 60_000, tolerance: 10 * 60_000 },
];

function deriveSessionSegment(marketTimeCT: string): SessionSegment {
  const totalMin = parseMarketTimeCTToMinutes(marketTimeCT) ?? 0;

  if (totalMin < 570) return "open"; // before 09:30 CT
  if (totalMin >= 840) return "close"; // 14:00+ CT
  return "mid";
}

export async function backfillLabels(
  currentMeta: OptionCaptureMetaRow,
  metaStore: MetaLikeStore,
  labelStore: CaptureLabelStore,
): Promise<void> {
  const currentSpot = currentMeta.underlyingPrice;
  if (currentSpot == null || currentSpot <= 0) return;

  const currentMs = new Date(currentMeta.capturedAtUtc).getTime();

  for (const w of LOOKBACK_WINDOWS) {
    const targetMs = currentMs - w.ms;
    const pastMeta = await metaStore.findNearestBefore(
      currentMeta.symbol,
      targetMs,
      w.tolerance,
    );
    if (
      !pastMeta ||
      pastMeta.underlyingPrice == null ||
      pastMeta.underlyingPrice <= 0
    )
      continue;

    const fwdRet =
      (currentSpot - pastMeta.underlyingPrice) / pastMeta.underlyingPrice;
    await labelStore.patchField(
      pastMeta.openingId,
      pastMeta.symbol,
      w.field,
      fwdRet,
    );

    if (w.field === "fwdRet30m") {
      await labelStore.patchField(
        pastMeta.openingId,
        pastMeta.symbol,
        "fwdAbsRet30m",
        Math.abs(fwdRet),
      );
    }
    if (w.field === "fwdRet60m") {
      await labelStore.patchField(
        pastMeta.openingId,
        pastMeta.symbol,
        "fwdAbsRet60m",
        Math.abs(fwdRet),
      );
    }
  }

  await backfillRealizedVol(currentMeta, currentMs, metaStore, labelStore);
}

async function backfillRealizedVol(
  currentMeta: OptionCaptureMetaRow,
  currentMs: number,
  metaStore: MetaLikeStore,
  labelStore: CaptureLabelStore,
): Promise<void> {
  const allMeta = await metaStore.getBySymbol(currentMeta.symbol);
  const sorted = allMeta
    .filter((m) => m.underlyingPrice != null && m.underlyingPrice > 0)
    .sort(
      (a, b) =>
        new Date(a.capturedAtUtc).getTime() -
        new Date(b.capturedAtUtc).getTime(),
    );

  for (const window of [
    { minutes: 30, field: "rv30m" as const },
    { minutes: 60, field: "rv60m" as const },
  ]) {
    const windowMs = window.minutes * 60_000;
    const windowStart = currentMs - windowMs;

    const inWindow = sorted.filter((m) => {
      const ms = new Date(m.capturedAtUtc).getTime();
      return ms >= windowStart && ms <= currentMs;
    });

    if (inWindow.length < 2) continue;

    const prices = inWindow.map((m) => m.underlyingPrice!);
    const rets = logReturns(prices);
    if (rets.length === 0) continue;

    const rv = annualizedRV(rets, 252 * 39); // 39 ten-min periods per day

    await labelStore.patchField(
      currentMeta.openingId,
      currentMeta.symbol,
      window.field,
      rv,
    );
  }
}

export async function createInitialLabel(
  meta: OptionCaptureMetaRow,
  labelStore: CaptureLabelStore,
): Promise<void> {
  const row = await labelStore.getOrCreate(meta.openingId, meta.symbol);
  row.sessionSegment = deriveSessionSegment(meta.marketTimeCt);
  await labelStore.put(row);
}
