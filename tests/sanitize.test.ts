import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/sanitize";

describe("markdown sanitizer", () => {
  it("returns empty string for null/undefined", () => {
    expect(renderMarkdown(null)).toBe("");
    expect(renderMarkdown(undefined)).toBe("");
  });

  it("renders headings + paragraphs cleanly", () => {
    const html = renderMarkdown("# Title\n\nA paragraph.");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>A paragraph.</p>");
  });

  it("renders strong + em", () => {
    const html = renderMarkdown("This is **bold** and _italic_.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("strips script tags", () => {
    const html = renderMarkdown("# Heading\n\n<script>alert(1)</script>\n\nOK.");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("OK.");
  });

  it("strips event handlers on inline tags", () => {
    const html = renderMarkdown("<p onclick=\"alert(1)\">x</p>");
    expect(html).not.toContain("onclick");
  });

  it("strips javascript: URLs from images", () => {
    const html = renderMarkdown("![oops](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("preserves http(s) URLs in images", () => {
    const html = renderMarkdown("![logo](https://example.com/logo.png)");
    expect(html).toContain("https://example.com/logo.png");
  });

  it("strips iframes", () => {
    const html = renderMarkdown('<iframe src="https://evil.com"></iframe>');
    expect(html.toLowerCase()).not.toContain("<iframe");
  });

  it("preserves ordered + unordered lists", () => {
    const html = renderMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
  });
});
