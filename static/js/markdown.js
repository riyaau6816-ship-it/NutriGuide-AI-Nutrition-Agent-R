/* ============================================================
   NutriGuide — Markdown Renderer (lightweight)
   Converts basic markdown in AI responses to safe HTML
   ============================================================ */

/**
 * Minimal markdown → HTML for chat bubbles.
 * Handles: **bold**, *italic*, # headings, - bullets, numbered lists, `code`.
 */
function renderMarkdown(text) {
  if (!text) return "";

  // Escape raw HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h6 class='mb-1 mt-2 fw-700' style='font-size:.85rem'>$1</h6>");
  html = html.replace(/^### (.+)$/gm,  "<h5 class='mb-1 mt-2' style='font-size:.9rem'>$1</h5>");
  html = html.replace(/^## (.+)$/gm,   "<h5 class='mb-1 mt-2 fw-800'>$1</h5>");
  html = html.replace(/^# (.+)$/gm,    "<h4 class='mb-1 mt-2 fw-800'>$1</h4>");

  // Bold & Italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g,     "<em>$1</em>");
  html = html.replace(/__(.+?)__/g,     "<strong>$1</strong>");

  // Inline code
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  // Unordered list items
  html = html.replace(/^\s*[-•✅⚠️🔸🔹🍎🌅☀️🌙💧💪🥗]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul class='mb-1'>$1</ul>");

  // Ordered list
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Line breaks
  html = html.replace(/\n{2,}/g, "</p><p class='mb-1'>");
  html = html.replace(/\n/g, "<br />");

  return `<p class='mb-1'>${html}</p>`;
}
