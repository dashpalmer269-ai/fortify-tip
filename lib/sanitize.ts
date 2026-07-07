/**
 * Markdown → HTML sanitization pipeline.
 *
 * Trust model:
 *   - `controls.remediation_guide` / `report_output_text` are seeded via
 *     migrations under service-role. Trust HIGH but defense in depth.
 *   - `policy.content_markdown` is AI-generated from a user-supplied title /
 *     policy_type. Prompt injection could place raw HTML / scripts in the
 *     output. Trust MEDIUM.
 *
 * All call paths funnel through `renderMarkdown()` which:
 *   1. Parses markdown via `marked` (defaults: GFM, headings/lists/links/code)
 *   2. Sanitizes the resulting HTML via sanitize-html, dropping <script>,
 *      inline event handlers, <iframe>, javascript: URLs, etc.
 *   3. Returns a string safe to drop into dangerouslySetInnerHTML.
 *
 * Why sanitize-html and not (isomorphic-)dompurify: DOMPurify needs a DOM,
 * which on the server means jsdom — and jsdom's dependency chain broke the
 * Vercel lambda runtime (require() of an ESM-only transitive,
 * html-encoding-sniffer → @exodus/bytes), 500ing every page that imported
 * this module. sanitize-html is parser-based (htmlparser2), runs identically
 * in Node and the browser, and needs no DOM.
 */

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  // Allowed tags: prose-friendly subset only. No script/iframe/object/embed.
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "strong", "em", "b", "i", "u", "s", "del", "mark",
    "ul", "ol", "li",
    "a",
    "code", "pre",
    "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel", "class", "id"],
    img: ["src", "alt", "title", "class", "id"],
    "*": ["class", "id"],
  },
  // javascript:, data:, vbscript: etc. are stripped; relative URLs allowed.
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  // Drop disallowed tags entirely (default), keeping their text content —
  // same net behavior DOMPurify had for e.g. <span>.
  disallowedTagsMode: "discard",
};

/**
 * Post-process: for every anchor whose href is http(s) and doesn't already
 * carry a target, inject target="_blank" rel="noopener noreferrer". This
 * keeps the source markdown clean (just plain `[text](url)` syntax) while
 * still opening external resources in a new tab with the safe rel value.
 *
 * Run AFTER sanitization so we know the input is already validated; the
 * regex only adds attributes, never removes or escapes content.
 */
function externalizeLinks(html: string): string {
  return html.replace(
    /<a\s+(?![^>]*\btarget=)([^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*)>/gi,
    '<a target="_blank" rel="noopener noreferrer" $1>'
  );
}

/**
 * Parse markdown and return sanitized HTML safe for dangerouslySetInnerHTML.
 * Returns empty string for null/undefined input.
 */
export function renderMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  const raw = marked.parse(input) as string;
  const clean = sanitizeHtml(raw, SANITIZE_CONFIG);
  return externalizeLinks(clean);
}
