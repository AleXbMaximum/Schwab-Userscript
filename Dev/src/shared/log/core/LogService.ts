/**
 * Consolidated logging core. All internal pieces in one place:
 *  - Span status normalization
 *  - Level normalization + filtering
 *  - Namespace-level resolution (hierarchical)
 *  - LogConfig defaults (INFO/DEBUG modes)
 *  - LogClock (perf-based timestamps)
 *  - LogFormatter (styled + plain console output)
 *  - ConsoleOutput (gating + render)
 *  - ConfigManager (mutable runtime config + presets)
 *  - LogNamespace (per-namespace API: error/warn/info/debug/span/perf/throttle/count)
 *  - LogService (singleton entry, exposes `logService`)
 *
 * Public exports kept stable for the 79 importers across the codebase:
 *  - `logService` — main entry, callers do `logService.namespace("ai").info(...)`.
 *  - `configManager`, `LOG_CONFIG` — used by devTools.
 *  - Type re-exports (Logger interface lives in ../Logger.ts and is unchanged).
 */

import {
  deepClone,
  isPlainObject,
  cloneRegExp,
} from "../../utils/data/deepClone";

// ── Span status ─────────────────────────────────────────────────────────────

const SPAN_STATUS = Object.freeze({
  SUCCESS: "success",
  ERROR: "error",
  FAILURE: "failure",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  ABORTED: "aborted",
  UNAVAILABLE: "unavailable",
} as const);

export type SpanStatus = (typeof SPAN_STATUS)[keyof typeof SPAN_STATUS];

export function normalizeSpanStatus(status: unknown): string | null {
  if (!status || typeof status !== "string") return null;
  const normalized = status.toLowerCase();
  if ((Object.values(SPAN_STATUS) as string[]).includes(normalized)) {
    return normalized;
  }
  switch (normalized) {
    case "ok":
      return SPAN_STATUS.SUCCESS;
    case "fail":
    case "failed":
      return SPAN_STATUS.FAILURE;
    case "timeouted":
      return SPAN_STATUS.TIMEOUT;
    case "not available":
    case "unavailable":
      return SPAN_STATUS.UNAVAILABLE;
    default:
      return null;
  }
}

// ── Log levels ──────────────────────────────────────────────────────────────

const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;
export type CanonicalLogLevel = (typeof LOG_LEVELS)[number];
export type NormalizedLevel = CanonicalLogLevel | "disabled";

const LEVEL_PRIORITY = Object.freeze(
  (LOG_LEVELS as readonly string[]).reduce(
    (acc, level, index) => {
      (acc as Record<string, number>)[level] = index;
      return acc;
    },
    Object.create(null) as Record<string, number>,
  ),
);

const DISABLED_TOKENS = new Set(["disabled", "off"]);

const NORMALIZED_ALIASES = Object.freeze({
  all: "debug",
  verbose: "debug",
  trace: "debug",
} as const);

function normalize(value: unknown): NormalizedLevel | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (DISABLED_TOKENS.has(trimmed)) return "disabled";
  if ((LEVEL_PRIORITY as any)[trimmed] !== undefined) {
    return trimmed as NormalizedLevel;
  }
  const aliased = (NORMALIZED_ALIASES as any)[trimmed];
  if (aliased) return aliased as NormalizedLevel;
  return null;
}

export const normalizeLevel = (value: unknown): NormalizedLevel | null =>
  normalize(value);

export const isLevelEnabled = (threshold: unknown, level: unknown): boolean => {
  const normalizedLevel = normalize(level);
  if (!normalizedLevel || normalizedLevel === "disabled") return false;
  const normalizedThreshold = normalize(threshold);
  if (!normalizedThreshold || normalizedThreshold === "disabled") return false;
  const thresholdKey =
    (NORMALIZED_ALIASES as any)[normalizedThreshold] || normalizedThreshold;
  return (
    (LEVEL_PRIORITY as any)[normalizedLevel] <=
    (LEVEL_PRIORITY as any)[thresholdKey]
  );
};

