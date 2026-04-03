/**
 * Default log configuration.
 *
 * Two operational modes:
 *   - INFO mode (daily): shows error / warn / info across all namespaces.
 *     High-frequency flow namespaces (flow:*) are off to reduce noise.
 *   - DEBUG mode: shows everything including debug-level messages.
 *     Activated at runtime via  window.__alexquantLog.debug()
 *
 * Namespace registry:
 *   main        - App bootstrap, lifecycle
 *   network     - HTTP requests, API calls
 *   storage     - IndexedDB, KV store
 *   stats       - Derived-state pipeline
 *   render      - Page rendering, view switches
 *   ui          - UI components, interactions
 *   ai          - AI analysis pipeline
 *   auth        - Authentication, token refresh
 *   streamer    - WebSocket streaming
 *   worker      - Web Worker pool
 *   compute     - General computation
 *   risk        - Risk metrics calculation
 *   options     - Options chain processing
 *   holdings    - Holdings aggregation, hierarchy
 *   pipeline    - Backend orchestrator, polling
 *   chart       - Chart data service
 *   news        - News fetching, lifecycle
 *   phase       - Phase transitions
 *   flow:hold   - Holdings ingestion flow (high-freq)
 *   flow:quote  - Quote ingestion flow (high-freq)
 *   flow:strm   - Streamer ingestion flow (high-freq)
 *   flow:over   - Overnight ingestion flow (high-freq)
 */

const NS_INFO = "info";
const NS_OFF = "off";

/** Per-namespace level map for INFO mode (daily operation). */
const INFO_MODE_LEVELS: Record<string, string> = {
  main: NS_INFO,
  network: NS_INFO,
  storage: NS_INFO,
  stats: NS_INFO,
  telemetry: NS_INFO,
  render: NS_INFO,
  compute: NS_INFO,
  ui: NS_INFO,
  ai: NS_INFO,
  auth: NS_INFO,
  streamer: NS_INFO,
  worker: NS_INFO,
  risk: NS_INFO,
  options: NS_INFO,
  holdings: NS_INFO,
  pipeline: NS_INFO,
  chart: NS_INFO,
  news: NS_INFO,
  phase: NS_INFO,
  "flow:hold": NS_OFF,
  "flow:quote": NS_OFF,
  "flow:strm": NS_OFF,
  "flow:over": NS_OFF,
  "flow:bal": NS_OFF,
};

/** Per-namespace level map for DEBUG mode (verbose diagnostics). */
export const DEBUG_MODE_LEVELS: Record<string, string> = {
  main: "debug",
  network: "debug",
  storage: "debug",
  stats: "debug",
  telemetry: "debug",
  render: "debug",
  compute: "debug",
  ui: "debug",
  ai: "debug",
  auth: "debug",
  streamer: "debug",
  worker: "debug",
  risk: "debug",
  options: "debug",
  holdings: "debug",
  pipeline: "debug",
  chart: "debug",
  news: "debug",
  phase: "debug",
  "flow:hold": "debug",
  "flow:quote": "debug",
  "flow:strm": "debug",
  "flow:over": "debug",
  "flow:bal": "debug",
};

export const LOG_CONFIG = {
  namespaceFiltering: {
    console: { ...INFO_MODE_LEVELS },
    notifications: { ...INFO_MODE_LEVELS },
  },

  console: {
    enabled: true,
    useColors: true,
    showTime: true,
    showDelta: true,
    showTotal: false,
    showObject: true,
    alignNamespaces: true,
    namespaceWidth: 10,
    objectMaxLen: 2000,
    redactKeys: [] as string[],
    timeOrigin: "performance",
  },

  notifications: {
    enabled: true,
    rules: [{ ns: "main", level: "off" }],

    behavior: {
      duration: 3000,
      durationByLevel: {
        error: 5000,
        warn: 4000,
        info: 3000,
        off: 2000,
      },
    },

    deduplication: {
      enabled: true,
      windowMs: 3000,
    },

    rateLimit: {
      enabled: false,
      maxPerWindow: 5,
      windowMs: 10000,
    },

    batching: {
      enabled: false,
      windowMs: 2000,
    },

    history: {
      enabled: true,
      maxSize: 50,
    },

    telemetry: {
      enabled: true,
    },
  },
} as const;
