export type FocusedLevel = {
  strike: number;
  label: string;
  color: string;
};

type FocusStrikeListener = (levels: FocusedLevel[]) => void;

let focusedLevels: FocusedLevel[] = [];
const listeners = new Set<FocusStrikeListener>();

function notify(): void {
  const opening = [...focusedLevels];
  for (const listener of listeners) {
    listener(opening);
  }
}

export function getFocusedLevels(): FocusedLevel[] {
  return [...focusedLevels];
}

export function toggleFocusedLevel(
  strike: number,
  label: string,
  color: string,
): void {
  if (strike == null || !isFinite(strike)) return;
  const idx = focusedLevels.findIndex(
    (l) => l.label === label && Math.abs(l.strike - strike) < 0.01,
  );
  if (idx >= 0) {
    focusedLevels.splice(idx, 1);
  } else {
    focusedLevels.push({ strike, label, color });
  }
  notify();
}

export function isLevelActive(strike: number | null, label: string): boolean {
  if (strike == null) return false;
  return focusedLevels.some(
    (l) => l.label === label && Math.abs(l.strike - strike) < 0.01,
  );
}

function clearFocusedLevels(): void {
  if (focusedLevels.length === 0) return;
  focusedLevels = [];
  notify();
}

export function subscribeFocusedLevels(
  listener: FocusStrikeListener,
): () => void {
  listeners.add(listener);
  listener([...focusedLevels]);
  return () => {
    listeners.delete(listener);
  };
}

export function setFocusedStrike(strike: number | null): void {
  if (strike == null || !isFinite(strike)) return;
  toggleFocusedLevel(strike, "Focus", "rgba(30,30,40,0.9)");
}

export function clearFocusedStrike(): void {
  clearFocusedLevels();
}
