// TEMP diagnostic: does rotating badly-read scans help? Logs only ids and scores.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { createOcrWorker } from "@/lib/ocr-server";

const score = (t: string) => { const toks = t.split(/\s+/).filter(Boolean); return toks.length ? toks.filter((w) => /^[\u05D0-\u05EA]{3,}[.,:]?$/.test(w)).length / toks.length : 0; };
const s = getSupabaseAdmin();
const all: { id: string; file_path: string; content_text: string | null }[] = [];
for (let f = 0; ; f += 500) { const { data } = await s.from("documents_library").select("id,file_path,content_text").eq("file_type", "pdf").order("id").range(f, f + 499); all.push(...(data ?? [])); if (!data || data.length < 500) break; }
const bad = all.filter((d) => score(d.content_text ?? "") < 0.3).filter((_, i) => i % 35 === 0).slice(0, 12);
const w = await createOcrWorker();
const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist");
for (const d of bad) {
  const { data: file } = await s.storage.from(DOCUMENTS_BUCKET).download(d.file_path);
  const doc = await getDocument({ data: new Uint8Array(await file!.arrayBuffer()), standardFontDataUrl: `${dir}/standard_fonts/`, cMapUrl: `${dir}/cmaps/`, cMapPacked: true, wasmUrl: `${dir}/wasm/`, iccUrl: `${dir}/iccs/`, verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const v1 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: 1700 / v1.width });
  const c = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height)); const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvas: c as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise;
  const img = await loadImage(await c.encode("png"));
  const ops = await page.getOperatorList();
  const res: string[] = [`${d.id} pages=${doc.numPages} size=${Math.round(v1.width)}x${Math.round(v1.height)} ops=${ops.fnArray.length}`];
  for (const rot of [0, 90, 180, 270]) {
    const sw = rot % 180 ? img.height : img.width, sh = rot % 180 ? img.width : img.height;
    const r = createCanvas(sw, sh); const rc = r.getContext("2d");
    rc.translate(sw / 2, sh / 2); rc.rotate((rot * Math.PI) / 180); rc.drawImage(img, -img.width / 2, -img.height / 2);
    const { data } = await w.recognize(await r.encode("png"));
    res.push(`rot${rot}: q=${score(data.text).toFixed(2)} conf=${Math.round(data.confidence)}`);
  }
  console.log(res.join(" | "));
  await doc.cleanup();
}
await w.terminate();