// ── Hierarchical namespace level resolution ─────────────────────────────────

function resolveNamespaceLevel(
  namespace: string,
  levels: Record<string, unknown>,
  defaultLevel: unknown,
): unknown {
  if (namespace in levels) return levels[namespace];
  let prefix = namespace;
  while (true) {
    const dot = prefix.lastIndexOf(".");
    if (dot === -1) break;
    prefix = prefix.substring(0, dot);
    if (prefix in levels) return levels[prefix];
  }
  return defaultLevel;
}

// ── deepMerge (used by ConfigManager) ───────────────────────────────────────

function deepMerge<T extends Record<string, unknown>>(
  target: T | unknown,
  source: unknown,
): T {
  if (!isPlainObject(target)) target = {};
  if (!isPlainObject(source)) return deepClone(target as T);

  const merged: Record<string, unknown> = {
    ...(target as Record<string, unknown>),
  };

  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      merged[key] = value.map((item) => deepClone(item));
      return;
    }
    const regexClone = cloneRegExp(value);
    if (regexClone) {
      merged[key] = regexClone;
      return;
    }
    if (isPlainObject(value)) {
      merged[key] = deepMerge(merged[key], value);
      return;
    }
    merged[key] = value;
  });

  return merged as T;
}

// ── Default log configuration ───────────────────────────────────────────────

const NS_INFO = "info";
const NS_OFF = "off";

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

const DEBUG_MODE_LEVELS: Record<string, string> = Object.fromEntries(
  Object.keys(INFO_MODE_LEVELS).map((k) => [k, "debug"]),
);

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
    deduplication: { enabled: true, windowMs: 3000 },
    rateLimit: { enabled: false, maxPerWindow: 5, windowMs: 10000 },
    batching: { enabled: false, windowMs: 2000 },
    history: { enabled: true, maxSize: 50 },
    telemetry: { enabled: true },
  },
} as const;

// ── Clock ───────────────────────────────────────────────────────────────────

class LogClock {
  private hasPerformance: boolean;
  private t0: number;
  private lastLog: number;

  constructor() {
    this.hasPerformance =
      typeof performance !== "undefined" && !!performance.now;
    this.t0 = this.now();
    this.lastLog = this.t0;
  }

  now(): number {
    return this.hasPerformance ? performance.now() : Date.now();
  }

  stamp(): { current: number; delta: number; total: number } {
    const current = this.now();
    const delta = current - this.lastLog;
    const total = current - this.t0;
    this.lastLog = current;
    return { current, delta, total };
  }

