/**
 * Toast — transient notification rendered into a singleton body-portal host.
 * `showToast()` returns a handle with `dismiss()` for imperative control.
 *
 * Inline-styled port of AlexQuant's `composite/Toast/Toast.ts`.
 */

import { ui_createElement } from "../core/builders/createElement";

export type ToastSeverity = "info" | "ok" | "warn" | "error";

export interface ToastOptions {
  message: string;
  /** Default `"info"`. */
  severity?: ToastSeverity;
  /** Duration in ms. Default `3200`. Pass `0` for sticky. */
  duration?: number;
  icon?: string;
  onClick?: () => void;
}

export interface ToastHandle {
  element: HTMLElement;
  dismiss: () => void;
}

const SEVERITY_ICON: Record<ToastSeverity, string> = {
  info: "ℹ",
  ok: "✓",
  warn: "◆",
  error: "⚠",
};

const SEVERITY_BG: Record<ToastSeverity, string> = {
  info: "rgba(10,132,255,0.18)",
  ok: "rgba(48,209,88,0.18)",
  warn: "rgba(215,129,0,0.20)",
  error: "rgba(215,49,38,0.22)",
};
const SEVERITY_FG: Record<ToastSeverity, string> = {
  info: "#0a84ff",
  ok: "#30d158",
  warn: "#d78100",
  error: "#d73126",
};

let host: HTMLElement | null = null;

function getHost(): HTMLElement {
  if (host?.isConnected) return host;
  host = ui_createElement("div", {
    className: "ax-toast-host",
    styleString:
      "position: fixed; top: 24px; right: 24px; z-index: 9100;" +
      " display: flex; flex-direction: column; gap: 8px; pointer-events: none;",
  });
  document.body.appendChild(host);
  return host;
}

export function showToast(opts: ToastOptions): ToastHandle {
  const severity = opts.severity ?? "info";
  const duration = opts.duration ?? 3200;
  const icon = opts.icon ?? SEVERITY_ICON[severity];
  const root = getHost();

  const row = ui_createElement("div", {
    className: `ax-toast ax-toast--${severity}`,
    styleString:
      "display: flex; align-items: flex-start; gap: 8px; max-width: 360px; min-width: 220px;" +
      " padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);" +
      " font-size: 13px; line-height: 1.35; pointer-events: auto; cursor: pointer;" +
      ` background: ${SEVERITY_BG[severity]}; color: var(--ax-fg, var(--ios-text-primary, #fff));` +
      ` border: 1px solid ${SEVERITY_FG[severity]};` +
      " opacity: 0; transform: translateX(8px); transition: opacity 220ms ease, transform 220ms ease;",
  });

  row.appendChild(
    ui_createElement("span", {
      text: icon,
      styleString: `flex-shrink: 0; color: ${SEVERITY_FG[severity]};`,
    }),
  );
  row.appendChild(
    ui_createElement("span", {
      text: opts.message,
      styleString: "flex: 1; min-width: 0; overflow-wrap: anywhere;",
    }),
  );

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    row.style.opacity = "0";
    row.style.transform = "translateX(8px)";
    setTimeout(() => {
      row.remove();
      if (root.childElementCount === 0 && root.parentNode) {
        root.remove();
        host = null;
      }
    }, 280);
  };

  row.addEventListener("click", () => {
    opts.onClick?.();
    dismiss();
  });

  root.appendChild(row);
  requestAnimationFrame(() => {
    row.style.opacity = "1";
    row.style.transform = "translateX(0)";
  });
  if (duration > 0) dismissTimer = setTimeout(dismiss, duration);

  return { element: row, dismiss };
}
