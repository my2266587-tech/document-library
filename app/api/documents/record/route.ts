import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { extOf, stripExt } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.path !== "string" ||
      !body.path ||
      typeof body.original_file_name !== "string" ||
      !body.original_file_name
    ) {
      return NextResponse.json(
        { error: "שדות חובה חסרים (path, original_file_name)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const original_file_name: string = body.original_file_name;
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : stripExt(original_file_name);

    const file_type =
      typeof body.file_type === "string" && body.file_type
        ? body.file_type
        : extOf(original_file_name) || null;

    const { data, error } = await supabase
      .from("documents_library")
      .insert({
        title,
        original_file_name,
        file_path: body.path,
        file_type,
        file_size: typeof body.file_size === "number" ? body.file_size : null,
        category_id: body.category_id || null,
        notes:
          typeof body.notes === "string" && body.notes.trim()
            ? body.notes.trim()
            : null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[record] db error:", error.message);
      // Cleanup orphan file from storage on DB failure
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([body.path]);
      return NextResponse.json(
        { error: `שגיאה בשמירת המסמך: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: data }, { status: 201 });
  } catch (err) {
    console.error("[record] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאת שרת לא ידועה" },
      { status: 500 }
    );
  }
}
