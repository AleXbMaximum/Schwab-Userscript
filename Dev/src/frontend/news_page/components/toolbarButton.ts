import { ui_createElement } from "../../components/core/createElement";

export function toolbarBtn(label: string, icon: string): HTMLButtonElement {
  const btn = ui_createElement("button", {
    styleString:
      "background: rgba(255,255,255,0.6); border: 1px solid var(--ios-border); border-radius: 8px;" +
      " padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer;" +
      " color: var(--ios-text-secondary); display: flex; align-items: center; gap: 4px;" +
      " transition: all 0.15s; white-space: nowrap;",
  }) as HTMLButtonElement;
  btn.innerHTML = `<span style="font-size:13px">${icon}</span><span>${label}</span>`;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "rgba(255,255,255,0.9)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "rgba(255,255,255,0.6)";
  });
  return btn;
}
