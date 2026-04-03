import { configManager } from "./config/ConfigManager";
import { logService } from "./core/LogService";
import { LOG_CONFIG } from "./config/LogConfig";

/**
 * Runtime log control exposed on `window.__alexquantLog`.
 *
 * Usage from browser console — see help() for full list.
 */
interface LogDevTools {
  /** Switch ALL namespaces to debug (verbose) */
  debug: () => void;
  /** Switch back to info mode (daily) */
  info: () => void;
  /** Errors + warnings only */
  quiet: () => void;
  /** Completely silent */
  silent: () => void;
  /** Override a single namespace level: ns('network') or ns('network','info') */
  ns: (namespace: string, level?: string) => void;
  /** Mute a single namespace */
  mute: (namespace: string) => void;
  /** Reset a single namespace back to its default level */
  reset: (namespace?: string) => void;
  /** Only show logs from the given namespace(s), mute everything else */
  only: (...namespaces: string[]) => void;
  /** Print current namespace → level table */
  status: () => void;
  /** Toggle object metadata display on/off */
  obj: (show?: boolean) => void;
  /** Toggle delta-time display */
  delta: (show?: boolean) => void;
  /** Print config change history */
  history: (limit?: number) => void;
  /** Print available commands */
  help: () => void;
}

function createLogDevTools(): LogDevTools {
  const log = logService.namespace("main");

  return {
    debug() {
      configManager.applyPreset("debug");
      log.info("logMode.switched", { mode: "debug" });
    },
    info() {
      configManager.applyPreset("info");
      log.info("logMode.switched", { mode: "info" });
    },
    quiet() {
      configManager.applyPreset("quiet");
      log.info("logMode.switched", { mode: "quiet" });
    },
    silent() {
      configManager.applyPreset("silent");
    },
    ns(namespace: string, level = "debug") {
      configManager.set(
        { namespaceFiltering: { console: { [namespace]: level } } },
        `devtools:ns(${namespace},${level})`,
      );
      log.info("logMode.nsOverride", { namespace, level });
    },
    mute(namespace: string) {
      configManager.set(
        { namespaceFiltering: { console: { [namespace]: "off" } } },
        `devtools:mute(${namespace})`,
      );
      log.info("logMode.muted", { namespace });
    },
    reset(namespace?: string) {
      if (namespace) {
        const defaultLevel =
          (LOG_CONFIG.namespaceFiltering.console as Record<string, string>)[
            namespace
          ] ?? "info";
        configManager.set(
          { namespaceFiltering: { console: { [namespace]: defaultLevel } } },
          `devtools:reset(${namespace})`,
        );
        log.info("logMode.reset", { namespace, level: defaultLevel });
      } else {
        configManager.reset();
        log.info("logMode.resetAll");
      }
    },
    only(...namespaces: string[]) {
      const cfg = configManager.get("namespaceFiltering") as any;
      const current = cfg?.console ?? {};
      const patch: Record<string, string> = {};
      for (const key of Object.keys(current)) {
        patch[key] = namespaces.includes(key) ? "debug" : "off";
      }
      // Also enable explicitly requested namespaces that may not be in the config yet
      for (const ns of namespaces) {
        patch[ns] = "debug";
      }
      configManager.set(
        { namespaceFiltering: { console: patch } },
        `devtools:only(${namespaces.join(",")})`,
      );
      log.info("logMode.only", { namespaces });
    },
    status() {
      const cfg = configManager.get("namespaceFiltering") as any;
      const consoleLevels = cfg?.console ?? {};
      console.table(
        Object.entries(consoleLevels)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ns, lvl]) => ({ namespace: ns, level: lvl })),
      );
    },
    obj(show?: boolean) {
      const current = configManager.get("console") as any;
      const next = show ?? !(current?.showObject ?? true);
      configManager.set(
        { console: { showObject: next } },
        `devtools:obj(${next})`,
      );
      log.info("logMode.showObject", { showObject: next });
    },
    delta(show?: boolean) {
      const current = configManager.get("console") as any;
      const next = show ?? !(current?.showDelta ?? true);
      configManager.set(
        { console: { showDelta: next } },
        `devtools:delta(${next})`,
      );
      log.info("logMode.showDelta", { showDelta: next });
    },
    history(limit = 10) {
      const entries = configManager.getHistory(limit);
      if (entries.length === 0) {
        console.log("No config changes recorded.");
        return;
      }
      console.table(
        entries.map((e: any) => ({
          time: new Date(e.timestamp).toLocaleTimeString(),
          source: e.source,
          changes: JSON.stringify(e.changes).slice(0, 120),
        })),
      );
    },
    help() {
      const lines = [
        "%c__alexquantLog — Runtime Log Control",
        "",
        "  .debug()              Switch ALL namespaces to debug (verbose)",
        "  .info()               Switch back to info mode (daily)",
        "  .quiet()              Errors + warnings only",
        "  .silent()             Completely silent",
        "",
        "  .ns('network')        Set one namespace to debug",
        "  .ns('network','info') Set one namespace to a specific level",
        "  .mute('streamer')     Mute a single namespace",
        "  .reset('network')     Reset one namespace to default",
        "  .reset()              Reset ALL to factory defaults",
        "  .only('ai','network') Only show these namespaces, mute rest",
        "",
        "  .status()             Print namespace → level table",
        "  .obj()                Toggle metadata display",
        "  .delta()              Toggle delta-time display",
        "  .history(5)           Print recent config changes",
        "",
        "Levels: error > warn > info > debug",
        "Namespaces: main, network, storage, stats, render, ui, ai, auth,",
        "  streamer, worker, compute, risk, options, holdings, pipeline,",
        "  chart, news, phase, flow:hold, flow:quote, flow:strm, flow:over",
      ];
      console.log(
        lines.join("\n"),
        "font-weight: bold; font-size: 13px; color: #FF6B6B",
      );
    },
  };
}

export function installLogDevTools(): void {
  const w = window as any;
  if (!w.__alexquantLog) {
    w.__alexquantLog = createLogDevTools();
  }
}
