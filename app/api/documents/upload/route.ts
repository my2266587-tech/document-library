import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildStoragePath, extOf, stripExt } from "@/lib/utils";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Early guard: check Content-Length before parsing body
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength && contentLength > MAX_FILE_SIZE_BYTES + 1024 * 1024) {
      return NextResponse.json(
        {
          error: `הקובץ גדול מדי. המגבלה היא ${MAX_FILE_SIZE_MB}MB.`,
        },
        { status: 413 }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (err) {
      console.error("[documents upload] formData parse failed:", err);
      return NextResponse.json(
        { error: "שגיאה בקריאת הקובץ מהבקשה. ייתכן שהקובץ גדול מדי." },
        { status: 400 }
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "לא נבחר קובץ להעלאה." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `הקובץ גדול מדי (${Math.round(
            file.size / 1024 / 1024
          )}MB). המגבלה היא ${MAX_FILE_SIZE_MB}MB.`,
        },
        { status: 413 }
      );
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
      console.error("[documents upload] storage error:", upErr.message);
      const msg = upErr.message.toLowerCase();
      const hebrew = msg.includes("bucket not found")
        ? `ה-bucket "${DOCUMENTS_BUCKET}" לא קיים ב-Supabase Storage.`
        : `שגיאה בהעלאה ל-Storage: ${upErr.message}`;
      return NextResponse.json({ error: hebrew }, { status: 500 });
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
      console.error("[documents upload] db error:", error.message);
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      return NextResponse.json(
        { error: `שגיאה בשמירת המסמך: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: data }, { status: 201 });
  } catch (err) {
    console.error("[documents upload] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאת שרת לא ידועה" },
      { status: 500 }
    );
  }
}
