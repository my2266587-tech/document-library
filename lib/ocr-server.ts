// Server only: runs tesseract.js in Node (content-index API and the indexing script).
import os from "node:os";
import path from "node:path";
import type { Worker } from "tesseract.js";
import { readBlankData } from "./blank-image";
import { stripNiqqud } from "./content-search";

// Netfree (the content filter on the office network) swaps blocked images for
// a placeholder that says this. Indexing that text would hide the real
// content forever, so it is treated as a failed read.
const FILTER_PLACEHOLDER = /נשלחה\s*לנטפרי/;

export class FilteredImageError extends Error {
  constructor() {
    super("התמונה התקבלה מסוננת (נטפרי) ולא ניתן לקרוא אותה");
  }
}

export async function createOcrWorker(): Promise<Worker> {
  const { createWorker } = await import("tesseract.js");
  // Language data is downloaded once per server instance; only /tmp is writable on Vercel.
  return createWorker("heb", 1, { cachePath: path.join(os.tmpdir(), "tesseract-cache") });
}

export type TextLine = { text: string; top: number; bottom: number };

// Joins wrapped lines (sorted top to bottom) into sentences/paragraphs. Lines
// of one paragraph sit closer together than lines of consecutive paragraphs;
// when the spacing doesn't split into two clear groups, every line is kept on its own.
export function groupLines(lines: TextLine[]): string[] {
  if (lines.length < 2) return lines.map((l) => l.text);
  const pitches = lines.slice(1).map((l, i) => (l.top + l.bottom) / 2 - (lines[i].top + lines[i].bottom) / 2);
  const min = Math.min(...pitches);
  const max = Math.max(...pitches);
  const hasWraps = max - min > min * 0.25;
  const threshold = (min + max) / 2;

  const sentences = [lines[0].text];
  pitches.forEach((pitch, i) => {
    if (hasWraps && pitch < threshold) sentences[sentences.length - 1] += ` ${lines[i + 1].text}`;
    else sentences.push(lines[i + 1].text);
  });
  return sentences;
}

// Hebrew OCR of one image; one sentence/paragraph per line ("" when there is no text).
export async function ocrImage(worker: Worker, image: Buffer): Promise<string> {
  const { data } = await worker.recognize(image, {}, { blocks: true });
  const lines: TextLine[] = (data.blocks ?? [])
    .flatMap((b) => b.paragraphs)
    .flatMap((p) => p.lines)
    .map((l) => ({ text: stripNiqqud(l.text).replace(/\s+/g, " ").trim(), top: l.bbox.y0, bottom: l.bbox.y1 }))
    .filter((l) => l.text.replace(/[^\p{L}\p{N}]/gu, "").length >= 2)
    .sort((a, b) => a.top - b.top);

  const text = groupLines(lines).join("\n");
  if (FILTER_PLACEHOLDER.test(text)) {
    throw new FilteredImageError();
  }
  return text;
}

// בלאנק images carry their exact sentences in the PNG; others go through OCR.
export async function readImageText(worker: Worker, image: Buffer): Promise<string> {
  const embedded = await readBlankData(new Blob([new Uint8Array(image)]));
  if (embedded) {
    return embedded.sentences
      .map((s) => stripNiqqud(s).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return ocrImage(worker, image);
}
