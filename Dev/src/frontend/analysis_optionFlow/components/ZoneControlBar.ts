import { ui_createElement } from "frontend/components/core/builders/createElement";
import { injectStylesheet } from "frontend/components/core/builders/ui_builders";
import { getTodayDateCT, getDateOffsetCT, minutesToHHMM } from "shared/utils/time";
import {
  CAPTURE_WINDOW_MIN,
  CAPTURE_WINDOW_MAX,
  FULL_DAY_MIN,
  FULL_DAY_MAX,
  TIME_STEP_MIN,
} from "../types";

export interface ZoneControlBarCallbacks {
  onDateRangeChange: (dateStart: string, dateEnd: string) => void;
  onTimeWindowChange: (startMin: number, endMin: number) => void;
}

export interface ZoneControlBarHandle extends HTMLElement {
  getDateRange: () => { dateStart: string; dateEnd: string };
  getTimeWindow: () => { startMin: number; endMin: number };
}

/** Evenly-spaced tick labels for the slider track. */
function buildTickLabels(
  lo: number,
  hi: number,
  count: number,
): { pct: number; label: string }[] {
  if (count < 2 || hi <= lo) return [];
  const ticks: { pct: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    const val = lo + frac * (hi - lo);
    const rounded = Math.round(val / TIME_STEP_MIN) * TIME_STEP_MIN;
    ticks.push({ pct: frac * 100, label: minutesToHHMM(rounded) });
  }
  return ticks;
}

const THUMB_CLASS = "zone-range-thumb";

function injectThumbCSS(): void {
  injectStylesheet("zone-range-thumb-css", `
        input[type=range].${THUMB_CLASS}::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 16px; height: 16px; border-radius: 50%;
            background: #007AFF; border: 2px solid #fff;
            box-shadow: var(--ax-shadow-lg);
            cursor: pointer; pointer-events: auto;
            margin-top: -6px;
        }
        input[type=range].${THUMB_CLASS}::-moz-range-thumb {
            width: 16px; height: 16px; border-radius: 50%;
            background: #007AFF; border: 2px solid #fff;
            box-shadow: var(--ax-shadow-lg);
            cursor: pointer; pointer-events: auto;
        }
        input[type=range].${THUMB_CLASS}::-webkit-slider-runnable-track {
            height: 4px; background: transparent; border: none;
        }
        input[type=range].${THUMB_CLASS}::-moz-range-track {
            height: 4px; background: transparent; border: none;
        }
    `);
}

