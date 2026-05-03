import { ui_createElement } from "../../components/core/builders/createElement";
import type{ AIDebateIntensity } from "shared/types/core";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DebateConfigResult {
  debateRow: HTMLElement;
  riskRow: HTMLElement;
  getDebateRounds(): number;
  getRiskRounds(): number;
  getDebateIntensity(): AIDebateIntensity;
  getDebateHeat(): number;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createDebateConfig(opts: {
  initialDebateRounds: number;
  initialRiskRounds: number;
  initialIntensity: AIDebateIntensity;
  initialHeat: number;
  depthBadge: HTMLElement;
  onCostUpdate: () => void;
  onFlowUpdate: () => void;
  onPersist: () => void;
}): DebateConfigResult {
  const {
    depthBadge,
    onCostUpdate,
    onFlowUpdate,
    onPersist,
  } = opts;

  let debateRounds = opts.initialDebateRounds;
  let riskRounds = opts.initialRiskRounds;
  let debateIntensity: AIDebateIntensity = opts.initialIntensity;
  let debateHeat = opts.initialHeat;

  const segBtnStyle = (active: boolean) =>
    "font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold); padding: 4px 10px; border-radius: var(--ax-radius-md); cursor: pointer;" +
    " border: none; transition: background 0.15s;" +
    (active
      ? " background: var(--ax-blue); color: #fff;"
      : " background: rgba(0,122,255,0.08); color: var(--ax-blue);");

  // ── Debate row ──────────────────────────────────────────────────────────
  const debateRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;",
  });

  debateRow.appendChild(
    ui_createElement("span", {
      text: "Debate",
      styleString:
        "font-size: 12px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;",
    }),
  );

  debateRow.appendChild(
    ui_createElement("span", {
      text: "Rounds",
      styleString: "font-size: 12px; color: var(--ios-text-secondary);",
    }),
  );
  const debateRoundsInput = ui_createElement("input", {
    props: { type: "number", value: String(debateRounds), min: 1, max: 5 },
    styleString:
      "width: 44px; padding: 3px 5px; font-size: 12px; border: 1px solid var(--ios-border); border-radius: 6px; text-align: center; font-family: var(--ios-font); outline: none; font-variant-numeric: tabular-nums;",
  }) as HTMLInputElement;
  debateRoundsInput.addEventListener("change", () => {
    debateRounds = Math.max(
      1,
      Math.min(5, parseInt(debateRoundsInput.value, 10) || 2),
    );
    debateRoundsInput.value = String(debateRounds);
    depthBadge.textContent = `${debateRounds}D \u00b7 ${riskRounds}R`;
    onCostUpdate();
    onFlowUpdate();
    onPersist();
  });
  debateRow.appendChild(debateRoundsInput);

  // Intensity pills
  const INTENSITY_OPTIONS: { label: string; value: AIDebateIntensity }[] = [
    { label: "Conservative", value: "conservative" },
    { label: "Moderate", value: "moderate" },
    { label: "Aggressive", value: "aggressive" },
  ];
  const intensityBtns: HTMLButtonElement[] = INTENSITY_OPTIONS.map(
    ({ label, value }) => {
      const btn = ui_createElement("button", {
        text: label,
        styleString: segBtnStyle(value === debateIntensity),
      }) as HTMLButtonElement;
      btn.addEventListener("click", () => {
        debateIntensity = value;
        intensityBtns.forEach((b, i) => {
          b.style.cssText = segBtnStyle(
            INTENSITY_OPTIONS[i].value === debateIntensity,
          );
        });
        onPersist();
      });
      return btn;
    },
  );
  const intensityGroup = ui_createElement("div", {
    styleString: "display: flex; gap: 4px;",
  });
  intensityBtns.forEach((b) => intensityGroup.appendChild(b));
  debateRow.appendChild(intensityGroup);

  // Heat slider
  debateRow.appendChild(
    ui_createElement("span", {
      text: "Heat",
      styleString: "font-size: 12px; color: var(--ios-text-secondary);",
    }),
  );
  const heatInput = ui_createElement("input", {
    props: {
      type: "range",
      min: "0",
      max: "1",
      step: "0.1",
      value: String(debateHeat),
    },
    styleString: "width: 60px; cursor: pointer;",
  }) as HTMLInputElement;
  const heatLabel = ui_createElement("span", {
    text: debateHeat.toFixed(1),
    styleString:
      "font-size: 12px; font-weight: 600; color: var(--ios-text-primary); min-width: 22px; font-variant-numeric: tabular-nums;",
  });
  heatInput.addEventListener("input", () => {
    debateHeat = parseFloat(heatInput.value);
    heatLabel.textContent = debateHeat.toFixed(1);
    onPersist();
  });
  debateRow.appendChild(heatInput);
  debateRow.appendChild(heatLabel);

  // ── Risk rounds row ─────────────────────────────────────────────────────
  const riskRow = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 8px;",
  });
  riskRow.appendChild(
    ui_createElement("span", {
      text: "Risk Rounds",
      styleString:
        "font-size: 12px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;",
    }),
  );
  const riskRoundsInput = ui_createElement("input", {
    props: { type: "number", value: String(riskRounds), min: 1, max: 3 },
    styleString:
      "width: 44px; padding: 3px 5px; font-size: 12px; border: 1px solid var(--ios-border); border-radius: 6px; text-align: center; font-family: var(--ios-font); outline: none; font-variant-numeric: tabular-nums;",
  }) as HTMLInputElement;
  riskRoundsInput.addEventListener("change", () => {
    riskRounds = Math.max(
      1,
      Math.min(3, parseInt(riskRoundsInput.value, 10) || 2),
    );
    riskRoundsInput.value = String(riskRounds);
    depthBadge.textContent = `${debateRounds}D \u00b7 ${riskRounds}R`;
    onCostUpdate();
    onFlowUpdate();
    onPersist();
  });
  riskRow.appendChild(riskRoundsInput);

  return {
    debateRow,
    riskRow,
    getDebateRounds: () => debateRounds,
    getRiskRounds: () => riskRounds,
    getDebateIntensity: () => debateIntensity,
    getDebateHeat: () => debateHeat,
  };
}
