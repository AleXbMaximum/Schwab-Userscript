import { ui_createElement } from "../../../components/core/createElement";
import type { BetaFactorScenarioInput } from "../../../../backend/computation/risk/RiskMetricsCalculator";
import { computeLinkedBenchmarkMoves } from "../../../../backend/computation/beta/linkedBenchmark";
import type { ScenarioCardPayload } from "./ScenarioCardPanel";

type CustomInputMode = "manual" | "linked" | "spread";

export function createCustomScenarioBuilder(
  payload: ScenarioCardPayload,
): HTMLElement {
  const isAnchorModel = payload.modelType === "anchor";
  let inputMode: CustomInputMode = "manual";

  const wrap = ui_createElement("div", {
    styleString:
      "padding: 10px 12px; border-radius: 10px; border: 1px solid var(--ios-border);" +
      " background: var(--ax-bg-glass-inset);",
  });

  // Title row with mode pills
  const titleRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;",
  });
  titleRow.appendChild(
    ui_createElement("div", {
      text: "Custom Scenario",
      styleString:
        "font-size: 12px; font-weight: 700; color: var(--ios-text-primary);",
    }),
  );

  const modeGroup = ui_createElement("div", {
    styleString: "display: flex; gap: 4px; margin-left: auto;",
  });
  const modes: { key: CustomInputMode; label: string; title: string }[] = [
    {
      key: "manual",
      label: "Manual",
      title: "Enter all index moves independently",
    },
    {
      key: "linked",
      label: "Linked",
      title: "Auto-fill NDX/DJI from SPX using factor loadings",
    },
    {
      key: "spread",
      label: "Spread",
      title: "Enter SPX + relative spreads (NDX-SPX, DJI-SPX)",
    },
  ];

  const modeBtns: HTMLButtonElement[] = [];
  for (const m of modes) {
    const btn = ui_createElement("button", {
      text: m.label,
      props: { type: "button", title: m.title },
      styleString:
        "padding: 2px 8px; font-size: 9px; font-weight: 600; border-radius: 5px; cursor: pointer;" +
        " border: 1px solid var(--ios-border); transition: all 0.15s;" +
        (m.key === inputMode
          ? " background: var(--ax-blue); color: #fff; border-color: var(--ax-blue);"
          : " background: transparent; color: var(--ios-text-secondary);"),
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => {
      if (isAnchorModel) return;
      inputMode = m.key;
      updateModeUI();
      if (m.key === "linked") syncLinked();
    });
    modeGroup.appendChild(btn);
    modeBtns.push(btn);
  }
  titleRow.appendChild(modeGroup);
  wrap.appendChild(titleRow);

  // Input row
  const inputRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;",
  });

  const inputStyle =
    "width: 56px; padding: 4px 6px; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold);" +
    " border: 1px solid var(--ax-border); border-radius: 6px; text-align: right;" +
    " font-variant-numeric: tabular-nums; background: var(--ax-bg-input);" +
    " outline: none; transition: border-color 0.15s;";

  const createField = (
    label: string,
    defaultVal: string,
    suffix: string,
  ): { input: HTMLInputElement; labelEl: HTMLElement } => {
    const group = ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 4px;",
    });
    const labelEl = ui_createElement("span", {
      text: label,
      styleString:
        "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary);",
    });
    group.appendChild(labelEl);
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.value = defaultVal;
    input.style.cssText = inputStyle;
    input.addEventListener("focus", () => {
      input.style.borderColor = "var(--ios-blue)";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "var(--ios-border)";
    });
    group.appendChild(input);
    group.appendChild(
      ui_createElement("span", {
        text: suffix,
        styleString: "font-size: 10px; color: var(--ios-text-secondary);",
      }),
    );
    inputRow.appendChild(group);
    return { input, labelEl };
  };

  const spxField = createField("SPX", "1.0", "%");
  const ndxField = createField("NDX", "1.2", "%");
  const djiField = createField("DJI", "1.3", "%");
  const volField = createField("Vol", "0", "pt");

  const syncAnchorFromSpx = () => {
    if (!isAnchorModel) return;
    const spxVal = parseFloat(spxField.input.value) || 0;
    ndxField.input.value = spxVal.toFixed(1);
    djiField.input.value = spxVal.toFixed(1);
  };

  // Linked mode: auto-fill NDX/DJI when SPX changes
  const syncLinked = () => {
    if (isAnchorModel) return;
    if (inputMode !== "linked") return;
    const spxVal = parseFloat(spxField.input.value) || 0;
    const { ndxMove, djiMove } = computeLinkedBenchmarkMoves(
      spxVal,
      payload.threeFactorData,
      payload.byUnderlying,
      payload.horizon,
    );
    ndxField.input.value = ndxMove.toFixed(1);
    djiField.input.value = djiMove.toFixed(1);
  };
  spxField.input.addEventListener("input", () => {
    syncAnchorFromSpx();
    syncLinked();
  });

  const updateModeUI = () => {
    const effectiveMode: CustomInputMode = isAnchorModel ? "manual" : inputMode;

    // Update mode buttons
    for (let i = 0; i < modes.length; i++) {
      const active = modes[i].key === effectiveMode;
      modeBtns[i].style.cssText =
        "padding: 2px 8px; font-size: 9px; font-weight: 600; border-radius: 5px; cursor: pointer;" +
        " border: 1px solid var(--ios-border); transition: all 0.15s;" +
        (active
          ? " background: var(--ax-blue); color: #fff; border-color: var(--ax-blue);"
          : " background: transparent; color: var(--ios-text-secondary);") +
        (isAnchorModel ? " opacity: 0.55; cursor: not-allowed;" : "");
      modeBtns[i].disabled = isAnchorModel;
    }

    if (isAnchorModel) {
      ndxField.input.disabled = true;
      djiField.input.disabled = true;
      ndxField.input.style.opacity = "0.5";
      djiField.input.style.opacity = "0.5";
      syncAnchorFromSpx();
    } else if (effectiveMode === "linked") {
      ndxField.input.disabled = true;
      djiField.input.disabled = true;
      ndxField.input.style.opacity = "0.5";
      djiField.input.style.opacity = "0.5";
    } else {
      ndxField.input.disabled = false;
      djiField.input.disabled = false;
      ndxField.input.style.opacity = "1";
      djiField.input.style.opacity = "1";
    }

    if (effectiveMode === "spread" && !isAnchorModel) {
      ndxField.labelEl.textContent = "NDX-SPX";
      djiField.labelEl.textContent = "DJI-SPX";
      ndxField.input.value = "0.2";
      djiField.input.value = "0.3";
    } else {
      ndxField.labelEl.textContent = "NDX";
      djiField.labelEl.textContent = "DJI";
    }
  };

  const runBtn = ui_createElement("button", {
    text: "Run",
    props: { type: "button" },
    styleString:
      "padding: 5px 16px; font-size: 11px; font-weight: 700; border-radius: 8px;" +
      " border: none; background: var(--ax-blue); color: #fff; cursor: pointer;" +
      " transition: opacity 0.15s;",
  });
  runBtn.addEventListener("mouseenter", () => {
    runBtn.style.opacity = "0.85";
  });
  runBtn.addEventListener("mouseleave", () => {
    runBtn.style.opacity = "1";
  });
  runBtn.addEventListener("click", () => {
    const spxMove = parseFloat(spxField.input.value) || 0;
    let ndxMove: number;
    let djiMove: number;

    if (isAnchorModel) {
      ndxMove = spxMove;
      djiMove = spxMove;
    } else if (inputMode === "spread") {
      // Spread mode: NDX = SPX + spread, DJI = SPX + spread
      ndxMove = spxMove + (parseFloat(ndxField.input.value) || 0);
      djiMove = spxMove + (parseFloat(djiField.input.value) || 0);
    } else {
      ndxMove = parseFloat(ndxField.input.value) || 0;
      djiMove = parseFloat(djiField.input.value) || 0;
    }

    const custom: BetaFactorScenarioInput = {
      name: "Custom",
      spxMove,
      ndxMove,
      djiMove,
      volShift: parseFloat(volField.input.value) || 0,
      horizonDays:
        payload.horizon === "ultraShort"
          ? 1
          : payload.horizon === "short"
            ? 30
            : payload.horizon === "medium"
              ? 180
              : 730,
    };
    payload.onCustomScenarioChange(custom);
  });
  inputRow.appendChild(runBtn);

  wrap.appendChild(inputRow);
  if (isAnchorModel) {
    wrap.appendChild(
      ui_createElement("div", {
        text: "Anchor model uses SPX beta only. NDX/DJI are locked to SPX; switch to 3-Factor to model index spreads.",
        styleString:
          "margin-top: 6px; font-size: 10px; color: var(--ios-text-secondary); line-height: 1.35;",
      }),
    );
  }
  updateModeUI();

  return wrap;
}