export function renderZoneControlBar(
  dateStart: string,
  dateEnd: string,
  timeStart: number,
  timeEnd: number,
  callbacks: ZoneControlBarCallbacks,
): ZoneControlBarHandle {
  injectThumbCSS();

  const bar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; padding: 6px 10px; flex-wrap: wrap;" +
      " background: var(--ax-glass-2-bg);" +
      " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " border: 1px solid var(--ax-border-subtle); border-radius: var(--ax-radius-md); margin-bottom: 6px;",
  }) as ZoneControlBarHandle;

  const controlStyle =
    "padding: 3px 6px; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold); border-radius: 6px;" +
    " cursor: pointer; border: 1px solid var(--ax-border);" +
    " font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-input); color: var(--ax-fg);" +
    " flex-shrink: 0;";

  // --- Date range inputs ---
  const dateGroup = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 4px; flex-shrink: 0;",
  });

  const dateStyle =
    "padding: 3px 6px; border: 1px solid var(--ax-border);" +
    " border-radius: 6px; font-size: var(--ax-fs-sm); font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-input); flex-shrink: 0; width: 120px;";

  const dateStartInput = ui_createElement("input", {
    props: { type: "date", value: dateStart },
    styleString: dateStyle,
  }) as HTMLInputElement;

  const dateSep = ui_createElement("span", {
    text: "~",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary, #666); flex-shrink: 0;",
  });

  const dateEndInput = ui_createElement("input", {
    props: { type: "date", value: dateEnd },
    styleString: dateStyle,
  }) as HTMLInputElement;

  let dateDebounce: ReturnType<typeof setTimeout> | null = null;
  function emitDateRange(): void {
    if (dateDebounce) clearTimeout(dateDebounce);
    dateDebounce = setTimeout(() => {
      const s = dateStartInput.value;
      const e = dateEndInput.value;
      if (s && e && s <= e) {
        callbacks.onDateRangeChange(s, e);
      }
    }, 600);
  }

  const datePresetSelect = ui_createElement("select", {
    styleString: controlStyle + " min-width: 72px; font-size: 10px;",
  }) as HTMLSelectElement;
  const presets: [string, string][] = [
    ["", "Range"],
    ["1d", "1D"],
    ["1w", "1W"],
    ["1m", "1M"],
    ["1y", "1Y"],
  ];
  for (const [val, label] of presets) {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    datePresetSelect.appendChild(opt);
  }

  function applyDatePreset(key: string): void {
    const today = getTodayDateCT();
    let start = today;
    if (key === "1d") start = today;
    else if (key === "1w") start = getDateOffsetCT(-7);
    else if (key === "1m") start = getDateOffsetCT(-30);
    else if (key === "1y") start = getDateOffsetCT(-365);
    else return;
    dateStartInput.value = start;
    dateEndInput.value = today;
    emitDateRange();
  }

  datePresetSelect.addEventListener("change", () => {
    const key = datePresetSelect.value;
    if (key) {
      applyDatePreset(key);
      datePresetSelect.value = "";
    }
  });

  dateStartInput.addEventListener("change", () => {
    datePresetSelect.value = "";
    emitDateRange();
  });
  dateEndInput.addEventListener("change", () => {
    datePresetSelect.value = "";
    emitDateRange();
  });

  dateGroup.appendChild(dateStartInput);
  dateGroup.appendChild(dateSep);
  dateGroup.appendChild(dateEndInput);
  dateGroup.appendChild(datePresetSelect);
  bar.appendChild(dateGroup);

  // --- Market Hours toggle ---
  let marketHoursActive =
    timeStart >= CAPTURE_WINDOW_MIN && timeEnd <= CAPTURE_WINDOW_MAX;
  const mktHoursBtn = ui_createElement("button", {
    text: "Mkt",
    styleString:
      "padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 4px;" +
      " cursor: pointer; transition: all 0.15s; flex-shrink: 0; line-height: 14px;" +
      ' font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);',
  }) as HTMLButtonElement;

  function applyMktStyle(): void {
    if (marketHoursActive) {
      mktHoursBtn.style.background = "#007AFF";
      mktHoursBtn.style.color = "#fff";
      mktHoursBtn.style.border = "1px solid #007AFF";
    } else {
      mktHoursBtn.style.background = "var(--ax-bg-input)";
      mktHoursBtn.style.color = "var(--ios-text-secondary, #666)";
      mktHoursBtn.style.border =
        "1px solid var(--ios-border, rgba(230,230,230,0.7))";
    }
  }
  applyMktStyle();
  bar.appendChild(mktHoursBtn);

  // --- Compact time slider with axis annotations ---
  function boundsMin(): number {
    return marketHoursActive ? CAPTURE_WINDOW_MIN : FULL_DAY_MIN;
  }
  function boundsMax(): number {
    return marketHoursActive ? CAPTURE_WINDOW_MAX : FULL_DAY_MAX;
  }

  const sliderOuter = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; flex: 1; min-width: 140px; max-width: 320px;",
  });

  // Time readout above slider
  const timeReadout = ui_createElement("div", {
    styleString:
      "display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;" +
      " color: var(--ios-text-primary, #1c1c1e); padding: 0 2px; margin-bottom: 1px;",
  });
  const readoutStart = ui_createElement("span", {
    text: minutesToHHMM(timeStart),
  });
  const readoutEnd = ui_createElement("span", { text: minutesToHHMM(timeEnd) });
  const readoutCT = ui_createElement("span", {
    text: "CT",
    styleString: "opacity: 0.5; font-weight: 500;",
  });
  timeReadout.appendChild(readoutStart);
  timeReadout.appendChild(readoutCT);
  timeReadout.appendChild(readoutEnd);
  sliderOuter.appendChild(timeReadout);

  // Slider track + thumbs
  const sliderWrap = ui_createElement("div", {
    styleString: "position: relative; height: 20px; width: 100%;",
  });

  const sliderTrack = ui_createElement("div", {
    styleString:
      "position: absolute; top: 8px; left: 0; right: 0; height: 4px;" +
      " background: var(--ax-bg-glass-inset); border-radius: 2px; pointer-events: none;",
  });

  const sliderRange = ui_createElement("div", {
    styleString:
      "position: absolute; top: 8px; height: 4px;" +
      " background: #007AFF; border-radius: 2px; pointer-events: none;",
  });

  const rangeInputStyle =
    "position: absolute; top: 0; left: 0; width: 100%; height: 20px; margin: 0;" +
    " -webkit-appearance: none; appearance: none; background: transparent;" +
    " pointer-events: none; outline: none;";

  const minSlider = document.createElement("input");
  minSlider.type = "range";
  minSlider.className = THUMB_CLASS;
  minSlider.min = String(boundsMin());
  minSlider.max = String(boundsMax());
  minSlider.step = String(TIME_STEP_MIN);
  minSlider.value = String(timeStart);
  minSlider.style.cssText = rangeInputStyle + " z-index: 1;";

  const maxSlider = document.createElement("input");
  maxSlider.type = "range";
  maxSlider.className = THUMB_CLASS;
  maxSlider.min = String(boundsMin());
  maxSlider.max = String(boundsMax());
  maxSlider.step = String(TIME_STEP_MIN);
  maxSlider.value = String(timeEnd);
  maxSlider.style.cssText = rangeInputStyle + " z-index: 2;";

  sliderWrap.appendChild(sliderTrack);
  sliderWrap.appendChild(sliderRange);
  sliderWrap.appendChild(minSlider);
  sliderWrap.appendChild(maxSlider);
  sliderOuter.appendChild(sliderWrap);

  // Axis tick labels below slider
  const tickRow = ui_createElement("div", {
    styleString:
      "position: relative; height: 12px; width: 100%; margin-top: 0px;" +
      " font-size: 10px; color: var(--ios-text-secondary, #888); font-weight: 500;",
  });

  function renderTicks(): void {
    tickRow.innerHTML = "";
    const ticks = buildTickLabels(
      boundsMin(),
      boundsMax(),
      marketHoursActive ? 5 : 7,
    );
    for (const t of ticks) {
      const el = ui_createElement("span", {
        text: t.label,
        styleString:
          `position: absolute; left: ${t.pct}%; transform: translateX(-50%);` +
          " white-space: nowrap;",
      });
      tickRow.appendChild(el);
    }
  }
  renderTicks();
  sliderOuter.appendChild(tickRow);
  bar.appendChild(sliderOuter);

  // --- Slider logic ---
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function applySliderBounds(): void {
    const bMin = String(boundsMin());
    const bMax = String(boundsMax());
    minSlider.min = bMin;
    minSlider.max = bMax;
    maxSlider.min = bMin;
    maxSlider.max = bMax;
  }

  function updateSliderVisuals(): void {
    const lo = parseInt(minSlider.value, 10);
    const hi = parseInt(maxSlider.value, 10);
    const bMin = boundsMin();
    const bMax = boundsMax();
    const span = bMax - bMin || 1;
    const leftPct = ((lo - bMin) / span) * 100;
    const rightPct = ((hi - bMin) / span) * 100;
    sliderRange.style.left = `${leftPct}%`;
    sliderRange.style.width = `${rightPct - leftPct}%`;
    readoutStart.textContent = minutesToHHMM(lo);
    readoutEnd.textContent = minutesToHHMM(hi);
  }

  function onSliderInput(): void {
    let lo = parseInt(minSlider.value, 10);
    let hi = parseInt(maxSlider.value, 10);
    if (lo > hi) {
      const temp = lo;
      lo = hi;
      hi = temp;
      minSlider.value = String(lo);
      maxSlider.value = String(hi);
    }
    updateSliderVisuals();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      callbacks.onTimeWindowChange(lo, hi);
    }, 250);
  }

  minSlider.addEventListener("input", onSliderInput);
  maxSlider.addEventListener("input", onSliderInput);

  mktHoursBtn.addEventListener("click", () => {
    marketHoursActive = !marketHoursActive;
    applyMktStyle();
    if (marketHoursActive) {
      let lo = parseInt(minSlider.value, 10);
      let hi = parseInt(maxSlider.value, 10);
      lo = Math.max(lo, CAPTURE_WINDOW_MIN);
      hi = Math.min(hi, CAPTURE_WINDOW_MAX);
      if (lo > hi) {
        lo = CAPTURE_WINDOW_MIN;
        hi = CAPTURE_WINDOW_MAX;
      }
      applySliderBounds();
      minSlider.value = String(lo);
      maxSlider.value = String(hi);
    } else {
      applySliderBounds();
      minSlider.value = String(FULL_DAY_MIN);
      maxSlider.value = String(FULL_DAY_MAX);
    }
    renderTicks();
    updateSliderVisuals();
    callbacks.onTimeWindowChange(
      parseInt(minSlider.value, 10),
      parseInt(maxSlider.value, 10),
    );
  });

  updateSliderVisuals();

  // --- Public getters ---
  bar.getDateRange = () => ({
    dateStart: dateStartInput.value,
    dateEnd: dateEndInput.value,
  });

  bar.getTimeWindow = () => ({
    startMin: parseInt(minSlider.value, 10),
    endMin: parseInt(maxSlider.value, 10),
  });

  return bar;
}
