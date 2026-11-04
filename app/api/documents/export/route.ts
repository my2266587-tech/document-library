import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildZipPaths, type ZipSource } from "@/lib/zip-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_URLS_PER_REQUEST = 100;
// Long enough for a batch to finish downloading on a slow connection; the
// browser asks for the next batch as it goes.
const URL_EXPIRES_IN = 60 * 30;

type Row = {
  id: string;
  title: string;
  original_file_name: string;
  file_type: string | null;
  file_size: number | null;
  category: { name: string; sort_order: number } | null;
};

// The list of files for the ZIP download, each with its folder/file name.
// The ZIP itself is built in the browser: the whole library (~1GB) is too
// big and slow for a server function, and the filtered network on the
// user's side blocks ZIP downloads.
export async function GET(req: NextRequest) {
  const categoryId = new URL(req.url).searchParams.get("category_id");
  const supabase = getSupabaseAdmin();

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("documents_library")
      .select("id, title, original_file_name, file_type, file_size, category:document_categories(name, sort_order)")
      .eq("is_archived", false);
    if (categoryId && categoryId !== "all") query = query.eq("category_id", categoryId);
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[documents export] list failed:", error.message);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  // Category order as in the tabs, then upload order inside each folder.
  rows.sort(
    (a, b) =>
      (a.category?.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.category?.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      (a.category?.name ?? "").localeCompare(b.category?.name ?? "", "he")
  );
  const sources: ZipSource[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    original_file_name: r.original_file_name,
    file_type: r.file_type,
    category_name: r.category?.name ?? null,
  }));
  const paths = buildZipPaths(sources);

  return NextResponse.json({
    entries: rows.map((r) => ({ id: r.id, path: paths.get(r.id)!, size: r.file_size })),
  });
}

// Short-lived download links for a batch of documents: { ids } → { urls: { id: url } }.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: unknown = body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_URLS_PER_REQUEST ||
    !ids.every((id) => typeof id === "string")
  ) {
    return NextResponse.json({ error: `ids must be 1–${MAX_URLS_PER_REQUEST} document ids` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: docs, error } = await supabase
    .from("documents_library")
    .select("id, file_path")
    .in("id", ids as string[]);
  if (error) {
    console.error("[documents export] lookup failed:", error.message);
    return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
  }

  const urls: Record<string, string> = {};
  if (docs && docs.length > 0) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrls(
        docs.map((d) => d.file_path),
        URL_EXPIRES_IN
      );
    if (signErr || !signed) {
      console.error("[documents export] signing failed:", signErr?.message);
      return NextResponse.json({ error: signErr?.message ?? "Failed to create signed URLs" }, { status: 500 });
    }
    const idByPath = new Map(docs.map((d) => [d.file_path, d.id]));
    for (const s of signed) {
      const id = s.path ? idByPath.get(s.path) : undefined;
      if (id && s.signedUrl && !s.error) urls[id] = s.signedUrl;
    }
  }
  return NextResponse.json({ urls });
}
