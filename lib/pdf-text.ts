// Reads the text of a PDF for the content search. Used only by the indexing
// script (scripts/index-content.ts), not by the Next.js app.
//
// Pages with a text layer are read directly; pages without one (scans) are
// rendered to an image and go through Hebrew OCR.
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Worker } from "tesseract.js";
import { stripNiqqud } from "./content-search";
import { groupLines, ocrImage, type TextLine } from "./ocr-server";

const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist");
// A page with fewer letters than this in its text layer is treated as a scan.
const MIN_TEXT_LETTERS = 20;
// Scans are rendered this wide before OCR (about 200 DPI for A4).
const OCR_RENDER_WIDTH = 1700;
// OCR is ~2-5s per page; very long scanned books are read up to this page.
export const MAX_OCR_PAGES = 150;

export type PdfTextResult = { text: string; pages: number; ocrPages: number; truncated: boolean };

function letters(text: string) {
  return text.replace(/[^\p{L}]/gu, "").length;
}

type Piece = { str: string; left: number; right: number };

// Pieces of one line in reading order. Hebrew lines run right to left; PDF
// writers often emit them out of order (e.g. letter by letter with niqqud).
function joinLine(pieces: Piece[], height: number): string {
  // Some writers emit zero-width "spaces" between a letter and its niqqud.
  const real = pieces.filter((p) => p.str.trim() || p.right - p.left > height * 0.2);
  const rtl = /[֐-׿]/.test(real.map((p) => p.str).join(""));
  const sorted = [...real].sort((a, b) => (rtl ? b.right - a.right : a.left - b.left));
  let out = "";
  // How far the line has reached so far (niqqud marks sit inside their letter).
  let edge = rtl ? Infinity : -Infinity;
  for (const p of sorted) {
    const gap = rtl ? edge - p.right : p.left - edge;
    if (out && gap > height * 0.25 && !/\s$/.test(out) && !/^\s/.test(p.str)) out += " ";
    out += p.str;
    edge = rtl ? Math.min(edge, p.left) : Math.max(edge, p.right);
  }
  return out;
}

// Text-layer items → lines (by baseline) → paragraphs.
function textLayerParagraphs(items: TextItem[], pageHeight: number): string[] {
  const rows: { y: number; height: number; pieces: Piece[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const height = Math.abs(item.transform[3]) || item.height || 10;
    const piece = { str: item.str, left: item.transform[4], right: item.transform[4] + item.width };
    const row = rows.find((r) => Math.abs(r.y - y) < height * 0.5);
    if (row) row.pieces.push(piece);
    else rows.push({ y, height, pieces: [piece] });
  }
  const lines: TextLine[] = rows
    .map((r) => ({
      text: stripNiqqud(joinLine(r.pieces, r.height)).replace(/\s+/g, " ").trim(),
      top: pageHeight - r.y - r.height,
      bottom: pageHeight - r.y,
    }))
    .filter((l) => l.text)
    .sort((a, b) => a.top - b.top);
  return groupLines(lines);
}

export async function readPdfText(worker: Worker, data: Buffer): Promise<PdfTextResult> {
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: `${PDFJS_DIR}/standard_fonts/`,
    cMapUrl: `${PDFJS_DIR}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${PDFJS_DIR}/wasm/`,
    iccUrl: `${PDFJS_DIR}/iccs/`,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;

  const paragraphs: string[] = [];
  let ocrPages = 0;
  let truncated = false;
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const items = content.items.filter((i): i is TextItem => "str" in i);
        const pageParagraphs = textLayerParagraphs(items, viewport.height);

        if (letters(pageParagraphs.join("")) >= MIN_TEXT_LETTERS) {
          paragraphs.push(...pageParagraphs);
          continue;
        }
        if (ocrPages >= MAX_OCR_PAGES) {
          truncated = true;
          continue;
        }

        const scale = OCR_RENDER_WIDTH / viewport.width;
        const scaled = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(scaled.width), Math.ceil(scaled.height));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport: scaled,
        }).promise;
        const text = await ocrImage(worker, await canvas.encode("png"));
        ocrPages++;
        if (text) paragraphs.push(...text.split("\n"));
      } finally {
        page.cleanup();
      }
    }
    return { text: paragraphs.join("\n"), pages: doc.numPages, ocrPages, truncated };
  } finally {
    await loadingTask.destroy();
  }
}
