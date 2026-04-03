import { ui_createElement } from "../../../components/core/createElement";
import { DS_COLORS } from "../../../components/core/theme";
import type {
  PortfolioControlState,
  PortfolioFocusMode,
  PortfolioSeverityFilter,
} from "../../types";

type PortfolioControlCallbacks = {
  onPauseToggle: (paused: boolean) => void;
  onFocusModeChange: (mode: PortfolioFocusMode) => void;
  onSeverityChange: (severity: PortfolioSeverityFilter) => void;
  onRiskAppetiteChange: (value: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export function renderPortfolioControlBar(
  state: PortfolioControlState,
  callbacks: PortfolioControlCallbacks,
): HTMLElement & {
  cleanup?: () => void;
  update?: (next: PortfolioControlState) => void;
} {
  const bar = ui_createElement("div", {
    styleString:
      "position: sticky; top: var(--portfolio-control-sticky-top, 44px); z-index: var(--z-sticky-control, 110);" +
      " display: flex; align-items: center; gap: 12px; flex-wrap: wrap;" +
      " padding: 10px 16px; background: rgba(255, 255, 255, 0.72);" +
      " border-bottom: 1px solid rgba(0, 0, 0, 0.06);" +
      " -webkit-backdrop-filter: blur(12px) saturate(130%);" +
      " backdrop-filter: blur(12px) saturate(130%);" +
      " font-family: var(--ios-font);",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (next: PortfolioControlState) => void;
  };

  let localState: PortfolioControlState = { ...state };

  const groupStyle = "display: inline-flex; align-items: center; gap: 8px;";
  const labelStyle =
    "font-size: 11px; font-weight: 700; color: var(--ios-text-secondary); letter-spacing: 0.2px;";

  const pauseBtn = ui_createElement("button", {
    styleString:
      "padding: 6px 12px; border-radius: 10px; border: 1px solid var(--ios-border);" +
      " background: rgba(255,255,255,0.8); color: var(--ios-text-primary); cursor: pointer;" +
      " font-size: 12px; font-weight: 700; font-family: var(--ios-font);",
  }) as HTMLButtonElement;

  const statusDot = ui_createElement("span", {
    text: "\u25CF",
    styleString: "font-size: 10px; line-height: 1;",
  });

  const statusLabel = ui_createElement("span", {
    styleString: "font-size: 11px; font-weight: 700;",
  });

  const liveGroup = ui_createElement("div", { styleString: groupStyle });
  liveGroup.appendChild(pauseBtn);
  liveGroup.appendChild(statusDot);
  liveGroup.appendChild(statusLabel);
  bar.appendChild(liveGroup);

  const focusGroup = ui_createElement("div", { styleString: groupStyle });
  focusGroup.appendChild(
    ui_createElement("span", { text: "Focus", styleString: labelStyle }),
  );

  const segmentWrap = ui_createElement("div", {
    styleString:
      "display: inline-flex; border: 1px solid var(--ios-border); border-radius: 10px;" +
      " overflow: hidden; background: rgba(0,0,0,0.03);",
  });

  const segmentButtons: Record<PortfolioFocusMode, HTMLButtonElement> = {
    all: ui_createElement("button", {
      text: "All",
      styleString:
        "padding: 4px 10px; border: none; background: transparent; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--ios-text-secondary);",
    }) as HTMLButtonElement,
    breaches: ui_createElement("button", {
      text: "Breaches",
      styleString:
        "padding: 4px 10px; border: none; background: transparent; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--ios-text-secondary);",
    }) as HTMLButtonElement,
    stress: ui_createElement("button", {
      text: "Stress",
      styleString:
        "padding: 4px 10px; border: none; background: transparent; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--ios-text-secondary);",
    }) as HTMLButtonElement,
  };

  (Object.keys(segmentButtons) as PortfolioFocusMode[]).forEach((mode) => {
    segmentWrap.appendChild(segmentButtons[mode]);
  });

  focusGroup.appendChild(segmentWrap);
  bar.appendChild(focusGroup);

  const severityGroup = ui_createElement("div", { styleString: groupStyle });
  severityGroup.appendChild(
    ui_createElement("span", { text: "Severity", styleString: labelStyle }),
  );

  const severitySelect = ui_createElement("select", {
    styleString:
      "padding: 5px 8px; border-radius: 8px; border: 1px solid var(--ios-border);" +
      " background: rgba(255,255,255,0.8); font-size: 11px; font-weight: 600; cursor: pointer;",
  }) as HTMLSelectElement;

  const severityOptions: Array<{
    value: PortfolioSeverityFilter;
    label: string;
  }> = [
    { value: "all", label: "All" },
    { value: "critical", label: "Critical Only" },
    { value: "warning", label: "Warning+" },
  ];

  severityOptions.forEach((opt) => {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    severitySelect.appendChild(el);
  });

  severityGroup.appendChild(severitySelect);
  bar.appendChild(severityGroup);

  const appetiteGroup = ui_createElement("div", {
    styleString:
      "display: inline-flex; align-items: center; gap: 8px; min-width: 200px;",
  });
  appetiteGroup.appendChild(
    ui_createElement("span", {
      text: "Risk Appetite",
      styleString: labelStyle,
    }),
  );

  const appetiteSlider = document.createElement("input");
  appetiteSlider.type = "range";
  appetiteSlider.min = "0";
  appetiteSlider.max = "100";
  appetiteSlider.step = "1";
  appetiteSlider.style.cssText =
    "width: 120px; accent-color: var(--ios-blue); cursor: pointer;";

  const appetiteLabel = ui_createElement("span", {
    styleString:
      "font-size: 11px; font-weight: 700; min-width: 34px; font-variant-numeric: tabular-nums;",
  });

  appetiteGroup.appendChild(appetiteSlider);
  appetiteGroup.appendChild(appetiteLabel);
  bar.appendChild(appetiteGroup);

  const sectionBtnStyle =
    "padding: 5px 10px; border-radius: 8px; border: 1px solid var(--ios-border); background: rgba(255,255,255,0.8);" +
    " font-size: 11px; font-weight: 700; color: var(--ios-text-primary); cursor: pointer;";

  const expandBtn = ui_createElement("button", {
    text: "Expand All",
    styleString: sectionBtnStyle,
  }) as HTMLButtonElement;

  const collapseBtn = ui_createElement("button", {
    text: "Collapse All",
    styleString: sectionBtnStyle,
  }) as HTMLButtonElement;

  bar.appendChild(expandBtn);
  bar.appendChild(collapseBtn);

  const syncFocusStyles = (focusMode: PortfolioFocusMode) => {
    (Object.keys(segmentButtons) as PortfolioFocusMode[]).forEach((mode) => {
      const btn = segmentButtons[mode];
      if (mode === focusMode) {
        btn.style.background = "var(--ios-blue)";
        btn.style.color = "#fff";
      } else {
        btn.style.background = "transparent";
        btn.style.color = "var(--ios-text-secondary)";
      }
    });
  };

  const render = (next: PortfolioControlState) => {
    localState = { ...next };

    pauseBtn.textContent = localState.paused ? "Resume" : "Pause";
    pauseBtn.style.background = localState.paused
      ? "var(--ios-blue)"
      : "rgba(255,255,255,0.8)";
    pauseBtn.style.color = localState.paused
      ? "#fff"
      : "var(--ios-text-primary)";
    pauseBtn.style.borderColor = localState.paused
      ? "var(--ios-blue)"
      : "var(--ios-border)";

    statusDot.style.color = localState.paused
      ? "var(--ios-gray)"
      : "var(--ios-green)";
    statusLabel.textContent = localState.paused ? "Paused" : "Live";
    statusLabel.style.color = localState.paused
      ? "var(--ios-gray)"
      : "var(--ios-green)";

    syncFocusStyles(localState.focusMode);
    severitySelect.value = localState.severityFilter;

    appetiteSlider.value = String(localState.riskAppetite);
    appetiteLabel.textContent = `${localState.riskAppetite}`;
    appetiteLabel.style.color =
      localState.riskAppetite >= 65
        ? DS_COLORS.positive
        : localState.riskAppetite >= 35
          ? DS_COLORS.neutral
          : DS_COLORS.negative;
  };

  const cleanupFns: Array<() => void> = [];

  const onPauseClick = () => {
    callbacks.onPauseToggle(!localState.paused);
  };
  pauseBtn.addEventListener("click", onPauseClick);
  cleanupFns.push(() => pauseBtn.removeEventListener("click", onPauseClick));

  (Object.keys(segmentButtons) as PortfolioFocusMode[]).forEach((mode) => {
    const btn = segmentButtons[mode];
    const onClick = () => callbacks.onFocusModeChange(mode);
    btn.addEventListener("click", onClick);
    cleanupFns.push(() => btn.removeEventListener("click", onClick));
  });

  const onSeverityChange = () => {
    callbacks.onSeverityChange(severitySelect.value as PortfolioSeverityFilter);
  };
  severitySelect.addEventListener("change", onSeverityChange);
  cleanupFns.push(() =>
    severitySelect.removeEventListener("change", onSeverityChange),
  );

  const onAppetiteInput = () => {
    callbacks.onRiskAppetiteChange(parseInt(appetiteSlider.value, 10));
  };
  appetiteSlider.addEventListener("input", onAppetiteInput);
  cleanupFns.push(() =>
    appetiteSlider.removeEventListener("input", onAppetiteInput),
  );

  const onExpandClick = () => callbacks.onExpandAll();
  expandBtn.addEventListener("click", onExpandClick);
  cleanupFns.push(() => expandBtn.removeEventListener("click", onExpandClick));

  const onCollapseClick = () => callbacks.onCollapseAll();
  collapseBtn.addEventListener("click", onCollapseClick);
  cleanupFns.push(() =>
    collapseBtn.removeEventListener("click", onCollapseClick),
  );

  render(localState);

  bar.update = (next: PortfolioControlState) => {
    render(next);
  };

  bar.cleanup = () => {
    cleanupFns.forEach((fn) => fn());
    cleanupFns.length = 0;
  };

  return bar;
}
