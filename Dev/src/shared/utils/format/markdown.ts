/**
 * Lightweight markdown -> HTML for AI output rendering.
 *
 * Supported syntax:
 * - Headers: # h1, ## h2, ### h3
 * - Emphasis: **bold**, *italic*
 * - Inline code: `code`
 * - Unordered lists: - item (and nested: 2+ spaces before -)
 * - Ordered lists: 1. item
 * - Horizontal rules: ---
 * - Paragraphs (double newline)
 *
 * NOT supported (by design): tables, images, links, nested blocks, raw HTML.
 *
 * Security: HTML entities escaped before markdown processing.
 * No raw HTML from LLM output passes through.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(md: string): string {
  // Step 1: Escape HTML entities
  let html = escapeHtml(md);

  // Step 2: Block-level transforms (order matters - headings before bold)
  html = html
    .replace(/^---+$/gm, '<hr class="md-hr">')
    .replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="md-h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="md-h1">$1</div>')
    .replace(/^ {2,}- (.+)$/gm, '<div class="md-li2">\u2022 $1</div>')
    .replace(/^- (.+)$/gm, '<div class="md-li">\u2022 $1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="md-li">$1</div>');

  // Step 3: Inline transforms
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="md-code">$1</code>');

  // Step 4: Paragraph handling
  html = html
    .replace(/\n{2,}/g, '<div class="md-spacer"></div>')
    .replace(/\n/g, "<br>");

  // Step 5: Cleanup - remove <br> adjacent to block elements
  html = html
    .replace(/<br>\s*(<div)/g, "$1")
    .replace(/(<\/div>)\s*<br>/g, "$1");

  return html;
}
