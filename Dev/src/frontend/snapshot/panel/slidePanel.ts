import { ui_createElement } from "../../components/core/builders/createElement";
import { attachLiquidGlassRim } from "../../components/core/axTheme/liquidGlass";

const FONT_FAMILY = "var(--ax-font-body)";

export const PANEL_WIDTH_VW = "17.5vw";
export const PANEL_MIN_WIDTH_PX = 300;
export const PANEL_MAX_WIDTH_PX = 500;
const PANEL_HIDE_RIGHT = "-520px";
const TAB_WIDTH = 22;
const TAB_HEIGHT = 80;
export const TAB_TOP = 120;
export const SLIDE_MS = 280;

export { PANEL_HIDE_RIGHT };

export function buildSideTab(
  label: string,
  activeColor: string,
  topOffset: number,
): { tab: HTMLElement } {
  const tab = ui_createElement("div", {
    // Glass + rim are class-driven so any future shell-tone changes
    // propagate through the token system rather than this file.
    className: "ax-shell-element ax-glass-3 ax-glass-rim",
    styleString:
      `position:fixed; right:0; top:${topOffset}px; z-index:var(--ax-z-floating-toggle);` +
      ` width:${TAB_WIDTH}px; height:${TAB_HEIGHT}px;` +
      ` color:${activeColor}; cursor:pointer; user-select:none;` +
      " display:flex; align-items:center; justify-content:center;" +
      " border-radius: var(--ax-radius-lg) 0 0 var(--ax-radius-lg);" +
      " border-right:none;" +
      ` font-family:${FONT_FAMILY}; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-bold);` +
      " letter-spacing:0.5px; writing-mode:vertical-rl; text-orientation:mixed;" +
      ` transition:right ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1),` +
      ` box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1), background 220ms;`,
  });
  attachLiquidGlassRim(tab);

  const span = ui_createElement("span", {
    text: label,
    styleString: "transform:rotate(180deg); pointer-events:none;",
  });
  tab.appendChild(span);

  tab.addEventListener("mouseenter", () => {
    tab.style.background = "var(--ax-glass-3-hover)";
  });
  tab.addEventListener("mouseleave", () => {
    tab.style.background = "";
  });

  return { tab };
}

export function buildSlidePanel(title: string): {
  panel: HTMLElement;
  body: HTMLElement;
  closeBtn: HTMLButtonElement;
} {
  const panel = ui_createElement("div", {
    className: "ax-shell-element ax-glass-3 ax-glass-rim",
    styleString:
      `position:fixed; top:0; right:${PANEL_HIDE_RIGHT}; z-index:var(--ax-z-floating-panel);` +
      ` width:${PANEL_WIDTH_VW}; min-width:${PANEL_MIN_WIDTH_PX}px; max-width:${PANEL_MAX_WIDTH_PX}px;` +
      " border-left-width: 1px;" +
      " border-right: none; border-top: none; border-bottom: none;" +
      " border-top-left-radius: var(--ax-radius-2xl);" +
      " border-bottom-left-radius: var(--ax-radius-2xl);" +
      " color: var(--ax-fg);" +
      ` font-family:${FONT_FAMILY};` +
      " display:flex; flex-direction:column; overflow:hidden;" +
      ` transition:right ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1);`,
  });
  attachLiquidGlassRim(panel);

  const titleBar = ui_createElement("div", {
    styleString:
      "display:flex; align-items:center; justify-content:space-between; padding:10px 14px;" +
      " background:transparent; border-bottom:1px solid var(--ax-border-subtle);" +
      " flex-shrink:0; user-select:none;",
  });
  titleBar.appendChild(
    ui_createElement("span", {
      text: title,
      styleString:
        "font-size: var(--ax-fs-lg); font-weight: var(--ax-fw-bold); color: var(--ax-fg); letter-spacing: 0.3px;",
    }),
  );

  const closeBtn = ui_createElement("button", {
    props: { type: "button", title: "Close" },
    styleString:
      "background:none; border:none; cursor:pointer; padding:2px 6px; border-radius: var(--ax-radius-xs);" +
      " color: var(--ax-fg-2); line-height:1; transition:background .15s;",
  }) as HTMLButtonElement;
  closeBtn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
    '<path d="M18 6L6 18M6 6l12 12"/></svg>';
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "var(--ax-bg-row-hover)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "none";
  });
  titleBar.appendChild(closeBtn);

  const body = ui_createElement("div", {
    styleString:
      "display:flex; flex-direction:column; flex:1 1 auto; min-height:0;" +
      " overflow-y:auto; padding:12px 14px;",
  });

  panel.appendChild(titleBar);
  panel.appendChild(body);
  return { panel, body, closeBtn };
}

export function showPanel(
  panel: HTMLElement,
  timer: { ref: ReturnType<typeof setTimeout> | null },
): void {
  if (timer.ref) {
    clearTimeout(timer.ref);
    timer.ref = null;
  }
  panel.style.display = "flex";
  panel.getBoundingClientRect();
  panel.style.right = "0px";
}

export function hidePanel(
  panel: HTMLElement,
  timer: { ref: ReturnType<typeof setTimeout> | null },
  isOpenFn: () => boolean,
): void {
  if (timer.ref) {
    clearTimeout(timer.ref);
    timer.ref = null;
  }
  panel.style.right = PANEL_HIDE_RIGHT;
  timer.ref = setTimeout(() => {
    timer.ref = null;
    if (!isOpenFn()) panel.style.display = "none";
  }, SLIDE_MS);
}
