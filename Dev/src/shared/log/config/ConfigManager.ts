import { LOG_CONFIG, DEBUG_MODE_LEVELS } from "./LogConfig";
import { deepClone } from "../../utils/data/deepClone";
import { deepMerge } from "../utils/objectUtils";

class ConfigManager {
  private config: any;
  private listeners: Set<(...args: any[]) => void>;
  private history: Array<{ timestamp: number; source: string; changes: any }>;

  constructor(initialConfig: any = LOG_CONFIG) {
    this.config = deepClone(initialConfig);
    this.listeners = new Set();
    this.history = [];
  }

  get(key: string | null = null) {
    if (key === null) return deepClone(this.config);
    return deepClone(this.config[key]);
  }

  set(updates: any, source = "manual") {
    if (!updates || typeof updates !== "object") return this.config;

    const oldConfig = deepClone(this.config);
    this.config = deepMerge(this.config, updates);

    this.history.push({
      timestamp: Date.now(),
      source,
      changes: updates,
    });

    this.notifyListeners(oldConfig, this.config, updates);

    return this.config;
  }

  onChange(callback: (newConfig: any, oldConfig: any, changes: any) => void) {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }
    this.listeners.add(callback);

    return () => this.listeners.delete(callback);
  }

  private notifyListeners(oldConfig: any, newConfig: any, changes: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(newConfig, oldConfig, changes);
      } catch (error) {
        console.error("Config listener error:", error);
      }
    });
  }

  reset() {
    const oldConfig = deepClone(this.config);
    this.config = deepClone(LOG_CONFIG);
    const changes = deepClone(LOG_CONFIG);
    this.history.push({
      timestamp: Date.now(),
      source: "reset",
      changes,
    });
    this.notifyListeners(oldConfig, this.config, changes);
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  applyPreset(presetName: string) {
    const infoLevels = deepClone(LOG_CONFIG.namespaceFiltering.console);
    const debugLevels = deepClone(DEBUG_MODE_LEVELS);

    const presets: Record<string, any> = {
      debug: {
        namespaceFiltering: {
          console: debugLevels,
        },
      },
      info: {
        namespaceFiltering: {
          console: infoLevels,
        },
      },
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

    // Aliases
    presets.verbose = presets.debug;
    presets.normal = presets.info;

    const preset = presets[presetName];
    if (preset) {
      this.set(preset, `preset:${presetName}`);
    }
  }
}

export const configManager = new ConfigManager();
