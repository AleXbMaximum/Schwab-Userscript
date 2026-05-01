import { ui_createElement } from "../../../components/core/createElement";
import { INDEX_OVERLAY_OPTIONS } from "../timelineConstants";
import { summarizeOverlaySelection } from "../data/overlayBuilder";
import {
  DS_COLORS,
  DS_SPACING,
  DS_RADIUS,
  DS_LINE_HEIGHT,
} from "../../../components/core/theme";

const PILL_STYLE =
  `padding: ${DS_SPACING.sm} ${DS_SPACING.md};` +
  ` border: 1px solid ${DS_COLORS.border};` +
  ` border-radius: ${DS_RADIUS.sm};` +
  ` font-size: 12px; line-height: ${DS_LINE_HEIGHT.snug};` +
  ' font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);' +
  ` background: ${DS_COLORS.bgPanel};` +
  ` color: ${DS_COLORS.textPrimary};` +
  " white-space: nowrap;";

export function createIndexOverlayDropdown(
  initial: string[],
  onChange: (selected: string[]) => void,
): { element: HTMLElement; getSelected: () => string[] } {
  const wrap = ui_createElement("div", {
    styleString: "position:relative; display:inline-block;",
  });

  const button = ui_createElement("button", {
    props: { type: "button" },
    styleString:
      PILL_STYLE +
      " cursor:pointer; display:flex; align-items:center; gap:3px;",
  }) as HTMLButtonElement;

  const updateButtonLabel = (selected: string[]) => {
    const summary = summarizeOverlaySelection(selected);
    button.textContent = summary.text;
    button.title = summary.title;
  };
  updateButtonLabel(initial);

  const dropdown = ui_createElement("div", {
    styleString:
      "position:absolute; top:100%; left:0; z-index:10; margin-top:2px;" +
      ` background: var(--ax-bg-card); color: var(--ax-fg); border:1px solid ${DS_COLORS.border};` +
      ` border-radius: ${DS_RADIUS.md}; box-shadow: var(--ax-shadow-sm);` +
      " padding:4px 0; min-width:130px; display:none;" +
      " font-family: var(--ax-font-body);",
  });

  const selectedSet = new Set(initial);

  for (const opt of INDEX_OVERLAY_OPTIONS) {
    const row = ui_createElement("label", {
      styleString:
        `display:flex; align-items:center; gap: ${DS_SPACING.sm}; padding: ${DS_SPACING.sm} 10px; cursor:pointer;` +
        " font-size:12px; white-space:nowrap;",
    });
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedSet.has(opt.symbol);
    cb.dataset.symbol = opt.symbol;
    cb.style.cssText = "margin:0; accent-color:var(--ios-blue);";

    const colorDot = ui_createElement("span", {
      styleString: `width:8px; height:8px; border-radius:50%; background:${opt.color}; flex-shrink:0;`,
    });
    const label = ui_createElement("span", { text: opt.label });

    row.appendChild(cb);
    row.appendChild(colorDot);
    row.appendChild(label);
    dropdown.appendChild(row);

    cb.addEventListener("change", () => {
      if (cb.checked) selectedSet.add(opt.symbol);
      else selectedSet.delete(opt.symbol);
      const arr = [...selectedSet];
      updateButtonLabel(arr);
      onChange(arr);
    });
  }

  wrap.appendChild(button);
  wrap.appendChild(dropdown);

  let open = false;
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    open = !open;
    dropdown.style.display = open ? "block" : "none";
  });

  const closeOnClickOutside = (e: MouseEvent) => {
    if (open && !wrap.contains(e.target as Node)) {
      open = false;
      dropdown.style.display = "none";
    }
  };
  document.addEventListener("click", closeOnClickOutside, true);

  return {
    element: wrap,
    getSelected: () => [...selectedSet],
  };
}
