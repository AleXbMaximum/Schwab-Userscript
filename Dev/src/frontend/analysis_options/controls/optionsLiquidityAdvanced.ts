import { ui_createElement } from "../../components/core/builders/createElement";
import type { LiquidityAdvanced } from "../types";
import {
  LIQUIDITY_SPREAD_BASE,
  LIQUIDITY_MIN_VOL_BASE,
  LIQUIDITY_MIN_OI_BASE,
} from "./controlPresets";
import { selectSmallStyle, subLabelStyle } from "./optionsControlStyles";
import { createOption, numericOptionSet } from "./optionsControlHelpers";

export type LiquidityAdvancedHandle = {
  getAdvanced(): LiquidityAdvanced;
  setAdvanced(next: LiquidityAdvanced): void;
};

/**
 * Render the advanced-liquidity controls (Spread / MinVol / MinOI / Stale)
 * into `liqAdvancedRow` when the preset is "advanced". A no-op when the
 * preset is anything else.
 *
 * The state read/write goes through `handle` so the parent renderer remains
 * the single source of truth for `st.liquidityAdvanced`.
 */
export function renderLiquidityAdvancedRow(
  liqAdvancedRow: HTMLElement,
  preset: string,
  handle: LiquidityAdvancedHandle,
  onChange: (next: LiquidityAdvanced) => void,
): void {
  liqAdvancedRow.innerHTML = "";
  if (preset !== "advanced") return;

  const addNumberSelect = (
    title: string,
    baseValues: readonly number[],
    current: number,
    setter: (advanced: LiquidityAdvanced, next: number) => LiquidityAdvanced,
    formatter: (n: number) => string = (n) => String(n),
  ): void => {
    liqAdvancedRow.appendChild(
      ui_createElement("span", {
        text: `${title}:`,
        styleString: subLabelStyle,
      }),
    );
    const select = ui_createElement("select", {
      styleString: selectSmallStyle + " min-width: 88px;",
    }) as HTMLSelectElement;
    const values = numericOptionSet(baseValues, current);
    values.forEach((v) =>
      select.appendChild(createOption(String(v), formatter(v), v === current)),
    );
    select.addEventListener("change", (e: Event) => {
      const v = Number((e.target as HTMLSelectElement).value);
      if (!Number.isFinite(v)) return;
      const nextAdvanced = setter(handle.getAdvanced(), v);
      handle.setAdvanced(nextAdvanced);
      onChange(nextAdvanced);
    });
    liqAdvancedRow.appendChild(select);
  };

  const advanced = handle.getAdvanced();

  addNumberSelect(
    "Spread",
    LIQUIDITY_SPREAD_BASE,
    advanced.spreadPct,
    (a, next) => ({ ...a, spreadPct: next }),
    (n) => `<${n}%`,
  );

  addNumberSelect(
    "MinVol",
    LIQUIDITY_MIN_VOL_BASE,
    advanced.minVol,
    (a, next) => ({ ...a, minVol: next }),
  );

  addNumberSelect(
    "MinOI",
    LIQUIDITY_MIN_OI_BASE,
    advanced.minOI,
    (a, next) => ({ ...a, minOI: next }),
  );

  liqAdvancedRow.appendChild(
    ui_createElement("span", {
      text: "Stale:",
      styleString: subLabelStyle,
    }),
  );
  const staleSelect = ui_createElement("select", {
    styleString: selectSmallStyle + " min-width: 110px;",
  }) as HTMLSelectElement;
  staleSelect.appendChild(
    createOption("include", "Include", !advanced.excludeStale),
  );
  staleSelect.appendChild(
    createOption("exclude", "Exclude", advanced.excludeStale),
  );
  staleSelect.addEventListener("change", (e: Event) => {
    const exclude = (e.target as HTMLSelectElement).value === "exclude";
    const nextAdvanced = { ...handle.getAdvanced(), excludeStale: exclude };
    handle.setAdvanced(nextAdvanced);
    onChange(nextAdvanced);
  });
  liqAdvancedRow.appendChild(staleSelect);
}
