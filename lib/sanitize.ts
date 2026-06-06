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
 * All three call paths funnel through `renderMarkdown()` which:
 *   1. Parses markdown via `marked` (defaults: GFM, headings/lists/links/code)
 *   2. Sanitizes the resulting HTML via DOMPurify, dropping <script>,
 *      inline event handlers, <iframe>, javascript: URLs, etc.
 *   3. Returns a string safe to drop into dangerouslySetInnerHTML.
 *
 * Isomorphic via isomorphic-dompurify so the same function works in
 * server components (jsdom under the hood) and client components (window).
 */

import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

const PURIFY_CONFIG = {
  // Allowed tags: prose-friendly subset only. No script/iframe/object/embed.
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "strong", "em", "b", "i", "u", "s", "del", "mark",
    "ul", "ol", "li",
    "a",
    "code", "pre",
    "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "img",
  ] as string[],
  // Added target + rel so we can open external links in a new tab without
  // them being stripped out of the sanitized output below.
  ALLOWED_ATTR: ["href", "title", "alt", "src", "class", "id", "target", "rel"] as string[],
  // Force-treat http:, https:, mailto:; javascript: and others stripped.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Post-process: for every anchor whose href is http(s) and doesn't already
 * carry a target, inject target="_blank" rel="noopener noreferrer". This
 * keeps the source markdown clean (just plain `[text](url)` syntax) while
 * still opening external resources in a new tab with the safe rel value.
 *
 * Run AFTER DOMPurify so we know the input is already validated; the
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
  // sanitize() returns string when RETURN_TRUSTED_TYPE isn't set (which it
  // isn't here). The TS type union includes TrustedHTML; cast for the
  // dangerouslySetInnerHTML consumer.
  const clean = DOMPurify.sanitize(raw, PURIFY_CONFIG) as unknown as string;
  return externalizeLinks(clean);
}
