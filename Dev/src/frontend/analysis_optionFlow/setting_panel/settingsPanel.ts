import { ui_createElement } from "frontend/components/core/builders/createElement";
import {
  createSettingsPopoverScaffold,
  createSettingsPopoverController,
  createSettingsPanelTitle,
} from "frontend/components/core/settingsFramework";
import { optionFlowSettings_renderPage } from "./flowPageSetting";

export interface FlowSettingsPanelResult {
  root: HTMLElement;
  cleanup: () => void;
}

export function createFlowSettingsPanel(
  ctx: any,
): FlowSettingsPanelResult {
  const { wrap, button, panel } = createSettingsPopoverScaffold({
    title: "Monitor Settings",
    ariaLabel: "Monitor Settings",
  });
  panel.appendChild(createSettingsPanelTitle("Option Flow Settings"));
  const settingsContentHost = ui_createElement("div", {
    styleString: "display:flex; flex-direction:column; gap:10px;",
  });
  panel.appendChild(settingsContentHost);

  let monitorPanelInstance: (HTMLElement & { cleanup?: () => void }) | null =
    null;
  const popover = createSettingsPopoverController({
    button,
    panel,
    onOpen: () => {
      if (monitorPanelInstance) return;
      monitorPanelInstance = optionFlowSettings_renderPage(ctx);
      settingsContentHost.appendChild(monitorPanelInstance);
    },
  });

  return {
    root: wrap,
    cleanup: () => {
      popover.cleanup();
      try {
        monitorPanelInstance?.cleanup?.();
      } catch {}
      monitorPanelInstance = null;
    },
  };
}
