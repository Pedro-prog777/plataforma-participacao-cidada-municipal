/** Geração de CSV, JSON e PDF para exportações em formato aberto (RF045, RF049, RNF13) e comprovantes. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** CSV com separador ";" (padrão brasileiro), BOM UTF-8 e proteção contra injeção de fórmulas. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n");
}

/** Converte para os caracteres suportados pela fonte padrão do PDF (WinAnsi). */
function winAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/≠/g, "!=")
    .replace(/[^\x00-\xFF–—…€]/g, "?");
}

type PdfBlock = { type: "title"; text: string } | { type: "subtitle"; text: string } | { type: "text"; text: string } | { type: "table"; head: string[]; rows: string[][] } | { type: "space" };

export async function buildPdf(blocks: PdfBlock[], footer: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  let page: PDFPage = doc.addPage([595.28, 841.89]);
  let y = page.getHeight() - margin;
  const width = page.getWidth() - margin * 2;

  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = page.getHeight() - margin;
  };
  const wrap = (text: string, f: PDFFont, size: number, max: number) => {
    const words = winAnsi(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > max && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const write = (text: string, f: PDFFont, size: number, color = rgb(0.1, 0.1, 0.15)) => {
    for (const line of wrap(text, f, size, width)) {
      if (y < margin + size) newPage();
      page.drawText(line, { x: margin, y, size, font: f, color });
      y -= size * 1.45;
    }
  };

  for (const b of blocks) {
    if (b.type === "title") write(b.text, bold, 16, rgb(0.05, 0.22, 0.42));
    else if (b.type === "subtitle") write(b.text, bold, 12);
    else if (b.type === "text") write(b.text, font, 10);
    else if (b.type === "space") y -= 10;
    else if (b.type === "table") {
      const colW = width / b.head.length;
      const drawRow = (cells: string[], f: PDFFont) => {
        const wrapped = cells.map((c) => wrap(c, f, 9, colW - 6));
        const h = Math.max(...wrapped.map((w) => w.length)) * 12 + 4;
        if (y - h < margin) newPage();
        wrapped.forEach((lines, i) => lines.forEach((l, j) => page.drawText(l, { x: margin + i * colW + 3, y: y - 10 - j * 12, size: 9, font: f })));
        page.drawLine({ start: { x: margin, y: y - h }, end: { x: margin + width, y: y - h }, thickness: 0.5, color: rgb(0.75, 0.75, 0.8) });
        y -= h;
      };
      drawRow(b.head, bold);
      b.rows.forEach((r) => drawRow(r, font));
      y -= 8;
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(winAnsi(`${footer} — página ${i + 1} de ${pages.length}`), { x: margin, y: 25, size: 8, font, color: rgb(0.4, 0.4, 0.45) }));
  return doc.save();
}
