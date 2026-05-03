/**
 * Modal — blocking dialog rendered at the body-portal tier.
 *
 * Backdrop click, Esc key, and explicit close button all route to close().
 * ConfirmModal is a thin wrapper for the common confirm/cancel pattern.
 *
 * Inline-styled port of AlexQuant's `composite/Modal/Modal.ts`. Where
 * AlexQuant uses LiquidGlass + .az-modal CSS classes, this version uses
 * straight inline styles wired to existing Schwaber CSS variables.
 */

import { ui_createElement } from "../core/builders/createElement";
import { cx } from "./cx";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalOptions {
  title?: string;
  body: HTMLElement | string;
  headerRight?: HTMLElement;
  footer?: HTMLElement;
  /** Default `"md"`. */
  size?: ModalSize;
  /** Default `true`. */
  closeOnBackdrop?: boolean;
  /** Default `true`. */
  closeOnEsc?: boolean;
  /** Default `true`. */
  showCloseButton?: boolean;
  className?: string;
  onClose?: () => void;
}

export interface ModalHandle {
  root: HTMLElement;
  body: HTMLElement;
  close: () => void;
}

const SIZE_MAX_WIDTH: Record<ModalSize, string> = {
  sm: "360px",
  md: "560px",
  lg: "880px",
};

export function Modal(opts: ModalOptions): ModalHandle {
  const size = opts.size ?? "md";
  const closeOnBackdrop = opts.closeOnBackdrop ?? true;
  const closeOnEsc = opts.closeOnEsc ?? true;
  const showCloseButton = opts.showCloseButton ?? true;

  const backdrop = ui_createElement("div", {
    className: "ax-modal-backdrop",
    styleString:
      "position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9000;",
  });

  const center = ui_createElement("div", {
    className: "ax-modal-center",
    styleString:
      "position: fixed; inset: 0; z-index: 9001; display: flex; align-items: center; justify-content: center; padding: 24px; pointer-events: none;",
  });

  const shell = ui_createElement("div", {
    className: cx("ax-modal", `ax-modal--${size}`, opts.className),
    styleString:
      `position: relative; width: 100%; max-width: ${SIZE_MAX_WIDTH[size]}; max-height: calc(100vh - 48px); overflow: hidden;` +
      " display: flex; flex-direction: column; pointer-events: auto;" +
      " background: var(--ax-bg-1, var(--ios-bg-secondary, #1c1c1e)); color: var(--ax-fg, var(--ios-text-primary, #fff));" +
      " border: 1px solid var(--ax-border, rgba(255,255,255,0.08)); border-radius: var(--ax-radius-2xl, 16px);" +
      " box-shadow: 0 20px 60px rgba(0,0,0,0.45);",
  });
  center.appendChild(shell);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onEsc);
    backdrop.remove();
    center.remove();
    opts.onClose?.();
  };

  const onEsc = (e: KeyboardEvent): void => {
    if (closeOnEsc && e.key === "Escape") close();
  };

  if (opts.title || showCloseButton || opts.headerRight) {
    const header = ui_createElement("div", {
      className: "ax-modal__header",
      styleString:
        "display: flex; align-items: center; justify-content: space-between; gap: 12px;" +
        " padding: 12px 16px; border-bottom: 1px solid var(--ax-border, rgba(255,255,255,0.08));",
    });
    const left = ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 8px; min-width: 0;",
    });
    if (opts.title) {
      left.appendChild(
        ui_createElement("h3", {
          text: opts.title,
          styleString:
            "margin: 0; font-size: 15px; font-weight: 600; color: var(--ax-fg, var(--ios-text-primary, #fff));",
        }),
      );
    }
    header.appendChild(left);

    const right = ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 8px;",
    });
    if (opts.headerRight) right.appendChild(opts.headerRight);
    if (showCloseButton) {
      const closeBtn = ui_createElement("button", {
        text: "✕",
        props: { type: "button", "aria-label": "Close" },
        styleString:
          "background: transparent; border: none; color: var(--ax-fg, var(--ios-text-secondary, #aaa));" +
          " cursor: pointer; font-size: 14px; line-height: 1; padding: 4px 8px; border-radius: 6px;",
        events: {
          click: close,
        },
      }) as HTMLButtonElement;
      right.appendChild(closeBtn);
    }
    header.appendChild(right);
    shell.appendChild(header);
  }

  const bodyEl = ui_createElement("div", {
    className: "ax-modal__body",
    styleString:
      "padding: 16px; overflow: auto; flex: 1 1 auto; min-height: 0;",
  });
  if (typeof opts.body === "string") bodyEl.textContent = opts.body;
  else bodyEl.appendChild(opts.body);
  shell.appendChild(bodyEl);

  if (opts.footer) {
    const footer = ui_createElement("div", {
      className: "ax-modal__footer",
      styleString:
        "padding: 12px 16px; border-top: 1px solid var(--ax-border, rgba(255,255,255,0.08));" +
        " display: flex; justify-content: flex-end; gap: 8px;",
    });
    footer.appendChild(opts.footer);
    shell.appendChild(footer);
  }

  if (closeOnBackdrop) backdrop.addEventListener("click", close);
  if (closeOnEsc) document.addEventListener("keydown", onEsc);

  document.body.appendChild(backdrop);
  document.body.appendChild(center);

  return { root: shell, body: bodyEl, close };
}

export interface ConfirmModalOptions {
  title: string;
  body: HTMLElement | string;
  /** Default `"Confirm"`. */
  confirmText?: string;
  /** Default `"Cancel"`. */
  cancelText?: string;
  /** Default `"sm"`. */
  size?: ModalSize;
  onConfirm: () => void;
  onCancel?: () => void;
}

function confirmFooterButton(
  text: string,
  isPrimary: boolean,
  onClick: () => void,
): HTMLButtonElement {
  return ui_createElement("button", {
    text,
    props: { type: "button" },
    styleString:
      "padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer;" +
      (isPrimary
        ? " background: var(--ios-blue, #0a84ff); border: 1px solid var(--ios-blue, #0a84ff); color: #fff;"
        : " background: transparent; border: 1px solid var(--ax-border, rgba(255,255,255,0.18)); color: var(--ax-fg, var(--ios-text-primary, #fff));"),
    events: { click: onClick },
  }) as HTMLButtonElement;
}

export function ConfirmModal(opts: ConfirmModalOptions): ModalHandle {
  const footer = ui_createElement("div", {
    styleString: "display: flex; gap: 8px;",
  });
  let handle!: ModalHandle;

  footer.appendChild(
    confirmFooterButton(opts.cancelText ?? "Cancel", false, () => {
      handle.close();
      opts.onCancel?.();
    }),
  );
  footer.appendChild(
    confirmFooterButton(opts.confirmText ?? "Confirm", true, () => {
      handle.close();
      opts.onConfirm();
    }),
  );

  handle = Modal({
    title: opts.title,
    body: opts.body,
    size: opts.size ?? "sm",
    footer,
  });
  return handle;
}
