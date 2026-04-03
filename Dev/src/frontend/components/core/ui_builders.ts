/**
 * AlexQuant UI Builder Functions
 *
 * Keep this module focused on currently used, reusable element builders.
 */

import { ui_createElement } from "./createElement";
import { DS_COMPONENTS } from "./theme";

export interface CollapsibleOptions {
  headerChildren: (HTMLElement | null)[];
  body: HTMLElement;
  defaultExpanded?: boolean;
  bodyDisplay?: string;
}

export function ui_collapsible(opts: CollapsibleOptions): HTMLElement {
  const card = ui_createElement("div", {
    styleString: DS_COMPONENTS.collapsibleCard,
  });

  const header = ui_createElement("div", {
    styleString: DS_COMPONENTS.collapsibleHeader,
  });

  for (const child of opts.headerChildren) {
    if (child) header.appendChild(child);
  }

  const caret = ui_createElement("span", {
    text: "\u25B6",
    styleString: DS_COMPONENTS.caret,
  });
  header.appendChild(caret);

  const bodyDisplay = opts.bodyDisplay ?? "block";
  const expanded = opts.defaultExpanded ?? false;

  const body = opts.body;
  body.style.display = expanded ? bodyDisplay : "none";
  if (!body.style.borderTop) {
    body.style.cssText +=
      "; border-top: 1px solid var(--ios-border); padding: 10px 13px;";
  }

  caret.style.transform = expanded ? "rotate(90deg)" : "";

  let isExpanded = expanded;
  header.addEventListener("click", () => {
    isExpanded = !isExpanded;
    body.style.display = isExpanded ? bodyDisplay : "none";
    caret.style.transform = isExpanded ? "rotate(90deg)" : "";
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

export function ui_statusDot(color: string): HTMLElement {
  return ui_createElement("div", {
    styleString: DS_COMPONENTS.statusDot(color),
  });
}

/** Reusable form row: label on the left, control on the right, optional helper text below. */
export function ui_formRow(opts: {
  label: string;
  control: HTMLElement;
  helper?: string;
}): HTMLElement {
  const row = ui_createElement("div", {
    styleString: DS_COMPONENTS.settingFormRow,
  });

  const labelCol = ui_createElement("div", {});
  labelCol.appendChild(
    ui_createElement("div", {
      text: opts.label,
      styleString: DS_COMPONENTS.settingFormLabel,
    }),
  );
  if (opts.helper) {
    labelCol.appendChild(
      ui_createElement("div", {
        text: opts.helper,
        styleString: DS_COMPONENTS.settingFormHelper,
      }),
    );
  }

  const controlCol = ui_createElement("div", {
    styleString: DS_COMPONENTS.settingFormControl,
  });
  controlCol.appendChild(opts.control);

  row.appendChild(labelCol);
  row.appendChild(controlCol);
  return row;
}

/** Reusable badge/chip element with semantic color variant. */
export function ui_badge(
  text: string,
  variant: "positive" | "negative" | "neutral" | "info" | "muted" = "muted",
): HTMLElement {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    positive: {
      bg: "rgba(32,169,69,0.06)",
      text: "#20a945",
      border: "rgba(32,169,69,0.25)",
    },
    negative: {
      bg: "rgba(215,49,38,0.06)",
      text: "#d73126",
      border: "rgba(215,49,38,0.25)",
    },
    neutral: {
      bg: "rgba(215,129,0,0.06)",
      text: "#D78100",
      border: "rgba(215,129,0,0.25)",
    },
    info: {
      bg: "rgba(0,122,255,0.06)",
      text: "#007AFF",
      border: "rgba(0,122,255,0.25)",
    },
    muted: {
      bg: "rgba(142,142,147,0.06)",
      text: "#8E8E93",
      border: "rgba(142,142,147,0.25)",
    },
  };
  const c = colors[variant];
  return ui_createElement("span", {
    text,
    styleString:
      `display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px;` +
      ` font-size: 10px; font-weight: 600; line-height: 1.2;` +
      ` background: ${c.bg}; color: ${c.text}; border: 1px solid ${c.border};`,
  });
}

/**
 * Inject a <style> element into document.head, identified by `id`.
 * If a style with the same id already exists, the call is a no-op.
 */
export function injectStylesheet(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Auto-tracking event listener manager for cleanup-safe components.
 * Call cleanup() to remove all registered listeners at once.
 */
export function createEventManager() {
  const entries: { el: EventTarget; event: string; handler: EventListener }[] =
    [];
  return {
    on(el: EventTarget, event: string, handler: EventListener) {
      el.addEventListener(event, handler);
      entries.push({ el, event, handler });
    },
    cleanup() {
      for (const { el, event, handler } of entries) {
        el.removeEventListener(event, handler);
      }
      entries.length = 0;
    },
  };
}
