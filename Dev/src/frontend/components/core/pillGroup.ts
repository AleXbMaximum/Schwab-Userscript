import { ui_createElement } from "./createElement";
import { DS_COLORS } from "./theme";

export interface PillOption<T> {
  label: string;
  value: T;
}

export interface PillGroupResult<T> {
  element: HTMLElement;
  getValue: () => T;
  setValue: (value: T) => void;
}

const PILL_STYLE =
  "padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 8px;" +
  " cursor: pointer; border: 1px solid var(--ios-border, rgba(230,230,230,0.7));" +
  " font-family: var(--ios-font, inherit); transition: all 0.15s; white-space: nowrap;";

function setActive(btn: HTMLElement): void {
  btn.style.background = DS_COLORS.info;
  btn.style.color = "#fff";
  btn.style.borderColor = DS_COLORS.info;
}

function setInactive(btn: HTMLElement): void {
  btn.style.background = "rgba(255,255,255,0.6)";
  btn.style.color = "var(--ios-text-primary)";
  btn.style.borderColor = "var(--ios-border, rgba(230,230,230,0.7))";
}

export function createPillGroup<T>(
  options: PillOption<T>[],
  defaultValue: T,
  onChange: (value: T) => void,
  groupLabel?: string,
): PillGroupResult<T> {
  let currentValue = defaultValue;

  const container = ui_createElement("div", {
    styleString: "display: flex; gap: 4px; align-items: center;",
  });

  if (groupLabel) {
    container.appendChild(
      ui_createElement("span", {
        text: groupLabel,
        styleString:
          "font-size: 10px; color: var(--ios-text-secondary); font-weight: 500;",
      }),
    );
  }

  const buttons: HTMLElement[] = [];

  for (const opt of options) {
    const btn = ui_createElement("button", {
      text: opt.label,
      styleString: PILL_STYLE,
      events: {
        click: () => {
          currentValue = opt.value;
          for (const b of buttons) setInactive(b);
          setActive(btn);
          onChange(opt.value);
        },
      },
    });
    if (opt.value === currentValue) setActive(btn);
    else setInactive(btn);
    buttons.push(btn);
    container.appendChild(btn);
  }

  return {
    element: container,
    getValue: () => currentValue,
    setValue: (value: T) => {
      currentValue = value;
      for (let i = 0; i < options.length; i++) {
        if (options[i].value === value) setActive(buttons[i]);
        else setInactive(buttons[i]);
      }
    },
  };
}
