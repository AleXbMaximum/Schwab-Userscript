import { ui_createElement } from "../../components/core/builders/createElement";

export function toolbarBtn(label: string, icon: string): HTMLButtonElement {
  const btn = ui_createElement("button", {
    styleString:
      "background: var(--ax-glass-2-bg); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md);" +
      " padding: 4px 10px; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold); cursor: pointer;" +
      " color: var(--ax-fg-2); display: flex; align-items: center; gap: 4px;" +
      " transition: all 0.15s; white-space: nowrap;",
  }) as HTMLButtonElement;
  btn.innerHTML = `<span style="font-size:13px">${icon}</span><span>${label}</span>`;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "var(--ax-bg-card)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "var(--ax-glass-2-bg)";
  });
  return btn;
}
