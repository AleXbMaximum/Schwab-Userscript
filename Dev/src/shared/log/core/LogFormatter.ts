import { logClock } from "./LogClock";
import { normalizeLevel } from "./LogLevels";

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

export class LogFormatter {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  updateConfig(config: any) {
    this.config = config;
  }

  output(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    options: any = {},
  ) {
    if (this.config.useColors) {
      this.outputStyled(namespace, operation, level, metadata, timing, options);
    } else {
      this.outputPlain(namespace, operation, level, metadata, timing, options);
    }
  }

  outputStyled(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    _options: any = {},
  ) {
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
      if (this.config.showTime) {
        timeParts.push(logClock.formatTime());
      }
      if (this.config.showTotal) {
        timeParts.push(`${timing.total.toFixed(1)}ms`);
      }
      if (this.config.showDelta) {
        timeParts.push(`+${timing.delta.toFixed(1)}ms`);
      }
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

  outputPlain(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    options: any = {},
  ) {
    const line = this.formatPlain(
      namespace,
      operation,
      level,
      metadata,
      timing,
      options,
    );
    console.log(line);
  }

  formatPlain(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    _options: any = {},
  ) {
    const paddedNs = this.padNamespace(namespace);
    const parts: string[] = [`[${paddedNs}]`];
    const canonicalLevel = normalizeLevel(level) || level;

    if (
      this.config.showTime ||
      this.config.showDelta ||
      this.config.showTotal
    ) {
      const timeParts: string[] = [];
      if (this.config.showTime) {
        timeParts.push(logClock.formatTime());
      }
      if (this.config.showTotal && timing && typeof timing.total === "number") {
        timeParts.push(`${timing.total.toFixed(1)}ms`);
      }
      if (this.config.showDelta && timing && typeof timing.delta === "number") {
        timeParts.push(`+${timing.delta.toFixed(1)}ms`);
      }
      if (timeParts.length > 0) {
        parts.push(`[${timeParts.join(" | ")}]`);
      }
    }

    parts.push(String(canonicalLevel || level).toUpperCase());
    if (operation) parts.push(operation);

    const dataStr = this.serializeMetadata(metadata);
    return parts.join(" ") + dataStr;
  }

  padNamespace(ns: string) {
    if (!this.config.alignNamespaces) return ns;
    return ns.padEnd(this.config.namespaceWidth || 10, " ");
  }

  serializeMetadata(metadata: any) {
    if (
      !this.config.showObject ||
      !metadata ||
      Object.keys(metadata).length === 0
    ) {
      return "";
    }

    try {
      const redacter = (k: string, v: unknown) => {
        return this.config.redactKeys?.includes(k) ? "[REDACTED]" : v;
      };
      let s = JSON.stringify(metadata, redacter);
      const maxLen = this.config.objectMaxLen || 2000;
      if (s.length > maxLen) {
        s = s.slice(0, maxLen) + "...";
      }
      return " " + s;
    } catch {
      return " [unserializable]";
    }
  }
}
