import { ui_createElement } from "frontend/components/core/createElement";
import { DS_BUTTONS } from "frontend/components/core/theme";
import { renderDatabaseInfoPanel } from "./monitoredTickers_infoPanel";

export function showDatabaseInfoPopup(_anchor: HTMLElement): void {
  document.body
    .querySelectorAll("[data-dbinfo-modal]")
    .forEach((el) => el.remove());

  const overlay = ui_createElement("div", {
    styleString:
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: var(--z-modal-backdrop, 100500);" +
      " background: rgba(0,0,0,0.45);",
    props: { "data-dbinfo-modal": "true" },
  });

  const modal = ui_createElement("div", {
    styleString:
      "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: var(--z-modal-content, 100600);" +
      " background: rgba(255,255,255,0.97); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);" +
      " border-radius: 16px; padding: 24px 28px; max-width: 720px; width: 90%; max-height: 80vh; overflow-y: auto;" +
      " box-shadow: var(--ios-shadow); font-family: var(--ios-font, inherit);",
    props: { "data-dbinfo-modal": "true" },
  });

  const closeAll = (): void => {
    overlay.remove();
    modal.remove();
    dbInfoPanel.cleanup?.();
  };

  const closeBtn = ui_createElement("button", {
    text: "\u2715",
    styleString:
      "position: absolute; top: 12px; right: 12px; width: 30px; height: 30px; border-radius: 8px;" +
      " border: 1px solid var(--ios-border); background: rgba(120,120,128,0.12);" +
      " color: var(--ios-text-secondary); cursor: pointer; font-size: 15px; line-height: 1;" +
      " display: inline-flex; align-items: center; justify-content: center;",
    events: { click: closeAll },
  });
  modal.style.position = "fixed";
  modal.appendChild(closeBtn);

  const dbInfoPanel = renderDatabaseInfoPanel();
  modal.appendChild(dbInfoPanel);

  overlay.addEventListener("click", closeAll);

  const onEsc = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      closeAll();
      document.removeEventListener("keydown", onEsc);
    }
  };
  document.addEventListener("keydown", onEsc);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // Auto-load the database info
  void dbInfoPanel.refresh?.();
}

export function showPurgeWarning(
  _anchor: HTMLElement,
  onConfirm: () => void,
): void {
  document.body
    .querySelectorAll("[data-purge-modal]")
    .forEach((el) => el.remove());

  const overlay = ui_createElement("div", {
    styleString:
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: var(--z-modal-backdrop, 100500);" +
      " background: rgba(0,0,0,0.45);",
    props: { "data-purge-modal": "true" },
  });

  const modal = ui_createElement("div", {
    styleString:
      "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: var(--z-modal-content, 100600);" +
      " background: rgba(255,255,255,0.97); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);" +
      " border-radius: 16px; padding: 24px 28px; max-width: 360px; width: 90%;" +
      " box-shadow: var(--ios-shadow); font-family: var(--ios-font, inherit);",
    props: { "data-purge-modal": "true" },
  });

  const title = ui_createElement("div", {
    text: "Purge All Monitor Data",
    styleString:
      "font-size: 15px; font-weight: 700; color: var(--ios-red); margin-bottom: 12px;",
  });

  const body = ui_createElement("div", {
    text:
      "This will permanently delete all snapshot history and opening records for every monitored symbol." +
      " This action cannot be undone.",
    styleString:
      "font-size: 13px; color: var(--ios-text-secondary); line-height: 1.5; margin-bottom: 20px;",
  });

  const btnRow = ui_createElement("div", {
    styleString: "display: flex; gap: 10px; justify-content: flex-end;",
  });

  const closeAll = (): void => {
    overlay.remove();
    modal.remove();
  };

  const cancelBtn = ui_createElement("button", {
    text: "Cancel",
    styleString:
      "padding: 8px 20px; font-size: 13px; font-weight: 600; border-radius: 10px; cursor: pointer;" +
      " border: 1px solid var(--ios-border, rgba(200,200,200,0.8)); background: rgba(255,255,255,0.7);" +
      " color: var(--ios-text-primary); font-family: inherit;",
    events: { click: closeAll },
  });

  const confirmBtn = ui_createElement("button", {
    text: "Purge All",
    styleString: DS_BUTTONS.dangerSolid,
    events: {
      click: () => {
        closeAll();
        onConfirm();
      },
    },
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(btnRow);

  overlay.addEventListener("click", closeAll);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}
