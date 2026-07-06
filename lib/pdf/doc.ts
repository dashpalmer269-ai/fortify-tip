/**
 * Minimal deterministic PDF layout engine on pdf-lib.
 *
 * Why not puppeteer: a headless browser doesn't fit Vercel's function size
 * budget and makes output depend on browser rendering. pdf-lib with the
 * built-in Standard 14 fonts produces byte-stable, auditor-friendly output
 * with zero binary assets.
 *
 * The engine is a vertical flow: every draw call advances a cursor and
 * page-breaks automatically. Tables re-draw their header row after a break.
 * Standard fonts are WinAnsi-only, so all text passes through toWinAnsi().
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 54; // 0.75in
const FOOTER_ZONE = 40;

const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.35, 0.35, 0.35);
const FAINT = rgb(0.55, 0.55, 0.55);
const RULE = rgb(0.85, 0.85, 0.85);
const RULE_DARK = rgb(0.07, 0.07, 0.07);
const DANGER = rgb(0.75, 0.16, 0.16);

/** Map common Unicode to WinAnsi equivalents; drop anything else unmappable. */
export function toWinAnsi(input: string): string {
  const map: Record<string, string> = {
    "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "―": "-", "…": "...",
    "•": "-", "·": "-", "→": "->", "←": "<-",
    " ": " ", "​": "", "﻿": "",
  };
  let out = "";
  for (const ch of input) {
    const mapped = map[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0)!;
    // Printable ASCII + Latin-1 supplement survive; everything else drops.
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff)) out += ch;
  }
  return out;
}

export interface TableColumn {
  header: string;
  /** Relative width weight. */
  flex: number;
  align?: "left" | "right";
  mono?: boolean;
}

export interface ParagraphOptions {
  size?: number;
  font?: "serif" | "sans" | "mono";
  bold?: boolean;
  color?: RGB;
  lineGap?: number;
  spaceAfter?: number;
}

export class PdfDoc {
  private constructor(
    private doc: PDFDocument,
    private serif: PDFFont,
    private serifBold: PDFFont,
    private sans: PDFFont,
    private sansBold: PDFFont,
    private mono: PDFFont
  ) {}

  private page!: PDFPage;
  private y = 0;

  static async create(): Promise<PdfDoc> {
    const doc = await PDFDocument.create();
    const [serif, serifBold, sans, sansBold, mono] = await Promise.all([
      doc.embedFont(StandardFonts.TimesRoman),
      doc.embedFont(StandardFonts.TimesRomanBold),
      doc.embedFont(StandardFonts.Helvetica),
      doc.embedFont(StandardFonts.HelveticaBold),
      doc.embedFont(StandardFonts.Courier),
    ]);
    const b = new PdfDoc(doc, serif, serifBold, sans, sansBold, mono);
    b.newPage();
    return b;
  }

