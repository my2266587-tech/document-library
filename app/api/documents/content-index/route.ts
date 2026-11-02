import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { CONTENT_INDEXED_TYPES, contentDbErrorMessage } from "@/lib/content-search";
import { createOcrWorker, readImageText } from "@/lib/ocr-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stop picking up new images after this long, so the request ends well
// before maxDuration. The client calls again until nothing is left.
const TIME_BUDGET_MS = 35_000;
const BATCH_SIZE = 40;

// Reads (OCR) the text of images that were not read yet and stores it, so
// the content search can find sentences inside them.
export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const categoryId = typeof body?.category_id === "string" ? body.category_id : "all";
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("documents_library")
      .select("id, file_path", { count: "exact" })
      .eq("is_archived", false)
      .is("content_indexed_at", null)
      .in("file_type", CONTENT_INDEXED_TYPES)
      .order("id", { ascending: true });
    if (categoryId !== "all") query = query.eq("category_id", categoryId);

    // A failed image stays pending and is retried next call; the client stops
    // calling once a round reads nothing new.
    const { data: pending, count, error } = await query.range(0, BATCH_SIZE - 1);
    if (error) {
      console.error("[content-index] supabase error:", error);
      return NextResponse.json({ error: contentDbErrorMessage(error) }, { status: 500 });
    }

    const total = count ?? pending?.length ?? 0;
    let indexed = 0;
    const failed: string[] = [];

    if (pending && pending.length > 0) {
      const worker = await createOcrWorker();
      try {
        for (const doc of pending) {
          if (Date.now() - started > TIME_BUDGET_MS) break;
          try {
            const { data: file, error: dlErr } = await supabase.storage
              .from(DOCUMENTS_BUCKET)
              .download(doc.file_path);
            if (dlErr || !file) throw new Error(dlErr?.message ?? "download failed");

            const text = await readImageText(worker, Buffer.from(await file.arrayBuffer()));
            const { error: upErr } = await supabase
              .from("documents_library")
              .update({ content_text: text, content_indexed_at: new Date().toISOString() })
              .eq("id", doc.id);
            if (upErr) throw new Error(upErr.message);
            indexed++;
          } catch (err) {
            console.error(
              `[content-index] failed for ${doc.id}:`,
              err instanceof Error ? err.message : err
            );
            failed.push(doc.id);
          }
        }
      } finally {
        await worker.terminate();
      }
    }

    return NextResponse.json({
      indexed,
      failed: failed.length,
      remaining: Math.max(0, total - indexed),
    });
  } catch (err) {
    console.error("[content-index] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
