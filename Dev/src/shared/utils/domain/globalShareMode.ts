/**
 * Global Share Mode — a session-scoped display mode that masks or scales
 * monetary values across the entire UI for screen-sharing privacy.
 *
 * Modes:
 *   - "off"       → normal display (default)
 *   - "dollarOff" → all dollar amounts show "***"
 *   - "10x"       → all dollar amounts multiplied by 10
 *   - "custom"    → all dollar amounts multiplied by a user-defined factor
 *
 * This is purely a frontend display concern — no backend data is modified.
 */

// ── Type ────────────────────────────────────────────────────────────────────

export type GlobalShareMode = "off" | "dollarOff" | "10x" | "custom";

export const SHARE_MODE_CYCLE: GlobalShareMode[] = [
  "off",
  "dollarOff",
  "10x",
  "custom",
];

export const SHARE_MODE_LABELS: Record<GlobalShareMode, string> = {
  off: "Normal",
  dollarOff: "$***",
  "10x": "10x",
  custom: "Custom",
};

// ── Custom multiplier (session-scoped) ──────────────────────────────────────

const CUSTOM_MUL_KEY = "alexquant_shareCustomMul";
const DEFAULT_CUSTOM_MUL = 50;

function readCustomMultiplier(): number {
  try {
    const raw = sessionStorage.getItem(CUSTOM_MUL_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CUSTOM_MUL;
}

let _customMul: number = readCustomMultiplier();

export function getCustomMultiplier(): number {
  return _customMul;
}

export function setCustomMultiplier(value: number): void {
  if (!Number.isFinite(value) || value <= 0) return;
  _customMul = value;
  try {
    sessionStorage.setItem(CUSTOM_MUL_KEY, String(value));
  } catch {
    // ignore
  }
  // If currently in custom mode, notify listeners so UI refreshes
  if (_mode === "custom") {
    for (const cb of listeners) cb(_mode);
  }
}

// ── Multiplier lookup ───────────────────────────────────────────────────────

function getMultiplierForMode(mode: GlobalShareMode): number {
  if (mode === "10x") return 10;
  if (mode === "custom") return _customMul;
  return 1; // off and dollarOff
}

export const SHARE_MASKED_TEXT = "***";

// ── State (session-scoped via sessionStorage) ───────────────────────────────

const SESSION_KEY = "alexquant_shareMode";
const listeners = new Set<(mode: GlobalShareMode) => void>();

function readSession(): GlobalShareMode {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw && SHARE_MODE_CYCLE.includes(raw as GlobalShareMode)) {
      return raw as GlobalShareMode;
    }
  } catch {
    // sessionStorage unavailable — fall back to "off"
  }
  return "off";
}

let _mode: GlobalShareMode = readSession();

// ── Public API ──────────────────────────────────────────────────────────────

export function getShareMode(): GlobalShareMode {
  return _mode;
}

export function setShareMode(mode: GlobalShareMode): void {
  if (_mode === mode) return;
  _mode = mode;
  try {
    if (mode === "off") sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, mode);
  } catch {
    // ignore
  }
  for (const cb of listeners) cb(mode);
}

/** Cycle to the next mode in the ring: off → dollarOff → 10x → custom → off */
export function cycleShareMode(): GlobalShareMode {
  const idx = SHARE_MODE_CYCLE.indexOf(_mode);
  const next = SHARE_MODE_CYCLE[(idx + 1) % SHARE_MODE_CYCLE.length];
  setShareMode(next);
  return next;
}

/** Subscribe to mode changes. Returns an unsubscribe function. */
export function onShareModeChange(
  cb: (mode: GlobalShareMode) => void,
): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ── Helpers for formatters ──────────────────────────────────────────────────

/** True when the current mode requires masking (replacing with "***"). */
export function isShareMasked(): boolean {
  return _mode === "dollarOff";
}

/** Returns the numeric multiplier for the current mode (1, 10, or custom). */
export function getShareMultiplier(): number {
  return getMultiplierForMode(_mode);
}

/**
 * Scale a position/portfolio value by the current share-mode multiplier.
 * Null-safe — returns null/undefined unchanged.
 * Use this to pre-scale values before passing to pure formatters.
 */
export function shareScaleValue(
  v: number | null | undefined,
): number | null | undefined {
  if (v == null) return v;
  const mul = getMultiplierForMode(_mode);
  return mul !== 1 ? v * mul : v;
}
