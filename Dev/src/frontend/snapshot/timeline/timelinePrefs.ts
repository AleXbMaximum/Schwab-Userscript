import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import type { SnapshotMetricKey, SnapshotRuntimePrefs, ChartRenderMode } from "./timelineTypes";

const KV_METRIC_KEY = "ui.accountSnapshotMetric";
const KV_TIME_RANGE_KEY = "ui.accountSnapshotTimeRange";
const KV_SMA_PERIOD_KEY = "ui.accountSnapshotSmaPeriod";
const KV_OVERLAY_INDICES_KEY = "ui.accountSnapshotOverlayIndices";
const KV_OVERLAY_BETA_KEY = "ui.accountSnapshotOverlayBeta";
const KV_CHART_MODE_KEY = "ui.accountSnapshotChartMode";
const KV_SMA2_PERIOD_KEY = "ui.accountSnapshotSma2Period";
const SETTINGS_KEY = "settings";
const SMA_OPTIONS = [0, 5, 9, 20, 50, 100] as const;

export {
  KV_METRIC_KEY,
  KV_TIME_RANGE_KEY,
  KV_SMA_PERIOD_KEY,
  KV_SMA2_PERIOD_KEY,
  KV_OVERLAY_INDICES_KEY,
  KV_OVERLAY_BETA_KEY,
  KV_CHART_MODE_KEY,
  SMA_OPTIONS,
};

export async function loadSnapshotRuntimePrefs(): Promise<SnapshotRuntimePrefs> {
  const fallback: SnapshotRuntimePrefs = { skipNightSession: true };
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    const [
      metric,
      timeRangeLabel,
      settings,
      smaPeriodRaw,
      sma2PeriodRaw,
      overlayIndicesRaw,
      overlayBetaRaw,
      chartModeRaw,
    ] = await Promise.all([
      kv.get<string>(KV_METRIC_KEY),
      kv.get<string>(KV_TIME_RANGE_KEY),
      kv.get<any>(SETTINGS_KEY),
      kv.get<string>(KV_SMA_PERIOD_KEY),
      kv.get<string>(KV_SMA2_PERIOD_KEY),
      kv.get<string[]>(KV_OVERLAY_INDICES_KEY),
      kv.get<boolean>(KV_OVERLAY_BETA_KEY),
      kv.get<string>(KV_CHART_MODE_KEY),
    ]);

    const parsedPeriod = Number(smaPeriodRaw);
    const smaPeriod = (SMA_OPTIONS as readonly number[]).includes(parsedPeriod)
      ? parsedPeriod
      : 0;
    const parsed2 = Number(sma2PeriodRaw);
    const sma2Period = (SMA_OPTIONS as readonly number[]).includes(parsed2) ? parsed2 : 0;

    const chartMode: ChartRenderMode | undefined =
      chartModeRaw === "line" || chartModeRaw === "candle" ? chartModeRaw : undefined;

    return {
      metric: metric as SnapshotMetricKey | undefined,
      timeRangeLabel,
      skipNightSession: settings?.accountSnapshotRecordNight !== true,
      smaPeriod,
      sma2Period,
      overlayIndices: Array.isArray(overlayIndicesRaw) ? overlayIndicesRaw : [],
      overlayBetaOffset: overlayBetaRaw === true,
      chartMode,
    };
  } catch {
    return fallback;
  }
}

export async function loadSkipNightSessionSetting(): Promise<boolean> {
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    const settings = await kv.get<any>(SETTINGS_KEY);
    return settings?.accountSnapshotRecordNight !== true;
  } catch {
    return true;
  }
}

export function saveSnapshotPref(key: string, value: unknown): void {
  void (async () => {
    try {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      await kv.set(key, value);
    } catch {}
  })();
}
