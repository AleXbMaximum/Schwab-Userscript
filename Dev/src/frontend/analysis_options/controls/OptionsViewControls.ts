import { ui_createElement } from "../../components/core/createElement";
import type { GreeksBasis, GexGammaSource } from "backend/computation/options/types";
import type {
  ScopeMode,
  LocalWindowMode,
  StrikeMode,
  LiquidityPreset,
  LiquidityAdvanced,
} from "../types";
import type{ OptionsExpiration } from "shared/types/options";
import { normalizeScopeMode } from "../savedView/savedViewSerializer";
import {
  getExpOI,
  expirationOptionLabel,
  oiColors,
} from "./controlFormatters";
import {
  LOCAL_WINDOW_OPTIONS,
  STRIKE_COUNT_BASE,
  STRIKE_WIDTH_BASE,
  LIQUIDITY_SPREAD_BASE,
  LIQUIDITY_MIN_VOL_BASE,
  LIQUIDITY_MIN_OI_BASE,
  SCOPE_LABELS,
  LIQUIDITY_LABELS,
  BASIS_LABELS,
  GAMMA_SOURCE_LABELS,
} from "./controlPresets";

const barStyle =
  "display: flex; flex-direction: column; gap: 4px; padding: 4px 8px;" +
  " border-bottom: 1px solid rgba(0,0,0,0.06);" +
  " background: rgba(255,255,255,0.55);" +
  " font-family: var(--ios-font);";

const controlsRowStyle =
  "display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;" +
  " overflow-x: auto; overflow-y: hidden;";

const groupStyle =
  "display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; white-space: nowrap;";

const groupLabelStyle =
  "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary);" +
  " letter-spacing: 0.2px; white-space: nowrap;";

const selectBaseStyle =
  "padding: 3px 6px; border: 1px solid var(--ios-border); border-radius: 8px;" +
  " font-size: 11px; font-weight: 600; color: var(--ios-text-primary);" +
  " background: rgba(255,255,255,0.86); font-family: var(--ios-font);" +
  " min-height: 24px; outline: none;";

const selectSmallStyle = selectBaseStyle + " min-width: 94px;";
const selectWideStyle = selectBaseStyle + " min-width: 228px;";
const selectMultiStyle =
  selectBaseStyle + " min-width: 228px; min-height: 82px; font-weight: 500;";

const subRowStyle =
  "display: flex; align-items: center; gap: 6px; margin-left: 4px; flex-wrap: wrap;";

const subLabelStyle =
  "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary);";

const infoTagStyle =
  "font-size: 9px; font-weight: 600; color: #D78100; background: rgba(215, 129, 0, 0.1);" +
  " padding: 1px 5px; border-radius: 4px; white-space: nowrap;";

export type ViewControlsCallbacks = {
  onExpirationChange: (idx: number, customIdxs?: number[]) => void;
  onScopeChange: (mode: ScopeMode) => void;
  onLocalWindowChange: (
    mode: LocalWindowMode,
    pct: number,
    deltaRange: [number, number],
  ) => void;
  onStrikeChange: (
    mode: StrikeMode,
    count: number,
    dollarWidth: number,
  ) => void;
  onLiquidityChange: (
    preset: LiquidityPreset,
    advanced: LiquidityAdvanced,
  ) => void;
  onBasisChange: (basis: GreeksBasis) => void;
  onGammaSourceChange: (source: GexGammaSource) => void;
};

type ViewControlsElement = HTMLElement & {
  cleanup?: () => void;
  update?: (state: ViewControlsState, expirations: OptionsExpiration[]) => void;
};

export type ViewControlsState = {
  selectedExpirationIdx: number;
  customExpirationIdxs: number[];
  scopeMode: ScopeMode;
  greeksBasis: GreeksBasis;
  gammaSource: GexGammaSource;
  localWindowMode: LocalWindowMode;
  localWindowPct: number;
  localWindowDeltaRange: [number, number];
  strikeMode: StrikeMode;
  selectedStrikeCount: number;
  strikeDollarWidth: number;
  liquidityPreset: LiquidityPreset;
  liquidityAdvanced: LiquidityAdvanced;
};

