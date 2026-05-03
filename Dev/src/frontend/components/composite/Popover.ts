/**
 * Popover — anchored floating surface for arbitrary content.
 *
 * Use for autocomplete result panels, hover cards, or any anchored floating
 * content that isn't a plain menu-list. Body-portaled. Inline-styled port
 * of AlexQuant's `composite/Popover/Popover.ts`.
 *
 *   anchor element ──► popover below / above / side
 *   Esc / outside-click / blur close by default; scroll repositions.
 */

import { ui_createElement } from "../core/builders/createElement";
import { cx } from "./cx";

export type PopoverPlacement = "bottom" | "top" | "left" | "right";

export interface PopoverOptions {
  anchor: HTMLElement;
  body: HTMLElement;
  /** Default `"bottom"`. */
  placement?: PopoverPlacement;
  /** Gap from anchor in px. Default `4`. */
  offset?: number;
  /** Default: match anchor width. */
  minWidth?: number;
  maxWidth?: number;
  /** Default `400`. */
  maxHeight?: number;
  /** Default `true`. */
  closeOnOutside?: boolean;
  /** Default `true`. */
  closeOnEsc?: boolean;
  /** Default `false` — reposition on scroll instead. */
  closeOnScroll?: boolean;
  className?: string;
  onClose?: () => void;
}

export interface PopoverHandle {
  root: HTMLElement;
  body: HTMLElement;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  reposition: () => void;
  destroy: () => void;
}

export function Popover(opts: PopoverOptions): PopoverHandle {
  const placement = opts.placement ?? "bottom";
  const offset = opts.offset ?? 4;
  const closeOnOutside = opts.closeOnOutside ?? true;
  const closeOnEsc = opts.closeOnEsc ?? true;
  const closeOnScroll = opts.closeOnScroll ?? false;
  const maxHeight = opts.maxHeight ?? 400;

  const root = ui_createElement("div", {
    className: cx("ax-popover", opts.className),
    styleString:
      "position: fixed; z-index: 9050;" +
      " background: var(--ax-bg-1, var(--ios-bg-secondary, #1c1c1e)); color: var(--ax-fg, var(--ios-text-primary, #fff));" +
      " border: 1px solid var(--ax-border, rgba(255,255,255,0.10)); border-radius: var(--ax-radius-lg, 12px);" +
      " box-shadow: 0 14px 36px rgba(0,0,0,0.45);" +
      " opacity: 0; pointer-events: none; transition: opacity 140ms ease;",
  });

  const bodyWrap = ui_createElement("div", {
    className: "ax-popover__body",
    styleString: `overflow: auto; max-height: ${maxHeight}px;`,
  });
  bodyWrap.appendChild(opts.body);
  root.appendChild(bodyWrap);

  if (opts.maxWidth) root.style.maxWidth = `${opts.maxWidth}px`;
  document.body.appendChild(root);

  let open = false;

  const reposition = (): void => {
    const rect = opts.anchor.getBoundingClientRect();
    const width = opts.minWidth ?? rect.width;
    root.style.minWidth = `${width}px`;
    const size = root.getBoundingClientRect();
    let top = 0;
    let left = 0;
    switch (placement) {
      case "top":
        top = rect.top - size.height - offset;
        left = rect.left;
        break;
      case "bottom":
        top = rect.bottom + offset;
        left = rect.left;
        break;
      case "left":
        top = rect.top;
        left = rect.left - size.width - offset;
        break;
      case "right":
        top = rect.top;
        left = rect.right + offset;
        break;
    }
    const margin = 4;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - size.width - margin),
    );
    top = Math.max(
      margin,
      Math.min(top, window.innerHeight - size.height - margin),
    );
    root.style.top = `${top}px`;
    root.style.left = `${left}px`;
  };

  const openPop = (): void => {
    if (open) return;
    open = true;
    root.style.opacity = "1";
    root.style.pointerEvents = "auto";
    reposition();
  };
  const closePop = (): void => {
    if (!open) return;
    open = false;
    root.style.opacity = "0";
    root.style.pointerEvents = "none";
    opts.onClose?.();
  };

  const onDocMouseDown = (e: MouseEvent): void => {
    if (!open) return;
    const t = e.target as Node;
    if (root.contains(t) || opts.anchor.contains(t)) return;
    closePop();
  };
  const onEsc = (e: KeyboardEvent): void => {
    if (open && e.key === "Escape") closePop();
  };
  const onWinBlur = (): void => {
    if (open) closePop();
  };
  const onScroll = (): void => {
    if (!open) return;
    if (closeOnScroll) closePop();
    else reposition();
  };
  const onResize = (): void => {
    if (open) reposition();
  };

  if (closeOnOutside)
    document.addEventListener("mousedown", onDocMouseDown, true);
  if (closeOnEsc) document.addEventListener("keydown", onEsc);
  window.addEventListener("blur", onWinBlur);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);

  return {
    root,
    body: bodyWrap,
    open: openPop,
    close: closePop,
    toggle: () => (open ? closePop() : openPop()),
    isOpen: () => open,
    reposition,
    destroy: () => {
      closePop();
      if (closeOnOutside)
        document.removeEventListener("mousedown", onDocMouseDown, true);
      if (closeOnEsc) document.removeEventListener("keydown", onEsc);
      window.removeEventListener("blur", onWinBlur);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      root.remove();
    },
  };
}