  formatTime(): string {
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${get("hour")}:${get("minute")}:${get("second")}.${ms}`;
  }
}

const logClock = new LogClock();

// ── Formatter ───────────────────────────────────────────────────────────────

const Colors: any = {
  namespace: {
    main: "#FF6B6B",
    network: "#4ECDC4",
    storage: "#FFE66D",
    stats: "#95E1D3",
    telemetry: "#F38181",
    render: "#AA96DA",
    ui: "#FCBAD3",
    ai: "#E0BBE4",
    auth: "#D4A574",
    streamer: "#00CED1",
    worker: "#8FBC8F",
    compute: "#87CEEB",
    risk: "#FF7F50",
    options: "#DDA0DD",
    holdings: "#98D8C8",
    pipeline: "#B8860B",
    chart: "#20B2AA",
    news: "#F0E68C",
    "flow:hold": "#5B9BD5",
    "flow:quote": "#7EC8E3",
    "flow:strm": "#00CED1",
    "flow:over": "#9370DB",
    "flow:bal": "#FFD700",
    phase: "#FFA500",
  },
  level: {
    error: "#FF0000",
    warn: "#FFA500",
    info: "#00BFFF",
    debug: "#90EE90",
  },
  time: "#9B9B9B",
  operation: "#FFFFFF",
  data: "#B0B0B0",
};

class LogFormatter {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  updateConfig(config: any): void {
    this.config = config;
  }

  output(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    options: any = {},
  ): void {
    if (this.config.useColors) {
      this.outputStyled(namespace, operation, level, metadata, timing, options);
    } else {
      this.outputPlain(namespace, operation, level, metadata, timing, options);
    }
  }

  private outputStyled(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    _options: any = {},
  ): void {
    const styles: any[] = [];
    const canonicalLevel = normalizeLevel(level) || level;
    const parts: any[] = [];

    const nsColor = Colors.namespace[namespace] || "#FFFFFF";
    const paddedNs = this.padNamespace(namespace);
    parts.push("%c[%s]");
    styles.push(`color: ${nsColor}; font-weight: bold;`, paddedNs);

    if (
      this.config.showTime ||
      this.config.showDelta ||
      this.config.showTotal
    ) {
      const timeParts: string[] = [];
      if (this.config.showTime) timeParts.push(logClock.formatTime());
      if (this.config.showTotal) timeParts.push(`${timing.total.toFixed(1)}ms`);
      if (this.config.showDelta)
        timeParts.push(`+${timing.delta.toFixed(1)}ms`);
      parts.push("%c[%s]");
      styles.push(`color: ${Colors.time};`, timeParts.join(" | "));
    }

    const levelColor = Colors.level[String(canonicalLevel)] || "#FFFFFF";
    const isAlertLevel =
      canonicalLevel === "error" || canonicalLevel === "warn";
    const levelStyle = isAlertLevel
      ? `background: ${levelColor}; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 3px;`
      : `color: ${levelColor}; font-weight: bold;`;
    parts.push("%c%s");
    styles.push(levelStyle, String(canonicalLevel || level).toUpperCase());

    if (operation) {
      parts.push("%c%s");
      styles.push(`color: ${Colors.operation}; font-weight: 600;`, operation);
    }

    const dataStr = this.serializeMetadata(metadata);
    if (dataStr) {
      parts.push("%c%s");
      styles.push(`color: ${Colors.data}; font-style: italic;`, dataStr);
    }

    console.log(parts.join(" "), ...styles);
  }

  private outputPlain(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    _options: any = {},
  ): void {
    const paddedNs = this.padNamespace(namespace);
    const parts: string[] = [`[${paddedNs}]`];
    const canonicalLevel = normalizeLevel(level) || level;

    if (
      this.config.showTime ||
      this.config.showDelta ||
      this.config.showTotal
    ) {
      const timeParts: string[] = [];
      if (this.config.showTime) timeParts.push(logClock.formatTime());
      if (this.config.showTotal && timing && typeof timing.total === "number") {
        timeParts.push(`${timing.total.toFixed(1)}ms`);
      }
      if (this.config.showDelta && timing && typeof timing.delta === "number") {
        timeParts.push(`+${timing.delta.toFixed(1)}ms`);
      }
      if (timeParts.length > 0) parts.push(`[${timeParts.join(" | ")}]`);
    }

    parts.push(String(canonicalLevel || level).toUpperCase());
    if (operation) parts.push(operation);

    const dataStr = this.serializeMetadata(metadata);
    console.log(parts.join(" ") + dataStr);
  }

  private padNamespace(ns: string): string {
    if (!this.config.alignNamespaces) return ns;
    return ns.padEnd(this.config.namespaceWidth || 10, " ");
  }

  private serializeMetadata(metadata: any): string {
    if (
      !this.config.showObject ||
      !metadata ||
      Object.keys(metadata).length === 0
    ) {
      return "";
    }
    try {
      const redacter = (k: string, v: unknown) =>
        this.config.redactKeys?.includes(k) ? "[REDACTED]" : v;
      let s = JSON.stringify(metadata, redacter);
      const maxLen = this.config.objectMaxLen || 2000;
      if (s.length > maxLen) s = s.slice(0, maxLen) + "...";
      return " " + s;
    } catch {
      return " [unserializable]";
    }
  }
}

// ── ConsoleOutput (gating + render) ─────────────────────────────────────────

class ConsoleOutput {
  private config: any;
  private namespaceLevels: Record<string, unknown>;
  private formatter: LogFormatter;

  constructor(config: any) {
    this.config = { ...config };
    this.namespaceLevels = { ...(config.namespaceLevels || {}) };
    this.formatter = new LogFormatter({ ...config });
  }

  shouldOutput(namespace: string, level: unknown, options: any = {}): boolean {
    const normalizedLevel = normalizeLevel(level);
    if (!normalizedLevel) return false;
    if (options.console === false) return false;
    if (options.console === true) return true;
    if (!this.config.enabled) return false;
    const nsLevel = resolveNamespaceLevel(
      namespace,
      this.namespaceLevels,
      this.config.defaultLevel,
    );
    if (!isLevelEnabled(nsLevel, normalizedLevel)) return false;
    return true;
  }

  directRender(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    options: any = {},
  ): void {
    this.formatter.output(
      namespace,
      operation,
      level,
      metadata,
      timing,
      options,
    );
  }

  updateConfig(newConfig: any): void {
    if (!newConfig) return;
    const nextConfig = { ...this.config, ...newConfig };
    if ("namespaceLevels" in newConfig) {
      this.namespaceLevels = { ...(newConfig.namespaceLevels || {}) };
    }
    nextConfig.namespaceLevels = { ...this.namespaceLevels };
    this.config = nextConfig;
    this.formatter.updateConfig({ ...nextConfig });
  }

  getConfig(): any {
    return {
      ...this.config,
      namespaceLevels: { ...this.namespaceLevels },
    };
  }
}

// ── ConfigManager (mutable runtime config + presets) ────────────────────────

class ConfigManager {
  private config: any;
  private listeners: Set<(...args: any[]) => void>;
  private history: Array<{ timestamp: number; source: string; changes: any }>;

  constructor(initialConfig: any = LOG_CONFIG) {
    this.config = deepClone(initialConfig);
    this.listeners = new Set();
    this.history = [];
  }

  get(key: string | null = null): any {
    if (key === null) return deepClone(this.config);
    return deepClone(this.config[key]);
  }

  set(updates: any, source = "manual"): any {
    if (!updates || typeof updates !== "object") return this.config;
    const oldConfig = deepClone(this.config);
    this.config = deepMerge(this.config, updates);
    this.history.push({ timestamp: Date.now(), source, changes: updates });
    this.notifyListeners(oldConfig, this.config, updates);
    return this.config;
  }

  onChange(
    callback: (newConfig: any, oldConfig: any, changes: any) => void,
  ): () => void {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(oldConfig: any, newConfig: any, changes: any): void {
    this.listeners.forEach((listener) => {
      try {
        listener(newConfig, oldConfig, changes);
      } catch (error) {
        console.error("Config listener error:", error);
      }
    });
  }

  reset(): void {
    const oldConfig = deepClone(this.config);
    this.config = deepClone(LOG_CONFIG);
    const changes = deepClone(LOG_CONFIG);
    this.history.push({ timestamp: Date.now(), source: "reset", changes });
    this.notifyListeners(oldConfig, this.config, changes);
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  applyPreset(presetName: string): void {
    const infoLevels = deepClone(LOG_CONFIG.namespaceFiltering.console);
    const debugLevels = deepClone(DEBUG_MODE_LEVELS);

    const presets: Record<string, any> = {
      debug: { namespaceFiltering: { console: debugLevels } },
      info: { namespaceFiltering: { console: infoLevels } },
      quiet: {
        namespaceFiltering: {
          console: Object.fromEntries(
            Object.keys(infoLevels).map((k) => [k, "error"]),
          ),
        },
      },
      silent: {
        namespaceFiltering: {
          console: Object.fromEntries(
            Object.keys(infoLevels).map((k) => [k, "disabled"]),
          ),
        },
      },
    };
    presets.verbose = presets.debug;
    presets.normal = presets.info;

    const preset = presets[presetName];
    if (preset) this.set(preset, `preset:${presetName}`);
  }
}

export const configManager = new ConfigManager();

// ── LogNamespace (per-namespace API) ────────────────────────────────────────

interface PerfOptions {
  warnThresholdMs?: number;
  errorThresholdMs?: number;
}

interface ThrottleState {
  lastTime: number;
  skipped: number;
}

interface CountState {
  count: number;
  firstTime: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

class LogNamespace {
  private name: string;
  private svc: LogService;
  private throttleMap = new Map<string, ThrottleState>();
  private countMap = new Map<string, CountState>();

  constructor(name: string, svc: LogService) {
    this.name = name;
    this.svc = svc;
  }

  levelEnabled(level: string): boolean {
    return this.svc.isLevelEnabled(this.name, level);
  }

  error(operation: string, metadata: any = {}, options: any = {}): void {
    this.svc.log(this.name, operation, "error", metadata, options);
  }
  warn(operation: string, metadata: any = {}, options: any = {}): void {
    this.svc.log(this.name, operation, "warn", metadata, options);
  }
  info(operation: string, metadata: any = {}, options: any = {}): void {
    this.svc.log(this.name, operation, "info", metadata, options);
  }
  debug(operation: string, metadata: any = {}, options: any = {}): void {
    this.svc.log(this.name, operation, "debug", metadata, options);
  }
  trace(operation: string, metadata: any = {}, options: any = {}): void {
    this.svc.log(this.name, operation, "debug", metadata, options);
  }

  span(operation: string, metadata: any = {}) {
    const startTime = this.svc.clock.now();
    this.debug(`${operation}.start`, metadata);

    return {
      end: (statusOrMetadata: any, metadataOrLevel: any, level = "debug") => {
        const endTime = this.svc.clock.now();
        const duration = Math.round(endTime - startTime);

        let status: any = null;
        let meta: any = {};
        let finalLevel = level;

        if (typeof statusOrMetadata === "string") {
          status = normalizeSpanStatus(statusOrMetadata) || statusOrMetadata;
          if (metadataOrLevel && typeof metadataOrLevel === "object") {
            meta = metadataOrLevel;
          }
          if (typeof metadataOrLevel === "string") {
            finalLevel = metadataOrLevel;
          } else if (typeof level === "string") {
            finalLevel = level;
          }
        } else {
          meta = statusOrMetadata || {};
          if (metadataOrLevel && typeof metadataOrLevel === "string") {
            finalLevel = metadataOrLevel;
          }
        }

        const payload: any = { ...meta, durationMs: duration };
        if (status) payload.status = status;

        this.svc.log(this.name, `${operation}.done`, finalLevel, payload);
      },
    };
  }

  perf(operation: string, opts: PerfOptions = {}) {
    const warnMs = opts.warnThresholdMs ?? 16;
    const errorMs = opts.errorThresholdMs ?? 100;
    const startTime = this.svc.clock.now();

    return (metadata: any = {}) => {
      const duration = Math.round(this.svc.clock.now() - startTime);
      let level = "debug";
      if (duration >= errorMs) level = "error";
      else if (duration >= warnMs) level = "info";

      this.svc.log(this.name, `${operation}.perf`, level, {
        ...metadata,
        durationMs: duration,
      });
    };
  }

  throttle(
    operation: string,
    intervalMs: number,
    metadata: any = {},
    level = "debug",
  ): void {
    const now = this.svc.clock.now();
    let state = this.throttleMap.get(operation);
    if (!state) {
      state = { lastTime: 0, skipped: 0 };
      this.throttleMap.set(operation, state);
    }
    if (now - state.lastTime < intervalMs) {
      state.skipped++;
      return;
    }
    const payload =
      state.skipped > 0 ? { ...metadata, skipped: state.skipped } : metadata;
    state.lastTime = now;
    state.skipped = 0;
    this.svc.log(this.name, operation, level, payload);
  }

  count(
    operation: string,
    flushIntervalMs = 5000,
    metadata: any = {},
    level = "debug",
  ): void {
    let state = this.countMap.get(operation);
    if (!state) {
      state = {
        count: 0,
        firstTime: this.svc.clock.now(),
        timerId: null,
      };
      this.countMap.set(operation, state);
    }
    state.count++;

    if (!state.timerId) {
      state.timerId = setTimeout(() => {
        const s = this.countMap.get(operation);
        if (s && s.count > 0) {
          const elapsed = Math.round(this.svc.clock.now() - s.firstTime);
          this.svc.log(this.name, `${operation}.summary`, level, {
            ...metadata,
            count: s.count,
            windowMs: elapsed,
          });
          s.count = 0;
          s.firstTime = this.svc.clock.now();
        }
        if (s) s.timerId = null;
      }, flushIntervalMs);
    }
  }
}

// ── LogService (singleton entry) ────────────────────────────────────────────

class LogService {
  clock: typeof logClock;
  private namespaces = new Map<string, LogNamespace>();
  private consoleOutput: ConsoleOutput;

  constructor(config: any = LOG_CONFIG) {
    this.clock = logClock;

    const consoleConfig = {
      enabled: config.console.enabled,
      useColors: config.console.useColors,
      showTime: config.console.showTime,
      showDelta: config.console.showDelta,
      showTotal: config.console.showTotal,
      showObject: config.console.showObject,
      alignNamespaces: config.console.alignNamespaces,
      namespaceWidth: config.console.namespaceWidth,
      objectMaxLen: config.console.objectMaxLen,
      redactKeys: config.console.redactKeys,
      timeOrigin: config.console.timeOrigin,
      namespaceLevels: config.namespaceFiltering?.console || {},
    };
    this.consoleOutput = new ConsoleOutput(consoleConfig);

    configManager.onChange((newConfig: any) => this.updateConfig(newConfig));
  }

  namespace(name: string): LogNamespace {
    if (!this.namespaces.has(name)) {
      this.namespaces.set(name, new LogNamespace(name, this));
    }
    return this.namespaces.get(name)!;
  }

  ns(name: string): LogNamespace {
    return this.namespace(name);
  }

  isLevelEnabled(namespace: string, level: string): boolean {
    return this.consoleOutput.shouldOutput(namespace, level);
  }

  log(
    namespace: string,
    operation: string,
    level: any,
    metadata: any = {},
    options: any = {},
  ): void {
    if (!this.consoleOutput.shouldOutput(namespace, level, options)) return;

    const timing = this.clock.stamp();
    const resolved = typeof metadata === "function" ? metadata() : metadata;
    const normalizedOptions = this.normalizeOptions(options);

    this.consoleOutput.directRender(
      namespace,
      operation,
      level,
      resolved,
      timing,
      normalizedOptions,
    );
  }

  private normalizeOptions(options: any): any {
    if (!options || typeof options !== "object") return {};
    const normalized = { ...options };
    if ("notify" in normalized && !("notification" in normalized)) {
      normalized.notification = normalized.notify;
      delete normalized.notify;
    }
    if ("shouldNotify" in normalized && !("notification" in normalized)) {
      normalized.notification = normalized.shouldNotify;
      delete normalized.shouldNotify;
    }
    return normalized;
  }

  private updateConfig(newConfig: any): void {
    if (!newConfig) return;
    if (newConfig.console || newConfig.namespaceFiltering?.console) {
      const consoleConfig = {
        ...this.consoleOutput.getConfig(),
        ...newConfig.console,
        namespaceLevels:
          newConfig.namespaceFiltering?.console ||
          this.consoleOutput.getConfig().namespaceLevels,
      };
      this.consoleOutput.updateConfig(consoleConfig);
    }
  }
}

export const logService = new LogService();
