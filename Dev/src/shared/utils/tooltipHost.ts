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
    "position: fixed; z-index: var(--z-tooltip, 100700); pointer-events: none;";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });
  const tooltip = document.createElement("div");
  tooltip.style.cssText =
    "position: fixed; background: rgba(255,255,255,0.97); border: 1px solid rgba(0,0,0,0.15);" +
    " border-radius: 8px; padding: 8px 12px; font-size: 12px; pointer-events: none;" +
    " display: none; box-shadow: 0 2px 12px rgba(0,0,0,0.18);" +
    ' font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;' +
    " max-width: 320px; color: #333; line-height: 1.4;";
  shadow.appendChild(tooltip);
  return { host, tooltip };
}