function createOption(
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

function numericOptionSet(base: readonly number[], current: number): number[] {
  if (base.includes(current)) return [...base];
  return [...base, current].sort((a, b) => a - b);
}

function localChoiceValue(
  mode: LocalWindowMode,
  pct: number,
  delta: [number, number],
): string {
  if (mode === "all") return "all";
  if (mode === "pct") return `pct:${pct}`;
  return `delta:${delta[0]}-${delta[1]}`;
}

export function renderScopeLock(
  stateSlice: ViewControlsState,
  expirations: OptionsExpiration[],
  callbacks: ViewControlsCallbacks,
): ViewControlsElement {
  let st = {
    ...stateSlice,
    scopeMode: normalizeScopeMode((stateSlice as any).scopeMode),
  };
  let exps = expirations;

  const bar = ui_createElement("div", {
    styleString: barStyle,
  }) as ViewControlsElement;

  const controlsRow = ui_createElement("div", {
    styleString: controlsRowStyle,
  });
  bar.appendChild(controlsRow);

  const expGroup = ui_createElement("div", { styleString: groupStyle });
  const expLabel = ui_createElement("span", {
    text: "Expiration",
    styleString: groupLabelStyle,
  });
  expGroup.appendChild(expLabel);
  const expSelect = ui_createElement("select", {
    styleString: selectWideStyle,
  }) as HTMLSelectElement;
  const customExpSelect = ui_createElement("select", {
    styleString: selectMultiStyle,
    props: { multiple: true, size: 4 },
  }) as HTMLSelectElement;
  const customHint = ui_createElement("span", {
    text: "Multi scope supports Ctrl/Cmd multi-select.",
    styleString: subLabelStyle,
  });
  const expSub = ui_createElement("div", { styleString: subRowStyle });
  expSub.appendChild(customExpSelect);
  expSub.appendChild(customHint);
  expGroup.appendChild(expSelect);
  expGroup.appendChild(expSub);

  const renderExpirationSelect = () => {
    expSelect.innerHTML = "";
    if (exps.length === 0) {
      expSelect.appendChild(createOption("", "No expirations"));
      expSelect.disabled = true;
      return;
    }
    expSelect.disabled = false;

    const oiList = exps.map((e) => getExpOI(e));
    const minOI = Math.min(...oiList);
    const maxOI = Math.max(...oiList);
    const safeIdx = Math.max(
      0,
      Math.min(exps.length - 1, st.selectedExpirationIdx),
    );
    st.selectedExpirationIdx = safeIdx;

    exps.forEach((exp, idx) => {
      const oi = oiList[idx];
      const opt = createOption(
        String(idx),
        expirationOptionLabel(exp, oi),
        idx === safeIdx,
      );
      const { optionBg, optionFg } = oiColors(oi, minOI, maxOI);
      opt.style.background = optionBg;
      opt.style.color = optionFg;
      opt.style.fontWeight = "600";
      expSelect.appendChild(opt);
    });

    const selectedOI = oiList[safeIdx] ?? oiList[0] ?? 0;
    const { selectBg } = oiColors(selectedOI, minOI, maxOI);
    expSelect.style.background = selectBg;
  };

  const renderCustomExpSelect = () => {
    const showMulti = st.scopeMode === "multi";
    expSub.style.display = showMulti ? "flex" : "none";
    if (!showMulti) return;

    customExpSelect.innerHTML = "";
    const selectedSet = new Set(
      st.customExpirationIdxs.length > 0
        ? st.customExpirationIdxs
        : [st.selectedExpirationIdx],
    );
    exps.forEach((exp, idx) => {
      const oi = getExpOI(exp);
      customExpSelect.appendChild(
        createOption(
          String(idx),
          expirationOptionLabel(exp, oi),
          selectedSet.has(idx),
        ),
      );
    });
  };

  expSelect.addEventListener("change", (e: Event) => {
    const nextIdx = Number((e.target as HTMLSelectElement).value);
    if (!Number.isFinite(nextIdx) || nextIdx < 0 || nextIdx >= exps.length)
      return;

    st.selectedExpirationIdx = nextIdx;
    if (st.scopeMode === "multi") {
      const nextSet = new Set(st.customExpirationIdxs);
      if (nextSet.size === 0 || !nextSet.has(nextIdx)) nextSet.add(nextIdx);
      st.customExpirationIdxs = [...nextSet].sort((a, b) => a - b);
      callbacks.onExpirationChange(nextIdx, st.customExpirationIdxs);
      renderCustomExpSelect();
    } else {
      callbacks.onExpirationChange(nextIdx);
    }
    renderExpirationSelect();
  });

  customExpSelect.addEventListener("change", () => {
    const selected = Array.from(customExpSelect.selectedOptions)
      .map((opt) => Number(opt.value))
      .filter((v) => Number.isInteger(v) && v >= 0 && v < exps.length)
      .sort((a, b) => a - b);
    const next = selected.length > 0 ? selected : [st.selectedExpirationIdx];
    st.customExpirationIdxs = next;
    st.selectedExpirationIdx = next[0];
    callbacks.onExpirationChange(
      st.selectedExpirationIdx,
      st.customExpirationIdxs,
    );
    renderExpirationSelect();
    renderCustomExpSelect();
  });

  const scopeGroup = ui_createElement("div", { styleString: groupStyle });
  scopeGroup.appendChild(
    ui_createElement("span", { text: "Scope", styleString: groupLabelStyle }),
  );
  const scopeSelect = ui_createElement("select", {
    styleString: selectSmallStyle,
  }) as HTMLSelectElement;

  const renderScopeSelect = () => {
    scopeSelect.innerHTML = "";
    for (const mode of ["single", "multi", "all"] as ScopeMode[]) {
      scopeSelect.appendChild(
        createOption(mode, SCOPE_LABELS[mode], mode === st.scopeMode),
      );
    }
  };

  scopeSelect.addEventListener("change", (e: Event) => {
    const mode = (e.target as HTMLSelectElement).value as ScopeMode;
    if (mode === st.scopeMode) return;
    st.scopeMode = mode;
    callbacks.onScopeChange(mode);
    renderScopeSelect();
    renderCustomExpSelect();
  });

  renderScopeSelect();
  scopeGroup.appendChild(scopeSelect);
  controlsRow.appendChild(scopeGroup);
  controlsRow.appendChild(expGroup);

  const localGroup = ui_createElement("div", { styleString: groupStyle });
  localGroup.appendChild(
    ui_createElement("span", {
      text: "Local Window",
      styleString: groupLabelStyle,
    }),
  );
  const localSelect = ui_createElement("select", {
    styleString: selectSmallStyle + " min-width: 154px;",
  }) as HTMLSelectElement;
  localGroup.appendChild(localSelect);
  controlsRow.appendChild(localGroup);

  const strikeGroup = ui_createElement("div", { styleString: groupStyle });
  strikeGroup.appendChild(
    ui_createElement("span", { text: "Strikes", styleString: groupLabelStyle }),
  );
  const strikeSelect = ui_createElement("select", {
    styleString: selectSmallStyle + " min-width: 146px;",
  }) as HTMLSelectElement;
  const autoLockTag = ui_createElement("span", {
    text: "Auto-locked",
    styleString: infoTagStyle,
  });
  autoLockTag.style.display = "none";
  strikeGroup.appendChild(strikeSelect);
  strikeGroup.appendChild(autoLockTag);
  controlsRow.appendChild(strikeGroup);

  const liqGroup = ui_createElement("div", { styleString: groupStyle });
  liqGroup.appendChild(
    ui_createElement("span", {
      text: "Liquidity",
      styleString: groupLabelStyle,
    }),
  );
  const liqSelect = ui_createElement("select", {
    styleString: selectSmallStyle + " min-width: 104px;",
  }) as HTMLSelectElement;
  const liqAdvancedRow = ui_createElement("div", {
    styleString: subRowStyle + " flex-wrap: wrap;",
  });
  liqGroup.appendChild(liqSelect);
  liqGroup.appendChild(liqAdvancedRow);
  controlsRow.appendChild(liqGroup);

  const basisGroup = ui_createElement("div", { styleString: groupStyle });
  basisGroup.appendChild(
    ui_createElement("span", { text: "Greeks", styleString: groupLabelStyle }),
  );
  const basisSelect = ui_createElement("select", {
    styleString: selectSmallStyle + " min-width: 86px;",
  }) as HTMLSelectElement;
  basisGroup.appendChild(basisSelect);
  controlsRow.appendChild(basisGroup);

  const gammaGroup = ui_createElement("div", { styleString: groupStyle });
  gammaGroup.appendChild(
    ui_createElement("span", { text: "Gamma", styleString: groupLabelStyle }),
  );
  const gammaSelect = ui_createElement("select", {
    styleString: selectSmallStyle + " min-width: 96px;",
  }) as HTMLSelectElement;
  gammaGroup.appendChild(gammaSelect);
  controlsRow.appendChild(gammaGroup);

  const renderLocalSelect = () => {
    localSelect.innerHTML = "";
    const current = localChoiceValue(
      st.localWindowMode,
      st.localWindowPct,
      st.localWindowDeltaRange,
    );
    const options = [...LOCAL_WINDOW_OPTIONS] as Array<{
      value: string;
      label: string;
      mode: LocalWindowMode;
      pct?: number;
      delta?: [number, number];
    }>;
    const known = new Set(options.map((o) => o.value));
    if (!known.has(current)) {
      const customLabel =
        st.localWindowMode === "pct"
          ? `\u00b1${st.localWindowPct}% (Custom)`
          : st.localWindowMode === "delta"
            ? `\u0394${Math.round(st.localWindowDeltaRange[0] * 100)}-${Math.round(st.localWindowDeltaRange[1] * 100)} (Custom)`
            : "Global";
      options.unshift({
        value: current,
        label: customLabel,
        mode: st.localWindowMode,
        pct: st.localWindowPct,
        delta: st.localWindowDeltaRange,
      });
    }
    options.forEach((o) =>
      localSelect.appendChild(
        createOption(o.value, o.label, o.value === current),
      ),
    );
  };

  localSelect.addEventListener("change", (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === "all") {
      st.localWindowMode = "all";
    } else if (val.startsWith("pct:")) {
      const pct = Number(val.split(":")[1]);
      st.localWindowMode = "pct";
      st.localWindowPct = Number.isFinite(pct) ? pct : st.localWindowPct;
    } else if (val.startsWith("delta:")) {
      const raw = val.split(":")[1] ?? "";
      const [loRaw, hiRaw] = raw.split("-");
      const lo = Number(loRaw);
      const hi = Number(hiRaw);
      st.localWindowMode = "delta";
      if (Number.isFinite(lo) && Number.isFinite(hi))
        st.localWindowDeltaRange = [lo, hi];
    }

    if (st.localWindowMode !== "all" && st.strikeMode !== "auto") {
      st.strikeMode = "auto";
      callbacks.onStrikeChange(
        "auto",
        st.selectedStrikeCount,
        st.strikeDollarWidth,
      );
    }

    callbacks.onLocalWindowChange(
      st.localWindowMode,
      st.localWindowPct,
      st.localWindowDeltaRange,
    );
    renderLocalSelect();
    renderStrikeSelect();
  });

  const renderStrikeSelect = () => {
    strikeSelect.innerHTML = "";
    const isAutoLocked = st.localWindowMode !== "all";
    autoLockTag.style.display = isAutoLocked ? "inline-flex" : "none";

    const countOptions = numericOptionSet(
      STRIKE_COUNT_BASE,
      st.selectedStrikeCount,
    );
    const widthOptions = numericOptionSet(
      STRIKE_WIDTH_BASE,
      st.strikeDollarWidth,
    );

    const allOptions: Array<{
      value: string;
      label: string;
      disabled?: boolean;
    }> = [
      { value: "auto", label: "Auto" },
      ...countOptions.map((n) => ({
        value: `count:${n}`,
        label: n === 0 ? "Count: All" : `Count: \u00b1${n}`,
        disabled: isAutoLocked,
      })),
      ...widthOptions.map((n) => ({
        value: `width:${n}`,
        label: `Width: \u00b1$${n}`,
        disabled: isAutoLocked,
      })),
    ];

    const selectedValue =
      st.strikeMode === "count"
        ? `count:${st.selectedStrikeCount}`
        : st.strikeMode === "dollarWidth"
          ? `width:${st.strikeDollarWidth}`
          : "auto";

    allOptions.forEach((o) => {
      const opt = createOption(o.value, o.label, o.value === selectedValue);
      if (o.disabled) opt.disabled = true;
      strikeSelect.appendChild(opt);
    });

    if (isAutoLocked) {
      strikeSelect.title = "Locked to Auto when Local Window is active";
    } else {
      strikeSelect.title = "";
    }
  };

  strikeSelect.addEventListener("change", (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === "auto") {
      st.strikeMode = "auto";
    } else if (val.startsWith("count:")) {
      const count = Number(val.split(":")[1]);
      st.strikeMode = "count";
      if (Number.isFinite(count)) st.selectedStrikeCount = count;
    } else if (val.startsWith("width:")) {
      const width = Number(val.split(":")[1]);
      st.strikeMode = "dollarWidth";
      if (Number.isFinite(width)) st.strikeDollarWidth = width;
    }
    callbacks.onStrikeChange(
      st.strikeMode,
      st.selectedStrikeCount,
      st.strikeDollarWidth,
    );
    renderStrikeSelect();
  });

  const renderLiqSelect = () => {
    liqSelect.innerHTML = "";
    (["strict", "normal", "loose", "advanced"] as LiquidityPreset[]).forEach(
      (preset) => {
        const opt = createOption(
          preset,
          LIQUIDITY_LABELS[preset],
          preset === st.liquidityPreset,
        );
        liqSelect.appendChild(opt);
      },
    );
  };

  liqSelect.addEventListener("change", (e: Event) => {
    const preset = (e.target as HTMLSelectElement).value as LiquidityPreset;
    if (preset === st.liquidityPreset) return;
    st.liquidityPreset = preset;
    callbacks.onLiquidityChange(preset, st.liquidityAdvanced);
    renderLiqSelect();
    renderLiqAdvanced();
  });

  const renderLiqAdvanced = () => {
    liqAdvancedRow.innerHTML = "";
    if (st.liquidityPreset !== "advanced") return;

    const addNumberSelect = (
      title: string,
      baseValues: readonly number[],
      current: number,
      onChange: (next: number) => void,
      formatter: (n: number) => string = (n) => String(n),
    ) => {
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
        select.appendChild(
          createOption(String(v), formatter(v), v === current),
        ),
      );
      select.addEventListener("change", (e: Event) => {
        const v = Number((e.target as HTMLSelectElement).value);
        if (!Number.isFinite(v)) return;
        onChange(v);
      });
      liqAdvancedRow.appendChild(select);
    };

    addNumberSelect(
      "Spread",
      LIQUIDITY_SPREAD_BASE,
      st.liquidityAdvanced.spreadPct,
      (next) => {
        st.liquidityAdvanced = { ...st.liquidityAdvanced, spreadPct: next };
        callbacks.onLiquidityChange("advanced", st.liquidityAdvanced);
      },
      (n) => `<${n}%`,
    );

    addNumberSelect(
      "MinVol",
      LIQUIDITY_MIN_VOL_BASE,
      st.liquidityAdvanced.minVol,
      (next) => {
        st.liquidityAdvanced = { ...st.liquidityAdvanced, minVol: next };
        callbacks.onLiquidityChange("advanced", st.liquidityAdvanced);
      },
    );

    addNumberSelect(
      "MinOI",
      LIQUIDITY_MIN_OI_BASE,
      st.liquidityAdvanced.minOI,
      (next) => {
        st.liquidityAdvanced = { ...st.liquidityAdvanced, minOI: next };
        callbacks.onLiquidityChange("advanced", st.liquidityAdvanced);
      },
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
      createOption("include", "Include", !st.liquidityAdvanced.excludeStale),
    );
    staleSelect.appendChild(
      createOption("exclude", "Exclude", st.liquidityAdvanced.excludeStale),
    );
    staleSelect.addEventListener("change", (e: Event) => {
      const exclude = (e.target as HTMLSelectElement).value === "exclude";
      st.liquidityAdvanced = { ...st.liquidityAdvanced, excludeStale: exclude };
      callbacks.onLiquidityChange("advanced", st.liquidityAdvanced);
    });
    liqAdvancedRow.appendChild(staleSelect);
  };

  const renderBasisSelect = () => {
    basisSelect.innerHTML = "";
    (["mid", "mark"] as GreeksBasis[]).forEach((b) => {
      basisSelect.appendChild(createOption(b, BASIS_LABELS[b], b === st.greeksBasis));
    });
  };

  basisSelect.addEventListener("change", (e: Event) => {
    const b = (e.target as HTMLSelectElement).value as GreeksBasis;
    if (b === st.greeksBasis) return;
    st.greeksBasis = b;
    callbacks.onBasisChange(b);
    renderBasisSelect();
  });

  const renderGammaSourceSelect = () => {
    gammaSelect.innerHTML = "";
    (["schwab", "bs"] as GexGammaSource[]).forEach((s) => {
      gammaSelect.appendChild(
        createOption(s, GAMMA_SOURCE_LABELS[s], s === st.gammaSource),
      );
    });
  };

  gammaSelect.addEventListener("change", (e: Event) => {
    const s = (e.target as HTMLSelectElement).value as GexGammaSource;
    if (s === st.gammaSource) return;
    st.gammaSource = s;
    callbacks.onGammaSourceChange(s);
    renderGammaSourceSelect();
  });

  renderExpirationSelect();
  renderScopeSelect();
  renderCustomExpSelect();
  renderLocalSelect();
  renderStrikeSelect();
  renderLiqSelect();
  renderLiqAdvanced();
  renderBasisSelect();
  renderGammaSourceSelect();

  bar.update = (state: ViewControlsState, newExps: OptionsExpiration[]) => {
    st = { ...state, scopeMode: normalizeScopeMode((state as any).scopeMode) };
    exps = newExps;
    renderExpirationSelect();
    renderScopeSelect();
    renderCustomExpSelect();
    renderLocalSelect();
    renderStrikeSelect();
    renderLiqSelect();
    renderLiqAdvanced();
    renderBasisSelect();
    renderGammaSourceSelect();
  };

  bar.cleanup = () => {};

  return bar;
}
