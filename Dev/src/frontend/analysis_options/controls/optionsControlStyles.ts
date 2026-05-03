export const barStyle =
  "display: flex; flex-direction: column; gap: 4px; padding: 4px 8px;" +
  " border-bottom: 1px solid var(--ax-border-subtle);" +
  " background: var(--ax-glass-2-bg);" +
  " font-family: var(--ax-font-body);";

export const controlsRowStyle =
  "display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;" +
  " overflow-x: auto; overflow-y: hidden;";

export const groupStyle =
  "display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; white-space: nowrap;";

export const groupLabelStyle =
  "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary);" +
  " letter-spacing: 0.2px; white-space: nowrap;";

export const selectBaseStyle =
  "padding: 3px 6px; border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md);" +
  " font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold); color: var(--ax-fg);" +
  " background: var(--ax-bg-input); font-family: var(--ax-font-body);" +
  " min-height: 24px; outline: none;";

export const selectSmallStyle = selectBaseStyle + " min-width: 94px;";
export const selectWideStyle = selectBaseStyle + " min-width: 228px;";
export const selectMultiStyle =
  selectBaseStyle + " min-width: 228px; min-height: 82px; font-weight: 500;";

export const subRowStyle =
  "display: flex; align-items: center; gap: 6px; margin-left: 4px; flex-wrap: wrap;";

export const subLabelStyle =
  "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary);";

export const infoTagStyle =
  "font-size: 9px; font-weight: 600; color: #D78100; background: rgba(215, 129, 0, 0.1);" +
  " padding: 1px 5px; border-radius: 4px; white-space: nowrap;";
