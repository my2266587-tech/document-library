import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildStoragePath, extOf, stripExt } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const titleRaw = (form.get("title") as string | null)?.trim();
  const categoryId = (form.get("category_id") as string | null)?.trim() || null;
  const notes = (form.get("notes") as string | null)?.trim() || null;

  const supabase = getSupabaseAdmin();
  const path = buildStoragePath(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json(
      { error: `Storage upload failed: ${upErr.message}` },
      { status: 500 }
    );
  }

  const title = titleRaw || stripExt(file.name);
  const fileType = extOf(file.name) || (file.type ? file.type.split("/").pop() : null);

  const { data, error } = await supabase
    .from("documents_library")
    .insert({
      title,
      original_file_name: file.name,
      file_path: path,
      file_type: fileType,
      file_size: file.size,
      category_id: categoryId,
      notes,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data }, { status: 201 });
}
