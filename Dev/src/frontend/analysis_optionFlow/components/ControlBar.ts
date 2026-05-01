import { ui_createElement } from "frontend/components/core/createElement";
import { MONITOR_SYMBOLS } from "../monitor/monitorSettings";
import type { DashboardSymbol } from "../types";

export interface ControlBarCallbacks {
  onSymbolChange: (symbol: DashboardSymbol) => void;
  onRefresh?: () => void;
}

export interface ControlBarHandle extends HTMLElement {
  updateStatus?: (count: number, loading: boolean) => void;
}

export function renderControlBar(
  currentSymbol: DashboardSymbol,
  callbacks: ControlBarCallbacks,
  symbols?: readonly string[],
): ControlBarHandle {
  const bar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; padding: 8px 12px; flex-wrap: wrap;" +
      " position: relative; z-index: var(--z-page-popover, 210);" +
      " background: var(--ax-glass-2-bg);" +
      " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " border: 1px solid var(--ax-border-subtle); border-radius: var(--ax-radius-lg); margin-bottom: 8px;",
  }) as ControlBarHandle;

  const controlStyle =
    "padding: 4px 8px; font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold); border-radius: var(--ax-radius-md);" +
    " cursor: pointer; border: 1px solid var(--ax-border);" +
    " font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-input); color: var(--ax-fg);" +
    " flex-shrink: 0;";

  // --- Symbol select ---
  const select = ui_createElement("select", {
    styleString: controlStyle + " min-width: 80px;",
    events: {
      change: (e: Event) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val) callbacks.onSymbolChange(val);
      },
    },
  }) as HTMLSelectElement;

  for (const sym of symbols ?? MONITOR_SYMBOLS) {
    const option = document.createElement("option");
    option.value = sym;
    option.textContent = sym;
    if (sym === currentSymbol) option.selected = true;
    select.appendChild(option);
  }
  bar.appendChild(select);

  // --- Refresh button ---
  const refreshBtn = ui_createElement("button", {
    text: "Refresh",
    styleString:
      "padding: 4px 12px; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-bold); border-radius: var(--ax-radius-md);" +
      " cursor: pointer; border: 1px solid var(--ax-border);" +
      " font-family: var(--ax-font-body);" +
      " background: var(--ax-bg-input); color: var(--ax-fg);" +
      " flex-shrink: 0; transition: opacity 0.2s;",
    events: {
      click: () => {
        callbacks.onRefresh?.();
      },
    },
  });
  bar.appendChild(refreshBtn);

  // --- Status badge ---
  const statusBadge = ui_createElement("span", {
    text: "",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); flex-shrink: 0;",
  });
  bar.appendChild(statusBadge);

  // Spacer to push appended elements (copy, settings) to the right
  bar.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  bar.updateStatus = (count: number, loading: boolean) => {
    statusBadge.textContent = loading ? "Loading..." : `${count} openings`;
    refreshBtn.style.opacity = loading ? "0.5" : "1";
    (refreshBtn as HTMLElement).style.pointerEvents = loading ? "none" : "auto";
  };

  return bar;
}
