import { ui_createElement } from "../../components/core/createElement";

const FONT_FAMILY =
  'var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';

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
    styleString:
      `position:fixed; right:0; top:${topOffset}px; z-index:var(--z-floating-toggle, 100400);` +
      ` width:${TAB_WIDTH}px; height:${TAB_HEIGHT}px;` +
      " background:var(--glass-3-bg, rgba(255,255,255,0.28));" +
      " -webkit-backdrop-filter:blur(var(--glass-3-blur, 20px)) saturate(var(--glass-3-saturate, 140%));" +
      " backdrop-filter:blur(var(--glass-3-blur, 20px)) saturate(var(--glass-3-saturate, 140%));" +
      ` color:${activeColor}; cursor:pointer; user-select:none;` +
      " display:flex; align-items:center; justify-content:center;" +
      " border-radius:10px 0 0 10px;" +
      " border:1px solid rgba(255,255,255,0.35); border-right:none;" +
      " box-shadow:-2px 0 10px rgba(0,0,0,0.08), var(--glass-3-inset-shadow, inset 0 1px 0 rgba(255,255,255,0.40));" +
      ` font-family:${FONT_FAMILY}; font-size:11px; font-weight:700;` +
      " letter-spacing:0.5px; writing-mode:vertical-rl; text-orientation:mixed;" +
      ` transition:right ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1),` +
      ` box-shadow ${SLIDE_MS}ms, background ${SLIDE_MS}ms;`,
  });

  const span = ui_createElement("span", {
    text: label,
    styleString: "transform:rotate(180deg); pointer-events:none;",
  });
  tab.appendChild(span);

  tab.addEventListener("mouseenter", () => {
    tab.style.background = "rgba(255,255,255,0.42)";
    tab.style.boxShadow =
      "-3px 0 16px rgba(0,0,0,0.12), var(--glass-3-inset-shadow, inset 0 1px 0 rgba(255,255,255,0.40))";
  });
  tab.addEventListener("mouseleave", () => {
    tab.style.background = "var(--glass-3-bg, rgba(255,255,255,0.28))";
    tab.style.boxShadow =
      "-2px 0 10px rgba(0,0,0,0.08), var(--glass-3-inset-shadow, inset 0 1px 0 rgba(255,255,255,0.40))";
  });

  return { tab };
}

export function buildSlidePanel(title: string): {
  panel: HTMLElement;
  body: HTMLElement;
  closeBtn: HTMLButtonElement;
} {
  const panel = ui_createElement("div", {
    styleString:
      `position:fixed; top:0; right:${PANEL_HIDE_RIGHT}; z-index:var(--z-floating-panel, 100200);` +
      ` width:${PANEL_WIDTH_VW}; min-width:${PANEL_MIN_WIDTH_PX}px; max-width:${PANEL_MAX_WIDTH_PX}px;` +
      " background:var(--glass-3-bg, rgba(255,255,255,0.28));" +
      " -webkit-backdrop-filter:blur(var(--glass-3-blur, 20px)) saturate(var(--glass-3-saturate, 140%));" +
      " backdrop-filter:blur(var(--glass-3-blur, 20px)) saturate(var(--glass-3-saturate, 140%));" +
      " border-left:1px solid rgba(255,255,255,0.35);" +
      " box-shadow:-4px 0 20px rgba(0,0,0,0.08), var(--glass-3-inset-shadow, inset 0 1px 0 rgba(255,255,255,0.40));" +
      ` font-family:${FONT_FAMILY};` +
      " display:flex; flex-direction:column; overflow:hidden;" +
      ` transition:right ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1);`,
  });

  const titleBar = ui_createElement("div", {
    styleString:
      "display:flex; align-items:center; justify-content:space-between; padding:10px 14px;" +
      " background:transparent; border-bottom:1px solid rgba(0,0,0,0.06);" +
      " flex-shrink:0; user-select:none;",
  });
  titleBar.appendChild(
    ui_createElement("span", {
      text: title,
      styleString:
        "font-size:13px; font-weight:700; color:var(--ios-text-primary); letter-spacing:0.3px;",
    }),
  );

  const closeBtn = ui_createElement("button", {
    props: { type: "button", title: "Close" },
    styleString:
      "background:none; border:none; cursor:pointer; padding:2px 6px; border-radius:4px;" +
      " color:var(--ios-text-secondary); line-height:1; transition:background .15s;",
  }) as HTMLButtonElement;
  closeBtn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
    '<path d="M18 6L6 18M6 6l12 12"/></svg>';
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "rgba(0,0,0,0.06)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "none";
  });
  titleBar.appendChild(closeBtn);

  const body = ui_createElement("div", {
    styleString: "overflow-y:auto; padding:12px 14px;",
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
