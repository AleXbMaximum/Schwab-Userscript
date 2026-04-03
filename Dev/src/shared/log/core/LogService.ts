import { logClock } from "./LogClock";
import { LogNamespace } from "./LogNamespace";
import { ConsoleOutput } from "./ConsoleOutput";
import { NotificationOutput } from "./NotificationOutput";
import { LOG_CONFIG } from "../config/LogConfig";
import { configManager } from "../config/ConfigManager";

class LogService {
  clock: typeof logClock;
  namespaces: Map<string, LogNamespace>;
  consoleOutput: ConsoleOutput;
  notificationConfig: any;
  notificationManager: any;
  notificationOutput: NotificationOutput | null;

  constructor(config: any = LOG_CONFIG) {
    this.clock = logClock;
    this.namespaces = new Map();

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

    const notificationConfig = {
      enabled: config.notifications.enabled,
      ...config.notifications,
      namespaceLevels: config.namespaceFiltering?.notifications || {},
    };
    this.notificationConfig = notificationConfig;
    this.notificationManager = null;
    this.notificationOutput = null;

    configManager.onChange((newConfig: any) => {
      this.updateConfig(newConfig);
    });
  }

  namespace(name: string) {
    if (!this.namespaces.has(name)) {
      this.namespaces.set(name, new LogNamespace(name, this as any));
    }
    return this.namespaces.get(name)!;
  }

  ns(name: string) {
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
  ) {
    // Fast path: skip all work when neither console nor notifications will output
    const consoleWill = this.consoleOutput.shouldOutput(namespace, level, options);
    const notifyWill = this.notificationOutput?.shouldShow(namespace, level, options);
    if (!consoleWill && !notifyWill) return;

    const timing = this.clock.stamp();

    // Resolve lazy metadata: if a function was passed, call it now
    const resolved = typeof metadata === "function" ? metadata() : metadata;

    const normalizedOptions = this._normalizeOptions(options);

    if (consoleWill) {
      this.consoleOutput.directRender(
        namespace,
        operation,
        level,
        resolved,
        timing,
        normalizedOptions,
      );
    }

    if (notifyWill) {
      this.notificationOutput!.show({
        namespace,
        operation,
        level,
        metadata: resolved,
        options: normalizedOptions,
        timing,
      });
    }
  }

  private _normalizeOptions(options: any) {
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

  updateConfig(newConfig: any) {
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

    if (
      newConfig.notifications ||
      newConfig.namespaceFiltering?.notifications
    ) {
      this.notificationConfig = {
        ...this.notificationConfig,
        ...newConfig.notifications,
        namespaceLevels:
          newConfig.namespaceFiltering?.notifications ||
          this.notificationConfig.namespaceLevels,
      };

      if (this.notificationOutput) {
        this.notificationOutput.updateConfig(this.notificationConfig);
      }
      if (this.notificationManager?.updateConfig) {
        this.notificationManager.updateConfig(this.notificationConfig);
      }
    }
  }

  setNotificationManager(manager: any) {
    this.notificationManager = manager;

    if (manager) {
      this.notificationOutput = new NotificationOutput(
        this.notificationConfig,
        manager,
      );
      manager.updateConfig(this.notificationConfig);
    }
  }
}

export const logService = new LogService();
