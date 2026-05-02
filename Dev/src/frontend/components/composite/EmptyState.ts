/**
 * EmptyState — placeholder for "no data" / "error" / "loading" scenarios.
 * Optional icon, description, and primary action button.
 *
 * Inline-styled port of AlexQuant's `composite/EmptyState/EmptyState.ts`.
 */

import { ui_createElement } from "../core/createElement";
import { cx } from "./cx";

export type EmptyStateVariant = "empty" | "error" | "loading";

export interface EmptyStateOptions {
  title: string;
  description?: string;
  icon?: string;
  /** Default `"empty"`. */
  variant?: EmptyStateVariant;
  compact?: boolean;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

const VARIANT_TINT: Record<EmptyStateVariant, string> = {
  empty: "var(--ios-text-secondary, #aaa)",
  error: "var(--ios-red, #d73126)",
  loading: "var(--ios-blue, #0a84ff)",
};

export function EmptyState(opts: EmptyStateOptions): HTMLElement {
  const variant = opts.variant ?? "empty";
  const root = ui_createElement("div", {
    className: cx(
      "ax-empty",
      variant !== "empty" && `ax-empty--${variant}`,
      opts.compact && "ax-empty--compact",
      opts.className,
    ),
    styleString:
      "display: flex; flex-direction: column; align-items: center; justify-content: center;" +
      ` text-align: center; gap: 8px; padding: ${opts.compact ? "12px 16px" : "32px 24px"};` +
      " color: var(--ios-text-secondary, #aaa);",
  });

  if (opts.icon) {
    root.appendChild(
      ui_createElement("div", {
        text: opts.icon,
        styleString: `font-size: ${opts.compact ? "20px" : "32px"}; color: ${VARIANT_TINT[variant]};`,
      }),
    );
  }
  root.appendChild(
    ui_createElement("div", {
      text: opts.title,
      styleString:
        "font-size: 14px; font-weight: 600; color: var(--ax-fg, var(--ios-text-primary, #fff));",
    }),
  );
  if (opts.description) {
    root.appendChild(
      ui_createElement("div", {
        text: opts.description,
        styleString:
          "font-size: 12px; color: var(--ios-text-secondary, #aaa); max-width: 360px;",
      }),
    );
  }
  if (opts.actionText && opts.onAction) {
    const btn = ui_createElement("button", {
      text: opts.actionText,
      props: { type: "button" },
      styleString:
        "margin-top: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600;" +
        " border-radius: 8px; cursor: pointer; background: transparent;" +
        " border: 1px solid var(--ax-border, rgba(255,255,255,0.18));" +
        " color: var(--ax-fg, var(--ios-text-primary, #fff));",
      events: { click: opts.onAction },
    });
    root.appendChild(btn);
  }
  return root;
}
