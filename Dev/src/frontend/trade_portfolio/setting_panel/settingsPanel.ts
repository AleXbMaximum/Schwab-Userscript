import type{ HoldingsViewCtx } from "shared/types/core";
import { ui_createElement } from "../../components/core/builders/createElement";
import {
  createSettingsPopoverScaffold,
  createSettingsPopoverController,
  createSettingsPanelTitle,
  createSettingsPanelHint,
  createSettingsSectionCard,
  createSettingsNumberControl,
  appendSettingsFormRow,
  createSettingsActionButton,
  createSettingsJsonEditorModal,
} from "../../components/core/settingsFramework";

export interface PortfolioSettingsPanelResult {
  root: HTMLElement;
  cleanup: () => void;
}

export function createPortfolioSettingsPanel(opts: {
  ctx: HoldingsViewCtx;
  settings: Record<string, unknown>;
  onRecalculate: () => void;
}): PortfolioSettingsPanelResult {
  const { ctx, settings, onRecalculate } = opts;

  const { wrap, button, panel } = createSettingsPopoverScaffold({
    title: "Portfolio Settings",
    ariaLabel: "Portfolio Settings",
  });
  panel.appendChild(createSettingsPanelTitle("Portfolio Settings"));
  panel.appendChild(
    createSettingsPanelHint(
      "Configure warning rules, risk limits, and beta settings.",
    ),
  );

  const numControl = (key: string, fallback: number, min: number, step: number, unit: string) =>
    createSettingsNumberControl({ settings, ctx, key, fallback, min, step, unit });

  // ── Warnings Rules (JSON) ── modal ───────────────────────────────────────
  const defaultWarningsJson = '{\n  "version": 1,\n  "rules": []\n}';
  const warningsModal = createSettingsJsonEditorModal({
    title: "Warnings Rules (JSON)",
    description:
      'Expected shape: { "version": 1, "rules": [...] }. Metrics: POSITION uses "derived.<field>", UNDERLYING uses "derivedUnderlying.<field>", PORTFOLIO uses "portfolio.<field>".',
    getValue: () => (settings as any).warningRulesJson ?? defaultWarningsJson,
    validate: (raw) => {
      try {
        const parsed = JSON.parse(raw || "{}");
        if (!parsed || typeof parsed !== "object")
          return "Invalid JSON: root must be an object";
        return null;
      } catch (e) {
        return `Invalid JSON: ${(e as any)?.message ?? String(e)}`;
      }
    },
    onApply: (raw) => {
      ctx.onUpdateSettings({ warningRulesJson: raw } as any);
    },
  });
  wrap.appendChild(warningsModal.backdrop);
  document.addEventListener("keydown", warningsModal.onEscapeHandler);

  const warningsSection = createSettingsSectionCard("Warnings Rules (JSON)");
  const warningsEditBtn = createSettingsActionButton("Edit");
  warningsEditBtn.addEventListener("click", () => warningsModal.setOpen(true));
  appendSettingsFormRow({
    body: warningsSection.body,
    label: "Warning Rules",
    controlEl: warningsEditBtn,
  });
  panel.appendChild(warningsSection.section);

  // ── Risk Limits (JSON) ── modal ──────────────────────────────────────────
  // Pct limits are ratios 0–1 (e.g. 0.75 = 75%)
  const defaultRiskLimits = {
    maxMarginUtilizationPct: 0.75,
    maxBeta: 1.2,
    maxSingleUnderlyingDeltaPct: 0.30,
    maxSingleUnderlyingMarketValuePct: 0.40,
    maxNetDeltaShares: 5000,
    maxAbsVegaPerVolPoint: 10000,
    maxDailyLossPct: 0.05,
    maxDailyLossDollar: 5000,
  };
  const riskLimitsModal = createSettingsJsonEditorModal({
    title: "Risk Limits",
    description:
      "Configure risk limits for monitoring and alerts. All limits are optional.",
    getValue: () =>
      (settings as any).riskLimits
        ? JSON.stringify((settings as any).riskLimits, null, 2)
        : JSON.stringify(defaultRiskLimits, null, 2),
    validate: (raw) => {
      try {
        const parsed = JSON.parse(raw || "{}");
        if (!parsed || typeof parsed !== "object")
          return "Invalid JSON: root must be an object";
        return null;
      } catch (e) {
        return `Invalid JSON: ${(e as any)?.message ?? String(e)}`;
      }
    },
    onApply: (raw) => {
      ctx.onUpdateSettings({ riskLimits: JSON.parse(raw) } as any);
    },
  });
  wrap.appendChild(riskLimitsModal.backdrop);
  document.addEventListener("keydown", riskLimitsModal.onEscapeHandler);

  const riskLimitsSection = createSettingsSectionCard("Risk Limits");
  const riskLimitsEditBtn = createSettingsActionButton("Edit");
  riskLimitsEditBtn.addEventListener("click", () =>
    riskLimitsModal.setOpen(true),
  );
  appendSettingsFormRow({
    body: riskLimitsSection.body,
    label: "Risk Limits",
    controlEl: riskLimitsEditBtn,
  });
  panel.appendChild(riskLimitsSection.section);

  // ── Target Allocations (JSON) ── modal ───────────────────────────────────
  const targetAllocModal = createSettingsJsonEditorModal({
    title: "Target Allocations",
    description:
      'JSON object mapping underlying symbols to target allocation % (0-100). Example: { "AAPL": 25, "MSFT": 20 }',
    getValue: () =>
      (settings as any).targetAllocations
        ? JSON.stringify((settings as any).targetAllocations, null, 2)
        : "{}",
    validate: (raw) => {
      try {
        const parsed = JSON.parse(raw || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          return 'Invalid JSON: must be an object like { "AAPL": 25 }';
        return null;
      } catch (e) {
        return `Invalid JSON: ${(e as any)?.message ?? String(e)}`;
      }
    },
    onApply: (raw) => {
      ctx.onUpdateSettings({ targetAllocations: JSON.parse(raw) } as any);
    },
  });
  wrap.appendChild(targetAllocModal.backdrop);
  document.addEventListener("keydown", targetAllocModal.onEscapeHandler);

  const targetAllocSection = createSettingsSectionCard("Target Allocations");
  const targetAllocEditBtn = createSettingsActionButton("Edit");
  targetAllocEditBtn.addEventListener("click", () =>
    targetAllocModal.setOpen(true),
  );
  appendSettingsFormRow({
    body: targetAllocSection.body,
    label: "Target Allocations",
    controlEl: targetAllocEditBtn,
  });
  panel.appendChild(targetAllocSection.section);

  // ── Beta Calculation ─────────────────────────────────────────────────────
  const betaSection = createSettingsSectionCard("Beta Calculation");
  betaSection.body.appendChild(
    ui_createElement("div", {
      text: "Configure how often portfolio betas are recalculated against S&P 500.",
      styleString:
        "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.2; margin: 4px 0 8px;",
    }),
  );
  appendSettingsFormRow({
    body: betaSection.body,
    label: "Refresh Interval",
    controlEl: numControl("betaRefreshIntervalMs", 7_200_000, 100, 100, "ms"),
  });
  const betaActionRow = ui_createElement("div", {
    styleString: "display: flex; justify-content: flex-end; margin-top: 8px;",
  });
  const betaRecalcNowBtn = createSettingsActionButton("Recalculate Now", {
    width: 120,
  });
  betaRecalcNowBtn.addEventListener("click", onRecalculate);
  betaActionRow.appendChild(betaRecalcNowBtn);
  betaSection.body.appendChild(betaActionRow);
  panel.appendChild(betaSection.section);

  // ── Popover controller ───────────────────────────────────────────────────
  const allModals = [warningsModal, riskLimitsModal, targetAllocModal];
  const popover = createSettingsPopoverController({
    button,
    panel,
    onClose: () => allModals.forEach((m) => m.setOpen(false)),
    extraInsideTargets: allModals.map((m) => m.backdrop),
  });

  return {
    root: wrap,
    cleanup: () => {
      allModals.forEach((m) => {
        document.removeEventListener("keydown", m.onEscapeHandler);
        m.setOpen(false);
      });
      popover.cleanup();
    },
  };
}
