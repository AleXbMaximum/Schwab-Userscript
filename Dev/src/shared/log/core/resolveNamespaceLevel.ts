/**
 * Hierarchical namespace level resolution.
 *
 * Given namespace "ui.trade.chart.stream", walks up the hierarchy:
 *   1. "ui.trade.chart.stream" (exact)
 *   2. "ui.trade.chart"        (parent)
 *   3. "ui.trade"              (grandparent)
 *   4. "ui"                    (root)
 *   5. defaultLevel            (fallback)
 *
 * First match wins. Allows enabling all `ui.trade.*` children without
 * enumerating each one. Falls back transparently for legacy flat names
 * (e.g., "main", "network") that contain no dots.
 */
export function resolveNamespaceLevel(
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
