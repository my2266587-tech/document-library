// Reads the text of every document that was not read yet (PDFs and images)
// and stores it in documents_library.content_text for the content search.
//
// Runs on GitHub Actions (.github/workflows/index-content.yml), where file
// downloads are not filtered. Local run: npm run index:content
//
// The repository is public, so the log holds only ids and counts — never
// titles or document text.
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_CONTENT_TYPES, IMAGE_CONTENT_TYPES } from "@/lib/content-search";
import { createOcrWorker, FilteredImageError, readImageText } from "@/lib/ocr-server";
import { readPdfText } from "@/lib/pdf-text";

const PAGE_SIZE = 1000;
// Stop starting new documents after this long; the next run continues.
const TIME_LIMIT_MS = Number(process.env.INDEX_TIME_LIMIT_MIN ?? 300) * 60_000;

type Pending = { id: string; file_path: string; file_type: string | null };

async function loadPending(): Promise<Pending[]> {
  const supabase = getSupabaseAdmin();
  const all: Pending[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("documents_library")
      .select("id, file_path, file_type")
      .eq("is_archived", false)
      .is("content_indexed_at", null)
      .in("file_type", ALL_CONTENT_TYPES)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`load pending failed: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

async function main() {
  const started = Date.now();
  const supabase = getSupabaseAdmin();
  const pending = await loadPending();
  console.log(`pending: ${pending.length}`);
  if (pending.length === 0) return;

  let done = 0;
  let unreadable = 0;
  let downloadFailed = 0;
  let saveFailed = 0;
  const worker = await createOcrWorker();
  try {
    for (const doc of pending) {
      if (Date.now() - started > TIME_LIMIT_MS) {
        console.log("time limit reached, the next run continues");
        break;
      }
      const t0 = Date.now();
      const { data: file, error: dlErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(doc.file_path);
      if (dlErr || !file) {
        // Left pending; retried on the next run.
        downloadFailed++;
        console.error(`${doc.id} download failed: ${dlErr?.message ?? "no data"}`);
        continue;
      }

      let text = "";
      let detail = "";
      try {
        const bytes = Buffer.from(await file.arrayBuffer());
        if (doc.file_type === "pdf") {
          const r = await readPdfText(worker, bytes);
          text = r.text;
          detail = `pages=${r.pages} ocr=${r.ocrPages}${r.truncated ? " truncated" : ""}`;
        } else if (IMAGE_CONTENT_TYPES.includes(doc.file_type ?? "")) {
          text = await readImageText(worker, bytes);
        }
      } catch (err) {
        if (err instanceof FilteredImageError) {
          downloadFailed++;
          console.error(`${doc.id} download was filtered (Netfree)`);
          continue;
        }
        // A broken file won't read better next time: store it as read with no
        // text so it isn't retried forever.
        unreadable++;
        detail = `unreadable: ${err instanceof Error ? err.message : String(err)}`;
      }

      const { error: upErr } = await supabase
        .from("documents_library")
        .update({ content_text: text, content_indexed_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (upErr) {
        saveFailed++;
        console.error(`${doc.id} save failed: ${upErr.message}`);
        continue;
      }
      done++;
      console.log(`${doc.id} ${doc.file_type} chars=${text.length} ${detail} ${Date.now() - t0}ms`);
    }
  } finally {
    await worker.terminate();
  }

  console.log(
    `read: ${done}, unreadable: ${unreadable}, download failed: ${downloadFailed}, save failed: ${saveFailed}, ` +
      `left: ${pending.length - done}, minutes: ${((Date.now() - started) / 60_000).toFixed(1)}`
  );
  if (saveFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
