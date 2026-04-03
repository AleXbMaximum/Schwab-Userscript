import { ui_copyTextToClipboard } from "../../components/core/clipboard";
import { injectStylesheet } from "../../components/core/ui_builders";

// ── Copy with flash feedback ───────────────────────────────────────────────
// Unified copy-to-clipboard with button flash, replacing 3 duplicate patterns.

export async function copyWithFlash(
  btn: HTMLButtonElement,
  getText: () => string,
): Promise<void> {
  const text = getText();
  if (!text) return;

  const ok = await ui_copyTextToClipboard(text);
  const origHTML = btn.innerHTML;
  btn.innerHTML = ok
    ? '<span style="font-size:13px">\u2705</span><span>Copied!</span>'
    : '<span style="font-size:13px">\u274C</span><span>Failed</span>';
  setTimeout(() => {
    btn.innerHTML = origHTML;
  }, 1500);
}

// ── CSS layout injection ───────────────────────────────────────────────────

export function ensureNewsLayoutStyles(): void {
  injectStylesheet(
    "alexquant-news-layout-style",
    ".alexquant-news-layout {" +
      " display: grid;" +
      " grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);" +
      " gap: 16px;" +
      " flex: 1;" +
      " min-height: 0;" +
      " width: 100%;" +
      " align-items: stretch;" +
      "}" +
      ".alexquant-news-col {" +
      " min-width: 0;" +
      " min-height: 0;" +
      "}" +
      ".alexquant-news-ai-shell {" +
      " max-height: 100%;" +
      "}" +
      "@media (max-width: 1100px) {" +
      " .alexquant-news-layout {" +
      "   grid-template-columns: minmax(0, 1fr);" +
      " }" +
      " .alexquant-news-ai-shell {" +
      "   max-height: 420px;" +
      " }" +
      "}",
  );

  injectStylesheet(
    "alexquant-news-pulse-style",
    "@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }",
  );
}
