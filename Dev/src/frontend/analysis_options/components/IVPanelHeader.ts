import { ui_createElement } from "../../components/core/createElement";
import { DS_COLORS } from "../../components/core/theme";
import type { IVMetric, IVSlice } from "../types";

const barStyle =
  "display: flex; align-items: center; gap: 16px; padding: 6px 0;" +
  " font-family: var(--ios-font); flex-wrap: wrap;";

const groupStyle =
  "display: flex; align-items: center; gap: 6px; flex-wrap: wrap;";

const groupLabelStyle =
  "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary);" +
  " text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap;";

const pillBaseStyle =
  "padding: 3px 10px; font-size: 11px; font-weight: 600; border-radius: 12px;" +
  " cursor: pointer; border: 1px solid var(--ios-border);" +
  " font-family: var(--ios-font); transition: all 0.15s; white-space: nowrap;";

const pillActiveStyle =
  pillBaseStyle + ` background: ${DS_COLORS.raw.purple}; color: #fff; border-color: ${DS_COLORS.raw.purple};`;

const pillInactiveStyle =
  pillBaseStyle +
  " background: var(--ax-bg-input); color: var(--ax-fg); border-color: var(--ax-border);";

export type IVPanelHeaderCallbacks = {
  onMetricChange: (metric: IVMetric) => void;
  onSliceChange: (slice: IVSlice) => void;
};

type IVPanelHeaderElement = HTMLElement & {
  cleanup?: () => void;
  update?: (m: IVMetric, s: IVSlice) => void;
};

const METRIC_LABELS: Record<IVMetric, string> = {
  iv: "IV",
  totalVariance: "\u03C3\u00B2T",
  forwardVariance: "Fwd Var",
};

const SLICE_LABELS: Record<IVSlice, string> = {
  atm: "ATM",
  "25delta": "25\u0394",
  "10delta": "10\u0394",
};

export function renderIVPanelHeader(
  currentMetric: IVMetric,
  currentSlice: IVSlice,
  callbacks: IVPanelHeaderCallbacks,
): IVPanelHeaderElement {
  let metric = currentMetric;
  let slice = currentSlice;

  const bar = ui_createElement("div", {
    styleString: barStyle,
  }) as IVPanelHeaderElement;

  const metricGroup = ui_createElement("div", { styleString: groupStyle });
  metricGroup.appendChild(
    ui_createElement("span", { text: "Metric", styleString: groupLabelStyle }),
  );
  const metricPills = ui_createElement("div", {
    styleString: "display: flex; gap: 4px;",
  });

  const renderMetricPills = () => {
    metricPills.innerHTML = "";
    for (const m of ["iv", "totalVariance", "forwardVariance"] as IVMetric[]) {
      const isActive = m === metric;
      const pill = ui_createElement("button", {
        text: METRIC_LABELS[m],
        styleString: isActive ? pillActiveStyle : pillInactiveStyle,
        events: {
          click: () => {
            if (m === metric) return;
            metric = m;
            renderMetricPills();
            callbacks.onMetricChange(metric);
          },
        },
      });
      metricPills.appendChild(pill);
    }
  };

  renderMetricPills();
  metricGroup.appendChild(metricPills);
  bar.appendChild(metricGroup);

  const sliceGroup = ui_createElement("div", { styleString: groupStyle });
  sliceGroup.appendChild(
    ui_createElement("span", { text: "Slice", styleString: groupLabelStyle }),
  );
  const slicePills = ui_createElement("div", {
    styleString: "display: flex; gap: 4px;",
  });

  const renderSlicePills = () => {
    slicePills.innerHTML = "";
    for (const s of ["atm", "25delta", "10delta"] as IVSlice[]) {
      const isActive = s === slice;
      const pill = ui_createElement("button", {
        text: SLICE_LABELS[s],
        styleString: isActive ? pillActiveStyle : pillInactiveStyle,
        events: {
          click: () => {
            if (s === slice) return;
            slice = s;
            renderSlicePills();
            callbacks.onSliceChange(slice);
          },
        },
      });
      slicePills.appendChild(pill);
    }
  };

  renderSlicePills();
  sliceGroup.appendChild(slicePills);
  bar.appendChild(sliceGroup);

  bar.update = (m: IVMetric, s: IVSlice) => {
    metric = m;
    slice = s;
    renderMetricPills();
    renderSlicePills();
  };

  bar.cleanup = () => {};

  return bar;
}
