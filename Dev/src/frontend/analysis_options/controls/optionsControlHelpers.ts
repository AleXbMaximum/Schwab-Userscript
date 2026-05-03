import type { LocalWindowMode } from "../types";

export function createOption(
  value: string,
  label: string,
  selected = false,
): HTMLOptionElement {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  if (selected) opt.selected = true;
  return opt;
}

export function numericOptionSet(
  base: readonly number[],
  current: number,
): number[] {
  if (base.includes(current)) return [...base];
  return [...base, current].sort((a, b) => a - b);
}

export function localChoiceValue(
  mode: LocalWindowMode,
  pct: number,
  delta: [number, number],
): string {
  if (mode === "all") return "all";
  if (mode === "pct") return `pct:${pct}`;
  return `delta:${delta[0]}-${delta[1]}`;
}
