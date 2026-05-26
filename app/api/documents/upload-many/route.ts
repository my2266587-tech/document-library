import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildStoragePath, extOf, stripExt } from "@/lib/utils";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import type { UploadResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      console.error("[documents upload-many] formData parse failed:", err);
      return NextResponse.json(
        { error: "שגיאה בקריאת הקבצים מהבקשה. ייתכן שהקבצים גדולים מדי." },
        { status: 400 }
      );
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "לא נבחרו קבצים להעלאה." }, { status: 400 });
    }

    const categoryId = (form.get("category_id") as string | null)?.trim() || null;
    const notes = (form.get("notes") as string | null)?.trim() || null;

    const supabase = getSupabaseAdmin();
    const results: UploadResult[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        results.push({
          fileName: file.name,
          ok: false,
          error: `הקובץ גדול מדי (${Math.round(
            file.size / 1024 / 1024
          )}MB). מגבלה: ${MAX_FILE_SIZE_MB}MB.`,
        });
        continue;
      }

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
          console.error("[documents upload-many] storage error:", upErr.message);
          const msg = upErr.message.toLowerCase();
          const hebrew = msg.includes("bucket not found")
            ? `ה-bucket "${DOCUMENTS_BUCKET}" לא קיים`
            : upErr.message;
          results.push({ fileName: file.name, ok: false, error: hebrew });
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
          console.error("[documents upload-many] db error:", error.message);
          await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
          results.push({ fileName: file.name, ok: false, error: error.message });
          continue;
        }

        results.push({ fileName: file.name, ok: true, documentId: data.id });
      } catch (e) {
        console.error("[documents upload-many] file exception:", e);
        results.push({
          fileName: file.name,
          ok: false,
          error: e instanceof Error ? e.message : "שגיאה לא ידועה",
        });
      }
    }

    return NextResponse.json({ results }, { status: 201 });
  } catch (err) {
    console.error("[documents upload-many] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאת שרת לא ידועה" },
      { status: 500 }
    );
  }
}
