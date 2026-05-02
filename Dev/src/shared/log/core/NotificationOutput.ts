import { isLevelEnabled, normalizeLevel } from "./LogLevels";
import { resolveNamespaceLevel } from "./resolveNamespaceLevel";

class NotificationOutput {
  private config: any;
  private manager: any;
  private namespaceLevels: Record<string, unknown>;

  constructor(config: any, notificationManager: any) {
    this.config = { ...config };
    this.manager = notificationManager;
    this.namespaceLevels = { ...(config.namespaceLevels || {}) };
  }

  shouldShow(namespace: string, level: unknown, options: any = {}) {
    const notifyFlag =
      options.notification !== undefined
        ? options.notification
        : options.notify;
    const normalizedLevel = normalizeLevel(level);
    if (!normalizedLevel) return false;

    if (notifyFlag === false) return false;
    if (notifyFlag === true) return true;

    if (!this.config.enabled) return false;

    const nsLevel = resolveNamespaceLevel(
      namespace,
      this.namespaceLevels,
      this.config.defaultLevel,
    );
    if (!isLevelEnabled(nsLevel, normalizedLevel)) return false;

    return true;
  }

  show(event: any) {
    if (!this.shouldShow(event.namespace, event.level, event.options)) {
      return false;
    }

    return this.manager.show(event);
  }

  updateConfig(newConfig: any) {
    if (!newConfig) return;
    const nextConfig = { ...this.config, ...newConfig };
    if ("namespaceLevels" in newConfig) {
      this.namespaceLevels = { ...(newConfig.namespaceLevels || {}) };
    }
    nextConfig.namespaceLevels = { ...this.namespaceLevels };
    this.config = nextConfig;

    if (this.manager?.updateConfig) {
      this.manager.updateConfig(this.config);
    }
  }

  getConfig() {
    return {
      ...this.config,
      namespaceLevels: { ...this.namespaceLevels },
    };
  }

  getTelemetry() {
    return this.manager?.getTelemetry?.() || {};
  }

  resetTelemetry() {
    return this.manager?.resetTelemetry?.();
  }

  getHistory(limit: number) {
    return this.manager?.getHistory?.(limit) || [];
  }

  clearHistory() {
    return this.manager?.clearHistory?.();
  }

  setHandler(fn: (...args: any[]) => void) {
    return this.manager?.setHandler?.(fn);
  }
}

export { NotificationOutput };