  private font(kind: "serif" | "sans" | "mono", bold: boolean): PDFFont {
    if (kind === "mono") return this.mono;
    if (kind === "sans") return bold ? this.sansBold : this.sans;
    return bold ? this.serifBold : this.serif;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER_ZONE) this.newPage();
  }

  get contentWidth(): number {
    return PAGE_W - MARGIN * 2;
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const clean = toWinAnsi(text);
    const lines: string[] = [];
    for (const rawLine of clean.split("\n")) {
      const words = rawLine.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width || !current) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  /** Two-cell top band: bold letter-spaced brand left, meta lines right. */
  brandHeader(metaLines: string[]) {
    const brand = "F O R T I F Y";
    this.page.drawText(brand, {
      x: MARGIN,
      y: this.y - 10,
      size: 11,
      font: this.sansBold,
      color: INK,
    });
    let metaY = this.y - 8;
    for (const line of metaLines) {
      const text = toWinAnsi(line);
      const w = this.sans.widthOfTextAtSize(text, 8);
      this.page.drawText(text, { x: PAGE_W - MARGIN - w, y: metaY, size: 8, font: this.sans, color: MUTED });
      metaY -= 11;
    }
    const bandBottom = Math.min(this.y - 22, metaY + 3);
    this.page.drawLine({
      start: { x: MARGIN, y: bandBottom },
      end: { x: PAGE_W - MARGIN, y: bandBottom },
      thickness: 1.5,
      color: RULE_DARK,
    });
    this.y = bandBottom - 24;
  }

  title(text: string) {
    this.paragraph(text, { size: 26, font: "serif", bold: true, spaceAfter: 4 });
  }

  subtitle(text: string) {
    this.paragraph(text, { size: 11, font: "serif", color: MUTED, spaceAfter: 22 });
  }

  sectionTitle(text: string) {
    this.ensure(34);
    const label = toWinAnsi(text.toUpperCase());
    this.page.drawText(label, {
      x: MARGIN,
      y: this.y - 9,
      size: 9,
      font: this.sansBold,
      color: MUTED,
    });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 15 },
      end: { x: PAGE_W - MARGIN, y: this.y - 15 },
      thickness: 0.7,
      color: RULE,
    });
    this.y -= 27;
  }

  paragraph(text: string, opts: ParagraphOptions = {}) {
    const size = opts.size ?? 11;
    const font = this.font(opts.font ?? "serif", opts.bold ?? false);
    const lineHeight = size * (opts.lineGap ?? 1.45);
    const lines = this.wrap(text, font, size, this.contentWidth);
    for (const line of lines) {
      this.ensure(lineHeight);
      if (line) {
        this.page.drawText(line, {
          x: MARGIN,
          y: this.y - size,
          size,
          font,
          color: opts.color ?? INK,
        });
      }
      this.y -= lineHeight;
    }
    this.y -= opts.spaceAfter ?? 10;
  }

  /**
   * Flowing table. Column widths from flex weights; header re-drawn after
   * page breaks; cell text wraps and the row takes the tallest cell.
   */
  table(columns: TableColumn[], rows: string[][], opts: { fontSize?: number } = {}) {
    const size = opts.fontSize ?? 9.5;
    const totalFlex = columns.reduce((s, c) => s + c.flex, 0);
    const widths = columns.map((c) => (c.flex / totalFlex) * this.contentWidth);
    const pad = 5;

    const drawHeader = () => {
      this.ensure(22);
      let x = MARGIN;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!;
        const label = toWinAnsi(col.header.toUpperCase());
        const w = this.sansBold.widthOfTextAtSize(label, 7.5);
        const tx = col.align === "right" ? x + widths[i]! - w - pad : x + pad;
        this.page.drawText(label, { x: tx, y: this.y - 10, size: 7.5, font: this.sansBold, color: MUTED });
        x += widths[i]!;
      }
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - 15 },
        end: { x: PAGE_W - MARGIN, y: this.y - 15 },
        thickness: 0.7,
        color: RULE,
      });
      this.y -= 20;
    };

    drawHeader();

    for (const row of rows) {
      const cellLines: string[][] = row.map((cell, i) => {
        const font = columns[i]?.mono ? this.mono : this.serif;
        return this.wrap(cell ?? "", font, size, widths[i]! - pad * 2);
      });
      const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowHeight = rowLines * (size * 1.35) + 6;

      if (this.y - rowHeight < MARGIN + FOOTER_ZONE) {
        this.newPage();
        drawHeader();
      }

      let x = MARGIN;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!;
        const font = col.mono ? this.mono : this.serif;
        let lineY = this.y - size;
        for (const line of cellLines[i] ?? []) {
          const w = font.widthOfTextAtSize(line, size);
          const tx = col.align === "right" ? x + widths[i]! - w - pad : x + pad;
          this.page.drawText(line, { x: tx, y: lineY, size, font, color: INK });
          lineY -= size * 1.35;
        }
        x += widths[i]!;
      }
      this.y -= rowHeight;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 2 },
        end: { x: PAGE_W - MARGIN, y: this.y + 2 },
        thickness: 0.4,
        color: RULE,
      });
    }
    this.y -= 12;
  }

  /** Definition-list item: mono key chip + wrapped statement text. */
  listItem(key: string, text: string) {
    const keySize = 8.5;
    const textSize = 10;
    const keyText = toWinAnsi(key);
    const keyWidth = this.mono.widthOfTextAtSize(keyText, keySize) + 6;
    const textWidth = this.contentWidth - keyWidth - 8;
    const lines = this.wrap(text, this.serif, textSize, textWidth);
    const height = Math.max(1, lines.length) * textSize * 1.4 + 5;
    this.ensure(height);
    this.page.drawText(keyText, {
      x: MARGIN,
      y: this.y - textSize,
      size: keySize,
      font: this.mono,
      color: MUTED,
    });
    let lineY = this.y - textSize;
    for (const line of lines) {
      this.page.drawText(line, {
        x: MARGIN + keyWidth + 8,
        y: lineY,
        size: textSize,
        font: this.serif,
        color: INK,
      });
      lineY -= textSize * 1.4;
    }
    this.y -= height;
  }

  /** Wet-ink signature lines (unsigned attestations). */
  signatureLines() {
    const specs: Array<{ label: string; width: number }> = [
      { label: "SIGNATURE", width: 360 },
      { label: "PRINTED NAME & TITLE", width: 230 },
      { label: "DATE", width: 230 },
    ];
    for (const spec of specs) {
      this.ensure(56);
      this.y -= 30;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: MARGIN + spec.width, y: this.y },
        thickness: 0.8,
        color: RULE_DARK,
      });
      this.page.drawText(spec.label, {
        x: MARGIN,
        y: this.y - 11,
        size: 7,
        font: this.sans,
        color: FAINT,
      });
      this.y -= 22;
    }
  }

  spacer(points: number) {
    this.ensure(points);
    this.y -= points;
  }

  get danger(): RGB {
    return DANGER;
  }
  get muted(): RGB {
    return MUTED;
  }

  /** Draw the per-page footer on every page, then serialize. */
  async finalize(footerLines: string[]): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((page, idx) => {
      page.drawLine({
        start: { x: MARGIN, y: MARGIN - 6 },
        end: { x: PAGE_W - MARGIN, y: MARGIN - 6 },
        thickness: 0.5,
        color: RULE,
      });
      let fy = MARGIN - 16;
      for (const line of footerLines) {
        page.drawText(toWinAnsi(line), { x: MARGIN, y: fy, size: 6.5, font: this.sans, color: FAINT });
        fy -= 8.5;
      }
      const pageLabel = `Page ${idx + 1} of ${total}`;
      const w = this.sans.widthOfTextAtSize(pageLabel, 6.5);
      page.drawText(pageLabel, {
        x: PAGE_W - MARGIN - w,
        y: MARGIN - 16,
        size: 6.5,
        font: this.sans,
        color: FAINT,
      });
    });
    return this.doc.save();
  }
}
