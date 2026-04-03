import { ui_createElement } from "../../../components/core/createElement";
import type { AlertItem, SectionId } from "../../types";

const containerStyle =
  "position: fixed; bottom: 20px; right: 20px; z-index: var(--z-alert, 100000);" +
  " display: flex; flex-direction: column; gap: 8px;" +
  " pointer-events: none; max-width: 340px;" +
  " font-family: var(--ios-font);";

const alertRowBase =
  "pointer-events: auto; padding: 8px 12px; border-radius: 8px;" +
  " box-shadow: var(--ios-shadow-md);" +
  " color: #fff; font-size: 12px; cursor: pointer;" +
  " display: flex; align-items: center; gap: 8px;" +
  " opacity: 0; transform: translateX(100px);" +
  " transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);";

const severityConfig: Record<"P0" | "P1", { bg: string; icon: string }> = {
  P0: { bg: "rgba(215, 49, 38, 0.95)", icon: "\u26A0" },
  P1: { bg: "rgba(215, 129, 0, 0.95)", icon: "\u25C6" },
};

const badgeStyle =
  "pointer-events: auto; padding: 4px 10px; border-radius: 8px;" +
  " background: rgba(60, 60, 67, 0.9); color: #fff;" +
  " font-size: 11px; font-weight: 600; cursor: pointer;" +
  " box-shadow: var(--ios-shadow-sm);" +
  " display: flex; align-items: center; gap: 6px;" +
  " opacity: 0; transform: translateX(100px);" +
  " transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);";

export type AlertPanelHandle = HTMLElement & {
  cleanup?: () => void;
  update?: (alerts: AlertItem[]) => void;
};

export function renderAlertPanel(
  onJump: (sectionId: SectionId, cardId: string) => void,
): AlertPanelHandle {
  const container = ui_createElement("div", {
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
        styleString: alertRowBase + ` background: ${cfg.bg};`,
        events: {
          click: () => onJump(alert.sectionId, alert.cardId),
        },
      });

      row.appendChild(
        ui_createElement("span", {
          text: cfg.icon,
          styleString: "font-size: 12px; flex-shrink: 0;",
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
            "font-size: 12px; opacity: 0.7; flex-shrink: 0;" /* DS_OPACITY.muted */,
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
