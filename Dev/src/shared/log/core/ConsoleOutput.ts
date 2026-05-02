import { LogFormatter } from "./LogFormatter";
import { isLevelEnabled, normalizeLevel } from "./LogLevels";
import { resolveNamespaceLevel } from "./resolveNamespaceLevel";

class ConsoleOutput {
  private config: any;
  private namespaceLevels: Record<string, unknown>;
  private formatter: LogFormatter;

  constructor(config: any) {
    this.config = { ...config };
    this.namespaceLevels = { ...(config.namespaceLevels || {}) };
    this.formatter = new LogFormatter({ ...config });
  }

  shouldOutput(namespace: string, level: unknown, options: any = {}) {
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

  render(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    options: any = {},
  ) {
    if (!this.shouldOutput(namespace, level, options)) return;
    this.formatter.output(
      namespace,
      operation,
      level,
      metadata,
      timing,
      options,
    );
  }

  /** Render without re-checking shouldOutput (caller already checked). */
  directRender(
    namespace: string,
    operation: string,
    level: unknown,
    metadata: any,
    timing: any,
    options: any = {},
  ) {
    this.formatter.output(namespace, operation, level, metadata, timing, options);
  }

  updateConfig(newConfig: any) {
    if (!newConfig) return;

    const nextConfig = { ...this.config, ...newConfig };
    if ("namespaceLevels" in newConfig) {
      this.namespaceLevels = { ...(newConfig.namespaceLevels || {}) };
    }
    nextConfig.namespaceLevels = { ...this.namespaceLevels };
    this.config = nextConfig;
    this.formatter.updateConfig({ ...nextConfig });
  }

  getConfig() {
    return {
      ...this.config,
      namespaceLevels: { ...this.namespaceLevels },
    };
  }
}

export { ConsoleOutput };
