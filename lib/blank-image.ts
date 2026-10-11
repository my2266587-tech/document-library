// Round-tripping a בלאנק image back into the editor.
//
// Every exported PNG carries the sentences, page mode and font size in a
// tEXt chunk, so re-opening it restores the exact text. Images exported
// before that (no chunk) fall back to Hebrew OCR over the sentence area of
// the letterhead; the result is then fixed up by hand in the editor.

export type BlankPageMode = "full" | "card";

export type BlankData = {
  v: 1;
  mode: BlankPageMode;
  fontSize: number;
  sentences: string[];
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHUNK_KEYWORD = "mahar-acher-blank";

// ---------------------------------------------------------------------------
// PNG tEXt chunk read/write
// ---------------------------------------------------------------------------
let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function isPng(bytes: Uint8Array) {
  return bytes.length > 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

function utf8ToBase64(text: string) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToUtf8(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Inserts the בלאנק data as a tEXt chunk right before IEND. The payload is
// base64 JSON, since tEXt is Latin-1 only.
export async function embedBlankData(png: Blob, data: BlankData): Promise<Blob> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (!isPng(bytes)) return png;

  const ascii = (s: string) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
  const typeAndData = new Uint8Array([
    ...ascii("tEXt"),
    ...ascii(CHUNK_KEYWORD),
    0,
    ...ascii(utf8ToBase64(JSON.stringify(data))),
  ]);
  const chunk = new Uint8Array(typeAndData.length + 8);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, typeAndData.length - 4);
  chunk.set(typeAndData, 4);
  view.setUint32(chunk.length - 4, crc32(typeAndData));

  const iendStart = bytes.length - 12; // IEND is always the last 12 bytes
  return new Blob([bytes.slice(0, iendStart), chunk, bytes.slice(iendStart)], { type: "image/png" });
}

export async function readBlankData(file: Blob): Promise<BlankData | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPng(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const latin1 = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos);
    const type = latin1(pos + 4, pos + 8);
    const dataStart = pos + 8;
    if (type === "IEND") break;
    if (type === "tEXt") {
      const sep = bytes.indexOf(0, dataStart);
      if (sep > 0 && sep < dataStart + len && latin1(dataStart, sep) === CHUNK_KEYWORD) {
        try {
          const parsed = JSON.parse(base64ToUtf8(latin1(sep + 1, dataStart + len))) as BlankData;
          if (parsed?.v === 1 && Array.isArray(parsed.sentences)) return parsed;
        } catch {
          return null;
        }
      }
    }
    pos = dataStart + len + 4;
  }
  return null;
}

// ---------------------------------------------------------------------------
// OCR fallback for images exported before the data chunk existed
// ---------------------------------------------------------------------------

// Natural letterhead geometry (px), mirrored from BlankRecorder's renderFrame.
const FRAME_W = 700;
const FRAME_H = 990;
const TEXT_LEFT = 110;
const TEXT_RIGHT = 46;
const TEXT_TOP = 70;
const FOOTER_H = 150;
const PARAGRAPH_GAP = 20; // the mb-5 between sentences
const OCR_SCALE = 2; // every image is resampled so the frame is 1400px wide

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("לא הצלחתי לפתוח את התמונה"));
    };
    img.src = url;
  });
}

// Crops the sentence area out of the letterhead (or out of the portrait
// letterhead centered inside a landscape card), resamples it to a known
// scale and thresholds it to black-on-white for the OCR engine.
function cropSentenceArea(img: HTMLImageElement): { canvas: HTMLCanvasElement; mode: BlankPageMode } {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const mode: BlankPageMode = W > H ? "card" : "full";
  const frameW = mode === "card" ? (H * FRAME_W) / FRAME_H : W;
  const offsetX = (W - frameW) / 2;
  const s = frameW / FRAME_W;

  const sx = offsetX + TEXT_LEFT * s;
  const sy = TEXT_TOP * s;
  const sw = (FRAME_W - TEXT_LEFT - TEXT_RIGHT) * s;
  const sh = Math.max(1, H - sy - FOOTER_H * s);
  const k = OCR_SCALE / s;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * k);
  canvas.height = Math.round(sh * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("הדפדפן לא תומך בעיבוד תמונה");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < 165 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(pixels, 0, 0);
  return { canvas, mode };
}

type OcrLine = { text: string; center: number };

// Collapses whitespace and drops a stray single non-letter glyph at either
// end of the line (speckle the OCR reads as "0", "|", "." and so on).
function cleanLine(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\s"'״׳(]\s+|\s+[^\p{L}\s"'״׳)!?.,]$/gu, "")
    .trim();
}

// Lines of one sentence sit `2 * fontSize` apart; consecutive sentences are
// an extra PARAGRAPH_GAP apart. When the gaps split into two clusters the
// small one is "wrapped line", otherwise every line is its own sentence.
function groupLines(lines: OcrLine[]): { sentences: string[]; fontSize: number | null } {
  if (lines.length === 0) return { sentences: [], fontSize: null };
  if (lines.length === 1) return { sentences: [lines[0].text], fontSize: null };

  const gaps = lines.slice(1).map((l, i) => l.center - lines[i].center);
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  const hasWraps = maxGap - minGap > (PARAGRAPH_GAP * OCR_SCALE) / 2;
  const threshold = (minGap + maxGap) / 2;

  const sentences: string[] = [lines[0].text];
  gaps.forEach((gap, i) => {
    if (hasWraps && gap < threshold) sentences[sentences.length - 1] += ` ${lines[i + 1].text}`;
    else sentences.push(lines[i + 1].text);
  });

  const pitch = hasWraps ? minGap : minGap - PARAGRAPH_GAP * OCR_SCALE;
  return { sentences, fontSize: Math.round(pitch / OCR_SCALE / 2) };
}

export async function recognizeBlankImage(
  file: Blob,
  onProgress?: (fraction: number) => void
): Promise<{ mode: BlankPageMode; fontSize: number | null; sentences: string[] }> {
  const img = await loadImage(file);
  const { canvas, mode } = cropSentenceArea(img);

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("heb", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const lines: OcrLine[] = (data.blocks ?? [])
      .flatMap((b) => b.paragraphs)
      .flatMap((p) => p.lines)
      .map((l) => ({ text: cleanLine(l.text), center: (l.bbox.y0 + l.bbox.y1) / 2 }))
      .filter((l) => l.text.replace(/[^\p{L}\p{N}]/gu, "").length >= 2)
      .sort((a, b) => a.center - b.center);
    if (mode === "card") {
      // A card always holds exactly one sentence, so every line is a wrap.
      const pitch = lines.length > 1 ? (lines[lines.length - 1].center - lines[0].center) / (lines.length - 1) : 0;
      return {
        mode,
        sentences: lines.length > 0 ? [lines.map((l) => l.text).join(" ")] : [],
        fontSize: pitch > 0 ? Math.round(pitch / OCR_SCALE / 2) : null,
      };
    }
    return { mode, ...groupLines(lines) };
  } finally {
    await worker.terminate();
  }
}
