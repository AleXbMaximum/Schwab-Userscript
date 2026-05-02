/**
 * Performance collector — ring buffer aggregation with percentile computation.
 *
 * Records timing samples, computes P50/P95/P99 over rolling windows, exposes
 * devTools APIs via window.__alexquantPerf.
 *
 * Usage:
 *   recordSample("ingest.holdings.parse", 12.4);
 *   recordSlaViolation("chart.render.frame");
 *
 *   // In console:
 *   __alexquantPerf.snapshot()
 *   __alexquantPerf.windowStats("ingest.holdings.parse", 100)
 *   __alexquantPerf.csv()
 */
import { logService } from "../log/core/LogService";

const summaryLog = logService.namespace("audit.perf.summary");

const RING_CAPACITY = 10_000;
const SUMMARY_INTERVAL_MS = 60_000; // 60s periodic summary

interface RingBuffer {
  samples: Float64Array;
  count: number; // total samples ever added
  idx: number; // next write index (mod capacity)
}

function createRing(): RingBuffer {
  return { samples: new Float64Array(RING_CAPACITY), count: 0, idx: 0 };
}

function pushSample(ring: RingBuffer, value: number): void {
  ring.samples[ring.idx] = value;
  ring.idx = (ring.idx + 1) % RING_CAPACITY;
  ring.count++;
}

function getFilledSamples(ring: RingBuffer): Float64Array {
  const len = Math.min(ring.count, RING_CAPACITY);
  if (len === 0) return new Float64Array(0);
  if (ring.count <= RING_CAPACITY) {
    return ring.samples.slice(0, len);
  }
  const out = new Float64Array(RING_CAPACITY);
  const tail = RING_CAPACITY - ring.idx;
  out.set(ring.samples.subarray(ring.idx, RING_CAPACITY), 0);
  out.set(ring.samples.subarray(0, ring.idx), tail);
  return out;
}

function getWindowSamples(ring: RingBuffer, windowSize: number): Float64Array {
  const len = Math.min(ring.count, RING_CAPACITY);
  const n = Math.min(windowSize, len);
  if (n === 0) return new Float64Array(0);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const readIdx = (ring.idx - n + i + RING_CAPACITY) % RING_CAPACITY;
    out[i] = ring.samples[readIdx];
  }
  return out;
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

function computePercentiles(ring: RingBuffer): PercentileStats {
  const data = getFilledSamples(ring);
  data.sort();
  return {
    p50: percentile(data, 50),
    p95: percentile(data, 95),
    p99: percentile(data, 99),
    count: ring.count,
  };
}

function computeWindowPercentiles(
  ring: RingBuffer,
  windowSize: number,
): PercentileStats {
  const data = getWindowSamples(ring, windowSize);
  data.sort();
  return {
    p50: percentile(data, 50),
    p95: percentile(data, 95),
    p99: percentile(data, 99),
    count: data.length,
  };
}

const rings = new Map<string, RingBuffer>();
let summaryTimer: ReturnType<typeof setInterval> | null = null;
let collectorActive = false;

function getRing(label: string): RingBuffer {
  let ring = rings.get(label);
  if (!ring) {
    ring = createRing();
    rings.set(label, ring);
  }
  return ring;
}

/** Record a timing sample (typically ms) for a label. */
export function recordSample(label: string, durationMs: number): void {
  pushSample(getRing(label), durationMs);
  if (!collectorActive) {
    collectorActive = true;
    startSummaryTimer();
  }
}

/** Snapshot of all labels with percentile stats. */
function snapshot(): Record<string, PercentileStats> {
  const result: Record<string, PercentileStats> = {};
  for (const [label, ring] of rings) {
    result[label] = computePercentiles(ring);
  }
  return result;
}

/** Rolling-window percentiles for a specific label. */
function windowStats(
  label: string,
  windowSize: number,
): PercentileStats | null {
  const ring = rings.get(label);
  if (!ring) return null;
  return computeWindowPercentiles(ring, windowSize);
}

/** Export all data as CSV. */
function csv(): string {
  const snap = snapshot();
  const lines = ["label,p50,p95,p99,count"];
  for (const [label, stats] of Object.entries(snap)) {
    lines.push(
      `${label},${stats.p50.toFixed(2)},${stats.p95.toFixed(2)},${stats.p99.toFixed(2)},${stats.count}`,
    );
  }
  return lines.join("\n");
}

const slaViolationCounts = new Map<string, number>();

/** Record an SLA violation count for a metric (used by SLA monitors). */
export function recordSlaViolation(metric: string): void {
  slaViolationCounts.set(metric, (slaViolationCounts.get(metric) ?? 0) + 1);
}

function slaViolations(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of slaViolationCounts) result[k] = v;
  return result;
}

function emitSummary(): void {
  const snap = snapshot();
  if (Object.keys(snap).length === 0) return;
  summaryLog.info("periodic", { stats: snap });
}

function startSummaryTimer(): void {
  if (summaryTimer) return;
  summaryTimer = setInterval(emitSummary, SUMMARY_INTERVAL_MS);
}

/**
 * Wrap a function to record its execution time. Returns a wrapped fn with the same signature.
 *   const tracked = perfMark("ingest.holdings.parse", parseHoldings);
 */
export function perfMark<A extends unknown[], R>(
  label: string,
  fn: (...args: A) => R,
): (...args: A) => R {
  return (...args: A): R => {
    const start = performance.now();
    try {
      return fn(...args);
    } finally {
      recordSample(label, performance.now() - start);
    }
  };
}

/** Begin a manual timing span. Call the returned function to commit. */
export function perfStart(label: string): () => void {
  const start = performance.now();
  return () => {
    recordSample(label, performance.now() - start);
  };
}

/** Install devTools accessors on `window.__alexquantPerf`. */
export function installDevTools(): void {
  if (typeof window === "undefined") return;
  (window as any).__alexquantPerf = {
    snapshot,
    csv,
    windowStats,
    slaViolations,
  };
}

installDevTools();

export {
  snapshot,
  csv,
  windowStats,
  computeWindowPercentiles,
  getWindowSamples,
};
