import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildStoragePath, extOf, stripExt } from "@/lib/utils";
import type { UploadResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const categoryId = (form.get("category_id") as string | null)?.trim() || null;
  const notes = (form.get("notes") as string | null)?.trim() || null;

  const supabase = getSupabaseAdmin();
  const results: UploadResult[] = [];

  for (const file of files) {
    const path = buildStoragePath(file.name);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, bytes, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upErr) {
        results.push({ fileName: file.name, ok: false, error: upErr.message });
        continue;
      }

      const fileType =
        extOf(file.name) || (file.type ? file.type.split("/").pop() : null);

      const { data, error } = await supabase
        .from("documents_library")
        .insert({
          title: stripExt(file.name),
          original_file_name: file.name,
          file_path: path,
          file_type: fileType,
          file_size: file.size,
          category_id: categoryId,
          notes,
        })
        .select("id")
        .single();

      if (error) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        results.push({ fileName: file.name, ok: false, error: error.message });
        continue;
      }

      results.push({ fileName: file.name, ok: true, documentId: data.id });
    } catch (e) {
      results.push({
        fileName: file.name,
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results }, { status: 201 });
}
