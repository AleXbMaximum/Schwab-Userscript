import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, DS_COLORS } from "../../../components/core/theme";
import type { RiskMetrics } from "../../../../backend/computation/risk/RiskMetricsCalculator";
import type{ PortfolioAgg } from "../../../../shared/types/derived";

type HealthPayload = {
  riskMetrics: RiskMetrics;
  portfolioAgg?: PortfolioAgg | null;
};

type HealthState = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  worstStressPct: number;
  top1Pct: number;
  drivers: string[];
};

const titleStyle = DS_TYPOGRAPHY.panelTitle + " margin-bottom: 6px;";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function computeHealth(payload: HealthPayload): HealthState {
  const metrics = payload.riskMetrics;

  const top1Pct = metrics.topUnderlyingConcentrations[0]?.deltaPct ?? 0;
  const worstStressPct = Math.min(
    0,
    ...metrics.scenarios
      .filter((s) =>
        ["Worst Case", "Black Swan", "Flash Crash", "Market -5%"].includes(
          s.name,
        ),
      )
      .map((s) => s.pnlPct),
  );

  // Convert ratios to 0–100 for penalty math
  const marginPct100 = metrics.marginUtilizationPct * 100;
  const top1Pct100 = top1Pct * 100;
  const worstStressPct100 = worstStressPct * 100;
  const penalties = {
    margin: Math.max(0, marginPct100 - 55) * 0.7,
    beta: Math.max(0, metrics.currentBeta - 1) * 36,
    breaches: metrics.limitBreaches.length * 11,
    concentration: Math.max(0, top1Pct100 - 30) * 0.85,
    stress: Math.abs(Math.min(0, worstStressPct100)) * 0.9,
  };

  const score = clamp(
    Math.round(
      100 -
        penalties.margin -
        penalties.beta -
        penalties.breaches -
        penalties.concentration -
        penalties.stress,
    ),
    0,
    100,
  );

  const grade: "A" | "B" | "C" | "D" =
    score >= 80 ? "A" : score >= 65 ? "B" : score >= 45 ? "C" : "D";

  const drivers: string[] = [];
  if (penalties.margin > 8)
    drivers.push(
      `Margin utilization ${marginPct100.toFixed(1)}% is elevated`,
    );
  if (penalties.beta > 8)
    drivers.push(`Beta ${metrics.currentBeta.toFixed(2)} is above baseline`);
  if (penalties.breaches > 0)
    drivers.push(
      `${metrics.limitBreaches.length} active risk-limit breach(es)`,
    );
  if (penalties.concentration > 6)
    drivers.push(`Top underlying concentration ${top1Pct100.toFixed(1)}%`);
  if (penalties.stress > 8)
    drivers.push(`Worst stress scenario ${worstStressPct100.toFixed(2)}%`);
  if (drivers.length === 0)
    drivers.push("No immediate stress drivers detected across core limits.");

  return {
    score,
    grade,
    worstStressPct,
    top1Pct,
    drivers,
  };
}

function gradeColor(grade: HealthState["grade"]): string {
  if (grade === "A") return DS_COLORS.raw.positive;
  if (grade === "B") return DS_COLORS.raw.positive;
  if (grade === "C") return DS_COLORS.raw.neutral;
  return DS_COLORS.raw.negative;
}

export function renderPortfolioHealthScore(
  payload: HealthPayload,
): HTMLElement & {
  cleanup?: () => void;
  update?: (next: HealthPayload) => void;
} {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (next: HealthPayload) => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Portfolio Health Score",
      styleString: titleStyle,
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "Composite signal from margin, beta, concentration, stress loss and active breaches.",
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  const ringWrap = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;",
  });

  const ring = ui_createElement("div", {
    styleString:
      "width: 92px; height: 92px; border-radius: 50%; display: grid; place-items: center;" +
      ` background: conic-gradient(${DS_COLORS.raw.positive} 0deg, rgba(0,0,0,0.08) 0deg);`,
  });

  const ringInner = ui_createElement("div", {
    styleString:
      "width: 68px; height: 68px; border-radius: 50%; background: rgba(255,255,255,0.92);" +
      " display: flex; flex-direction: column; align-items: center; justify-content: center;",
  });

  const scoreEl = ui_createElement("div", {
    styleString: DS_TYPOGRAPHY.largeValue,
  });
  const gradeEl = ui_createElement("div", {
    styleString: "font-size: 10px; font-weight: 700; line-height: 1.2;",
  });
  ringInner.appendChild(scoreEl);
  ringInner.appendChild(gradeEl);
  ring.appendChild(ringInner);

  const sideStats = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; gap: 6px; min-width: 140px;",
  });

  const topConcentrationEl = ui_createElement("div", {
    styleString:
      "font-size: 12px; font-weight: 600; color: var(--ios-text-primary);",
  });
  const worstStressEl = ui_createElement("div", {
    styleString:
      "font-size: 12px; font-weight: 600; color: var(--ios-text-primary);",
  });

  sideStats.appendChild(topConcentrationEl);
  sideStats.appendChild(worstStressEl);

  ringWrap.appendChild(ring);
  ringWrap.appendChild(sideStats);
  panel.appendChild(ringWrap);

  const driverTitle = ui_createElement("div", {
    text: "Primary Drivers",
    styleString:
      "font-size: 10px; font-weight: 700; letter-spacing: 0.5px; color: var(--ios-text-secondary); margin-bottom: 4px;",
  });
  panel.appendChild(driverTitle);

  const driverList = ui_createElement("div", {
    styleString: "display: flex; flex-direction: column; gap: 6px;",
  });
  panel.appendChild(driverList);

  const render = (next: HealthPayload) => {
    const health = computeHealth(next);
    const color = gradeColor(health.grade);

    const deg = Math.round((health.score / 100) * 360);
    ring.style.background = `conic-gradient(${color} ${deg}deg, rgba(0,0,0,0.08) ${deg}deg)`;

    scoreEl.textContent = String(health.score);
    scoreEl.style.color = color;

    gradeEl.textContent = `Grade ${health.grade}`;
    gradeEl.style.color = color;

    topConcentrationEl.textContent = `Top concentration: ${(health.top1Pct * 100).toFixed(1)}%`;
    topConcentrationEl.style.color =
      health.top1Pct > 0.35
        ? DS_COLORS.negative
        : health.top1Pct > 0.25
          ? DS_COLORS.neutral
          : "var(--ios-text-primary)";

    worstStressEl.textContent = `Worst stress: ${(health.worstStressPct * 100).toFixed(2)}%`;
    worstStressEl.style.color =
      health.worstStressPct < -0.08
        ? DS_COLORS.negative
        : health.worstStressPct < -0.04
          ? DS_COLORS.neutral
          : "var(--ios-text-primary)";

    driverList.innerHTML = "";
    health.drivers.forEach((driver) => {
      driverList.appendChild(
        ui_createElement("div", {
          text: driver,
          styleString:
            "padding: 6px 10px; border-radius: 8px; font-size: 11px; line-height: 1.35;" +
            " background: rgba(0,0,0,0.03); color: var(--ios-text-secondary); border: 1px solid rgba(0,0,0,0.06);",
        }),
      );
    });
  };

  render(payload);

  panel.update = (next: HealthPayload) => {
    render(next);
  };

  return panel;
}
