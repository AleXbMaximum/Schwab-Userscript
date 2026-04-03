import { ui_createElement } from "../../../components/core/createElement";
import { DS_COLORS, DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import {
  OPTIONS_SEMANTIC_COLORS as SC,
  CHART_COLORS,
  CHART_FONTS,
} from "frontend/charts/ChartTheme";
import type {
  ExpectedMoveData,
  ExpectedMoveMode,
  ExpectedMoveRND,
  ProbabilityConePoint,
} from "backend/computation/options/types";
import { createRenderFrame } from "../renderFrameController";
import { setupCanvas } from "frontend/charts/ChartUtils";
import { niceScale } from "../../../../shared/utils/math/scale";

const fmt = (v: number | null, d = 2): string =>
  v != null
    ? "$" +
      v.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "--";

function modeLabel(mode: ExpectedMoveMode): string {
  return mode === "straddle"
    ? "Expected Move (Straddle-mid)"
    : "Expected Move (RND)";
}

export function renderExpectedMove(
  emData: ExpectedMoveData,
  rndData: ExpectedMoveRND,
  straddleConeData: ProbabilityConePoint[],
  rndConeData: ProbabilityConePoint[],
  mode: ExpectedMoveMode,
  underlyingPrice: number | null,
  onModeChange: (mode: ExpectedMoveMode) => void,
): HTMLElement & {
  cleanup?: () => void;
  update?: (
    em: ExpectedMoveData,
    rnd: ExpectedMoveRND,
    straddleCone: ProbabilityConePoint[],
    rndCone: ProbabilityConePoint[],
    m: ExpectedMoveMode,
    p: number | null,
  ) => void;
  resize?: () => void;
} {
  const panel = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; height: 100%; overflow: hidden;",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (
      em: ExpectedMoveData,
      rnd: ExpectedMoveRND,
      straddleCone: ProbabilityConePoint[],
      rndCone: ProbabilityConePoint[],
      m: ExpectedMoveMode,
      p: number | null,
    ) => void;
    resize?: () => void;
  };

  const titleEl = ui_createElement("h3", {
    text: modeLabel(mode),
    styleString: DS_TYPOGRAPHY.panelTitle + " flex-shrink: 0;",
  });
  panel.appendChild(titleEl);

  const descEl = ui_createElement("div", {
    text: "",
    styleString: DS_TYPOGRAPHY.panelDesc + " flex-shrink: 0;",
  });
  panel.appendChild(descEl);

  const modeRow = ui_createElement("div", {
    styleString: "display: flex; gap: 6px; margin-bottom: 10px; flex-shrink: 0;",
  });
  panel.appendChild(modeRow);

  let currentMode: ExpectedMoveMode = mode;
  const modeButtons: Record<ExpectedMoveMode, HTMLElement> = {
    straddle: ui_createElement("button", { text: "Straddle-mid" }),
    rnd: ui_createElement("button", { text: "RND" }),
  };

  const updateModeButtons = () => {
    (["straddle", "rnd"] as ExpectedMoveMode[]).forEach((m) => {
      const isActive = m === currentMode;
      modeButtons[m].style.cssText =
        `padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 12px; cursor: pointer;` +
        ` border: 1px solid ${isActive ? "var(--ios-blue)" : "var(--ios-border)"};` +
        ` background: ${isActive ? "var(--ios-blue)" : "rgba(255,255,255,0.6)"};` +
        ` color: ${isActive ? "#fff" : "var(--ios-text-primary)"}; font-family: var(--ios-font);`;
    });
  };

  modeButtons.straddle.addEventListener("click", () => {
    if (currentMode === "straddle") return;
    currentMode = "straddle";
    updateModeButtons();
    onModeChange(currentMode);
  });
  modeButtons.rnd.addEventListener("click", () => {
    if (currentMode === "rnd") return;
    currentMode = "rnd";
    updateModeButtons();
    onModeChange(currentMode);
  });

  modeRow.appendChild(modeButtons.straddle);
  modeRow.appendChild(modeButtons.rnd);
  updateModeButtons();

  const contentContainer = ui_createElement("div", {
    styleString: "flex-shrink: 0;",
  });
  panel.appendChild(contentContainer);

  const canvasContainer = ui_createElement("div", {
    styleString: "width: 100%; margin-top: 10px; flex: 1 1 0; min-height: 0; overflow: hidden;",
  });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display: block;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Probability cone chart");
  canvasContainer.appendChild(canvas);
  panel.appendChild(canvasContainer);

  let currentEM = emData;
  let currentRND = rndData;
  let currentStraddleCone = straddleConeData;
  let currentRndCone = rndConeData;
  let currentPrice = underlyingPrice;

  const currentCone = () =>
    currentMode === "straddle" ? currentStraddleCone : currentRndCone;

  const renderContent = () => {
    contentContainer.innerHTML = "";
    titleEl.textContent = modeLabel(currentMode);

    descEl.textContent =
      currentMode === "straddle"
        ? "Market-implied move from ATM straddle mid-price. Cone shows ±1σ (68%) and ±2σ (95%) bounds."
        : "Risk-neutral density mode (Breeden-Litzenberger approximation). Cone shows 16/84% and 2.5/97.5% bounds.";

    const cardsRow = ui_createElement("div", {
      styleString:
        "display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline;" +
        " font-variant-numeric: tabular-nums lining-nums; line-height: 1.3;",
    });

    const createChip = (
      label: string,
      value: string,
      sub?: string,
      color?: string,
    ) => {
      const chip = ui_createElement("span", {
        styleString:
          "display: inline-flex; align-items: baseline; gap: 4px;" +
          " padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.03);" +
          " border: 1px solid rgba(0,0,0,0.05); white-space: nowrap;",
      });
      chip.appendChild(
        ui_createElement("span", {
          text: label + ":",
          styleString:
            "font-size: 9px; font-weight: 600; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.3px;",
        }),
      );
      chip.appendChild(
        ui_createElement("span", {
          text: value,
          styleString: `font-size: 12px; font-weight: 800; color: ${color ?? "var(--ios-text-primary)"};`,
        }),
      );
      if (sub) {
        chip.appendChild(
          ui_createElement("span", {
            text: sub,
            styleString: "font-size: 9px; color: var(--ios-text-secondary);",
          }),
        );
      }
      return chip;
    };

    if (currentMode === "straddle") {
      cardsRow.appendChild(
        createChip(
          "ATM Straddle (mid)",
          fmt(currentEM.straddlePrice),
          `Call: ${fmt(currentEM.atmCallPrice)} / Put: ${fmt(currentEM.atmPutPrice)}`,
        ),
      );

      cardsRow.appendChild(
        createChip(
          "Expected Move (1σ)",
          currentEM.expectedMove != null
            ? `±${fmt(currentEM.expectedMove)}`
            : "--",
          currentEM.expectedMovePct != null
            ? `±${currentEM.expectedMovePct.toFixed(2)}%`
            : undefined,
          SC.spot,
        ),
      );

      cardsRow.appendChild(
        createChip(
          "68% Range",
          currentEM.lowerBound1Sigma != null &&
            currentEM.upperBound1Sigma != null
            ? `${fmt(currentEM.lowerBound1Sigma, 1)} – ${fmt(currentEM.upperBound1Sigma, 1)}`
            : "--",
          `${currentEM.daysUntil}d to expiry`,
          SC.bullish,
        ),
      );

      cardsRow.appendChild(
        createChip(
          "95% Range (2σ)",
          currentEM.lowerBound2Sigma != null &&
            currentEM.upperBound2Sigma != null
            ? `${fmt(currentEM.lowerBound2Sigma, 1)} – ${fmt(currentEM.upperBound2Sigma, 1)}`
            : "--",
          `${currentEM.daysUntil}d to expiry`,
          SC.bearish,
        ),
      );
    } else {
      cardsRow.appendChild(
        createChip(
          "RND 1σ Move",
          currentRND.adjustedMove != null
            ? `±${fmt(currentRND.adjustedMove)}`
            : "--",
          currentRND.adjustedMovePct != null
            ? `±${currentRND.adjustedMovePct.toFixed(2)}%`
            : undefined,
          SC.spot,
        ),
      );
      cardsRow.appendChild(
        createChip(
          "RND 68% Range",
          currentRND.rndBounds68
            ? `${fmt(currentRND.rndBounds68.lower, 1)} – ${fmt(currentRND.rndBounds68.upper, 1)}`
            : "--",
          `${currentEM.daysUntil}d to expiry`,
          SC.bullish,
        ),
      );
      cardsRow.appendChild(
        createChip(
          "RND 95% Range",
          currentRND.rndBounds95
            ? `${fmt(currentRND.rndBounds95.lower, 1)} – ${fmt(currentRND.rndBounds95.upper, 1)}`
            : "--",
          `${currentEM.daysUntil}d to expiry`,
          SC.bearish,
        ),
      );
      cardsRow.appendChild(
        createChip(
          "RND Shape",
          `Skew ${currentRND.skew.toFixed(2)}`,
          `Kurtosis ${currentRND.kurtosis.toFixed(2)}`,
          DS_COLORS.raw.purple,
        ),
      );
    }

    contentContainer.appendChild(cardsRow);
  };

  const renderCone = () => {
    const cone = currentCone();
    const validPoints = cone.filter((p) => p.upper1Sigma != null);
    if (validPoints.length < 2 || currentPrice == null) {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";

    const parent = canvas.parentElement;
    const w = parent ? Math.max(parent.clientWidth - 4, 240) : 600;
    const h = canvasContainer.clientHeight || 260;
    const ctx = setupCanvas(canvas, w, h);
    if (!ctx) return;

    const pad = { top: 20, right: 30, bottom: 35, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    let priceMin = currentPrice;
    let priceMax = currentPrice;
    for (const p of validPoints) {
      if (p.upper2Sigma != null) {
        if (p.upper2Sigma > priceMax) priceMax = p.upper2Sigma;
        if (p.upper2Sigma < priceMin) priceMin = p.upper2Sigma;
      }
      if (p.lower2Sigma != null) {
        if (p.lower2Sigma > priceMax) priceMax = p.lower2Sigma;
        if (p.lower2Sigma < priceMin) priceMin = p.lower2Sigma;
      }
    }
    const niceY = niceScale({
      dataMin: priceMin,
      dataMax: priceMax,
      maxTicks: 6,
      padding: 0.05,
    });
    const paddedMin = niceY.min;
    const paddedMax = niceY.max;
    const paddedRange = paddedMax - paddedMin;

    const maxDays = validPoints[validPoints.length - 1].daysUntil;
    const toXDays = (days: number) => pad.left + (days / maxDays) * chartW;
    const toY = (v: number) =>
      pad.top + chartH - ((v - paddedMin) / paddedRange) * chartH;

    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;
    for (const tick of niceY.ticks) {
      const y = toY(tick);
      if (y < pad.top - 1 || y > pad.top + chartH + 1) continue;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = "#8E8E93";
      ctx.font = CHART_FONTS.tick;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`$${tick.toFixed(0)}`, pad.left - 6, y);
    }

    ctx.beginPath();
    ctx.moveTo(toXDays(0), toY(currentPrice));
    for (let i = 0; i < validPoints.length; i++) {
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].upper2Sigma!),
      );
    }
    for (let i = validPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].lower2Sigma!),
      );
    }
    ctx.lineTo(toXDays(0), toY(currentPrice));
    ctx.closePath();
    ctx.fillStyle = "rgba(215, 49, 38, 0.08)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toXDays(0), toY(currentPrice));
    for (let i = 0; i < validPoints.length; i++) {
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].upper1Sigma!),
      );
    }
    for (let i = validPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].lower1Sigma!),
      );
    }
    ctx.lineTo(toXDays(0), toY(currentPrice));
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 122, 255, 0.12)";
    ctx.fill();

    ctx.strokeStyle = "rgba(215, 49, 38, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(toXDays(0), toY(currentPrice));
    for (let i = 0; i < validPoints.length; i++)
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].upper2Sigma!),
      );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toXDays(0), toY(currentPrice));
    for (let i = 0; i < validPoints.length; i++)
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].lower2Sigma!),
      );
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#007AFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toXDays(0), toY(currentPrice));
    for (let i = 0; i < validPoints.length; i++)
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].upper1Sigma!),
      );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toXDays(0), toY(currentPrice));
    for (let i = 0; i < validPoints.length; i++)
      ctx.lineTo(
        toXDays(validPoints[i].daysUntil),
        toY(validPoints[i].lower1Sigma!),
      );
    ctx.stroke();

    ctx.strokeStyle = "#1c1c1e";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, toY(currentPrice));
    ctx.lineTo(w - pad.right, toY(currentPrice));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#1c1c1e";
    ctx.font = CHART_FONTS.axisSemibold;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `Spot $${currentPrice.toFixed(2)}`,
      pad.left + 4,
      toY(currentPrice) - 4,
    );

    ctx.fillStyle = "#8E8E93";
    ctx.font = CHART_FONTS.tick;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Now", toXDays(0), pad.top + chartH + 5);
    let lastLabelX = toXDays(0);
    for (let i = 0; i < validPoints.length; i++) {
      const x = toXDays(validPoints[i].daysUntil);
      if (x - lastLabelX >= 30) {
        const d = validPoints[i].daysUntil;
        const label =
          d >= 365
            ? `${(d / 365).toFixed(1)}y`
            : d >= 30
              ? `${Math.round(d / 30)}mo`
              : `${d}d`;
        ctx.fillText(label, x, pad.top + chartH + 5);
        lastLabelX = x;
      }
    }

    ctx.font = CHART_FONTS.tick;
    ctx.textAlign = "right";
    ctx.fillStyle = "#007AFF";
    ctx.fillText(
      currentMode === "straddle" ? "±1σ (68%)" : "16-84%",
      w - pad.right,
      pad.top + 10,
    );
    ctx.fillStyle = "#d73126";
    ctx.fillText(
      currentMode === "straddle" ? "±2σ (95%)" : "2.5-97.5%",
      w - pad.right,
      pad.top + 22,
    );
  };

  renderContent();
  const frame = createRenderFrame(panel, renderCone);
  frame.schedule();

  panel.update = (
    em: ExpectedMoveData,
    rnd: ExpectedMoveRND,
    straddleCone: ProbabilityConePoint[],
    rndCone: ProbabilityConePoint[],
    m: ExpectedMoveMode,
    p: number | null,
  ) => {
    currentEM = em;
    currentRND = rnd;
    currentStraddleCone = straddleCone;
    currentRndCone = rndCone;
    currentMode = m;
    currentPrice = p;
    updateModeButtons();
    renderContent();
    frame.schedule();
  };

  panel.resize = () => {
    frame.schedule();
  };

  panel.cleanup = () => {
    frame.destroy();
  };

  return panel;
}
