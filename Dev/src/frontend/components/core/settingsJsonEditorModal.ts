import { ui_createElement } from "./builders/createElement";
import { DS_COMPONENTS } from "./styles/theme";
import { createSettingsActionButton } from "./settingsFramework";

export interface SettingsJsonEditorModal {
  backdrop: HTMLDivElement;
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  refreshValue: () => void;
  onEscapeHandler: (e: KeyboardEvent) => void;
}

/**
 * Build a modal JSON editor with Format / Apply buttons. The modal is
 * detached until `setOpen(true)` is called; the caller mounts the returned
 * `backdrop` into the DOM (typically the page root).
 */
export function createSettingsJsonEditorModal(opts: {
  title: string;
  description?: string;
  getValue: () => string;
  onApply: (raw: string) => void;
  validate?: (raw: string) => string | null;
}): SettingsJsonEditorModal {
  const backdrop = ui_createElement("div", {
    styleString:
      "position: fixed; inset: 0; z-index: var(--ax-z-page-popover);" +
      " background: var(--ax-modal-backdrop-light); display: none; align-items: center; justify-content: center;" +
      " padding: 24px;",
  }) as HTMLDivElement;

  const modal = ui_createElement("div", {
    styleString:
      "width: min(900px, calc(100vw - 48px)); height: min(70vh, 720px); min-height: 420px;" +
      " border: 1px solid var(--ax-border); border-radius: 14px; overflow: hidden;" +
      " background: var(--ax-bg-card); box-shadow: var(--ax-shadow-lg);" +
      " display: flex; flex-direction: column;",
  }) as HTMLDivElement;
  backdrop.appendChild(modal);

  const textarea = ui_createElement("textarea", {
    props: { rows: 14 },
    styleString:
      DS_COMPONENTS.settingTextarea +
      " height: 100%; min-height: 0; resize: none; background: var(--ax-bg-card);",
  }) as HTMLTextAreaElement;

  const refreshValue = (): void => {
    textarea.value = opts.getValue();
  };
  refreshValue();

  const closeBtn = ui_createElement("button", {
    text: "✕",
    props: { type: "button", "aria-label": `Close ${opts.title}` },
    styleString:
      "width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--ax-border);" +
      " background: var(--ax-bg-chip); color: var(--ax-fg-2); cursor: pointer;" +
      " font-size: 15px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;",
  }) as HTMLButtonElement;

  const formatBtn = createSettingsActionButton("Format");
  formatBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(textarea.value || "{}");
      textarea.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      window.alert(`Invalid JSON: ${(e as any)?.message ?? String(e)}`);
    }
  });

  const applyBtn = createSettingsActionButton("Apply", { variant: "primary" });
  applyBtn.addEventListener("click", () => {
    const raw = textarea.value;
    if (opts.validate) {
      const err = opts.validate(raw);
      if (err) {
        window.alert(err);
        return;
      }
    }
    opts.onApply(raw);
  });

  modal.appendChild(
    ui_createElement("div", {
      styleString:
        "display:flex; align-items:center; justify-content:space-between; gap:8px;" +
        " padding: 12px 14px; border-bottom: 1px solid var(--ax-border-subtle); background: var(--ax-bg-toolbar);",
      children: [
        ui_createElement("span", {
          text: opts.title,
          styleString:
            "font-size: 15px; font-weight: 600; color: var(--ios-text-primary);",
        }),
        closeBtn,
      ],
    }),
  );

  const bodyChildren: HTMLElement[] = [];
  if (opts.description) {
    bodyChildren.push(
      ui_createElement("div", {
        text: opts.description,
        styleString:
          "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.4; margin-bottom: 8px;",
      }),
    );
  }
  bodyChildren.push(textarea);
  modal.appendChild(
    ui_createElement("div", {
      styleString:
        "flex: 1 1 auto; min-height: 0; padding: 12px 14px; display: flex; flex-direction: column;",
      children: bodyChildren,
    }),
  );

  modal.appendChild(
    ui_createElement("div", {
      styleString:
        "display:flex; align-items:center; justify-content:space-between; gap:8px;" +
        " padding: 10px 14px; border-top: 1px solid var(--ax-border-subtle); background: var(--ax-bg-toolbar);",
      children: [
        formatBtn,
        ui_createElement("div", {
          styleString: "display:flex; justify-content:flex-end; gap:8px;",
          children: [applyBtn],
        }),
      ],
    }),
  );

  let isModalOpen = false;
  let previousBodyOverflow = "";
  const setOpen = (open: boolean): void => {
    if (isModalOpen === open) return;
    isModalOpen = open;
    backdrop.style.display = open ? "flex" : "none";
    if (open) {
      refreshValue();
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return;
    }
    document.body.style.overflow = previousBodyOverflow;
  };

  closeBtn.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) setOpen(false);
  });

  const onEscapeHandler = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || !isModalOpen) return;
    e.stopImmediatePropagation();
    setOpen(false);
  };

  return {
    backdrop,
    setOpen,
    isOpen: () => isModalOpen,
    refreshValue,
    onEscapeHandler,
  };
}
