/**
 * Factory for shadow-isolated tooltip hosts (`<alexquant-tip>`).
 *
 * Every call creates an independent custom element attached to `document.body`
 * with a closed shadow root containing a styled tooltip `<div>`.
 *
 * @returns `{ host, tooltip }` — the outer element to remove on cleanup,
 *          and the inner `<div>` whose `display` / `innerHTML` you control.
 */
export function createTooltipHost(): {
  host: HTMLElement;
  tooltip: HTMLDivElement;
} {
  const host = document.createElement("alexquant-tip");
  host.style.cssText =
    "position: fixed; z-index: var(--ax-z-tooltip); pointer-events: none;";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });
  const tooltip = document.createElement("div");
  // CSS custom properties inherit into shadow DOM, so --ax-* tokens resolve
  // here against the document's current theme.
  tooltip.style.cssText =
    "position: fixed;" +
    " background: var(--ax-bg-tooltip);" +
    " border: 1px solid var(--ax-border-tooltip);" +
    " border-radius: var(--ax-radius-md);" +
    " padding: 8px 12px; font-size: var(--ax-fs-md);" +
    " pointer-events: none; display: none;" +
    " box-shadow: var(--ax-shadow-tooltip);" +
    " font-family: var(--ax-font-body);" +
    " color: var(--ax-fg);" +
    " max-width: 320px; line-height: 1.4;" +
    " backdrop-filter: blur(12px) saturate(160%);" +
    " -webkit-backdrop-filter: blur(12px) saturate(160%);";
  shadow.appendChild(tooltip);
  return { host, tooltip };
}
