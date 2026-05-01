import { ui_createElement } from "../../../components/core/createElement";
import { attachLiquidGlassRim } from "../../../components/core/axTheme/liquidGlass";
import type { AlertItem, SectionId } from "../../types";

const containerStyle =
  "position: fixed; bottom: 20px; right: 20px; z-index: var(--z-alert, 100000);" +
  " display: flex; flex-direction: column; gap: 8px;" +
  " pointer-events: none; max-width: 340px;" +
  " font-family: var(--ax-font-body);";

// Severity rows ride glass tier-2 + a tone-tinted left bar so they tone-match
// dark and light themes automatically. Solid-colour blocks (the original
// design) read as bright slabs against dark chrome and white slabs against
// light chrome \u2014 neither felt liquid. The tinted-glass approach is what
// recorder.user.js does for its `.match-info` / `.footer button.warn`.
const alertRowBase =
  "pointer-events: auto; padding: 9px 12px 9px 14px; border-radius: var(--ax-radius-lg);" +
  " border: 1px solid var(--ax-glass-2-border);" +
  " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);" +
  " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
  " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
  " color: var(--ax-fg); font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold); cursor: pointer;" +
  " display: flex; align-items: center; gap: 8px;" +
  " position: relative; overflow: hidden;" +
  " opacity: 0; transform: translateX(100px);" +
  " transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)," +
  " transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)," +
  " box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);";

// Per-severity layer: a tone-tinted gradient over the glass + a solid colour
// for the left accent bar (drawn via inline-html ::before equivalent).
const severityConfig: Record<
  "P0" | "P1",
  { tint: string; accent: string; icon: string }
> = {
  P0: {
    tint:
      "linear-gradient(180deg," +
      " color-mix(in srgb, var(--ax-critical) 18%, transparent)," +
      " color-mix(in srgb, var(--ax-critical) 7%, transparent)),"+
      " var(--ax-glass-2-bg)",
    accent: "var(--ax-critical)",
    icon: "\u26A0",
  },
  P1: {
    tint:
      "linear-gradient(180deg," +
      " color-mix(in srgb, var(--ax-orange) 16%, transparent)," +
      " color-mix(in srgb, var(--ax-orange) 6%, transparent)),"+
      " var(--ax-glass-2-bg)",
    accent: "var(--ax-orange)",
    icon: "\u25C6",
  },
};

const badgeStyle =
  "pointer-events: auto; padding: 4px 10px; border-radius: var(--ax-radius-lg);" +
  " background: var(--ax-glass-1-bg); color: var(--ax-fg);" +
  " border: 1px solid var(--ax-glass-1-border);" +
  " font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-bold); cursor: pointer;" +
  " box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);" +
  " -webkit-backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate));" +
  " backdrop-filter: blur(var(--ax-glass-1-blur)) saturate(var(--ax-glass-1-saturate));" +
  " display: flex; align-items: center; gap: 6px;" +
  " opacity: 0; transform: translateX(100px);" +
  " transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)," +
  " transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);";

export type AlertPanelHandle = HTMLElement & {
  cleanup?: () => void;
  update?: (alerts: AlertItem[]) => void;
};

export function renderAlertPanel(
  onJump: (sectionId: SectionId, cardId: string) => void,
): AlertPanelHandle {
  const container = ui_createElement("div", {
    className: "ax-shell-element",
    styleString: containerStyle,
  }) as AlertPanelHandle;
  document.body.appendChild(container);

  let collapsed = false;
  let currentAlerts: AlertItem[] = [];
  const timers: number[] = [];

  const render = () => {
    container.innerHTML = "";
    for (const t of timers) clearTimeout(t);
    timers.length = 0;

    if (currentAlerts.length === 0) return;

    if (collapsed || currentAlerts.length > 3) {
      const p0Count = currentAlerts.filter((a) => a.severity === "P0").length;
      const p1Count = currentAlerts.filter((a) => a.severity === "P1").length;
      const parts: string[] = [];
      if (p0Count > 0) parts.push(`${p0Count} critical`);
      if (p1Count > 0) parts.push(`${p1Count} warning`);
      const label = parts.join(", ");

      const badge = ui_createElement("div", {
        text: collapsed ? `\u26A0 ${label} — tap to expand` : `\u26A0 ${label}`,
        styleString: badgeStyle,
        events: {
          click: () => {
            collapsed = !collapsed;
            render();
          },
        },
      });
      container.appendChild(badge);

      timers.push(
        window.setTimeout(() => {
          badge.style.opacity = "1";
          badge.style.transform = "translateX(0)";
        }, 16),
      );

      if (collapsed) return;
    }

    const visible = currentAlerts.slice(0, 5);
    for (let i = 0; i < visible.length; i++) {
      const alert = visible[i];
      const cfg = severityConfig[alert.severity];
      const row = ui_createElement("div", {
        className: "ax-glass-rim",
        styleString:
          alertRowBase +
          ` background: ${cfg.tint};` +
          ` --alert-accent: ${cfg.accent};` +
          " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge)," +
          " inset 3px 0 0 var(--alert-accent);",
        events: {
          click: () => onJump(alert.sectionId, alert.cardId),
        },
      });
      attachLiquidGlassRim(row);

      row.appendChild(
        ui_createElement("span", {
          text: cfg.icon,
          styleString: `font-size: var(--ax-fs-lg); flex-shrink: 0; color: ${cfg.accent};`,
        }),
      );
      row.appendChild(
        ui_createElement("span", {
          text: alert.reason,
          styleString:
            "flex: 1; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
        }),
      );
      row.appendChild(
        ui_createElement("span", {
          text: "\u2192",
          styleString:
            "font-size: var(--ax-fs-lg); opacity: 0.7; flex-shrink: 0; color: var(--ax-fg-2);",
        }),
      );

      container.appendChild(row);

      timers.push(
        window.setTimeout(
          () => {
            row.style.opacity = "1";
            row.style.transform = "translateX(0)";
          },
          50 + i * 80,
        ),
      );
    }
  };

  container.update = (alerts: AlertItem[]) => {
    currentAlerts = alerts;
    collapsed = false;
    render();
  };

  container.cleanup = () => {
    for (const t of timers) clearTimeout(t);
    if (container.parentNode) container.parentNode.removeChild(container);
  };

  return container;
}
