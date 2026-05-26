import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildStoragePath } from "@/lib/utils";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.fileName !== "string" ||
      !body.fileName.trim()
    ) {
      return NextResponse.json(
        { error: "שם הקובץ הוא שדה חובה" },
        { status: 400 }
      );
    }

    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `הקובץ גדול מדי (${Math.round(
            fileSize / 1024 / 1024
          )}MB). המגבלה: ${MAX_FILE_SIZE_MB}MB.`,
        },
        { status: 413 }
      );
    }

    const path = buildStoragePath(body.fileName);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error(
        "[signed-upload-url] supabase error:",
        error?.message ?? "no data"
      );
      const msg = error?.message?.toLowerCase() ?? "";
      const hebrew = msg.includes("bucket not found")
        ? `ה-bucket "${DOCUMENTS_BUCKET}" לא קיים ב-Supabase Storage.`
        : `שגיאה ביצירת לינק העלאה: ${error?.message ?? "לא ידוע"}`;
      return NextResponse.json({ error: hebrew }, { status: 500 });
    }

    return NextResponse.json({
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (err) {
    console.error("[signed-upload-url] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאת שרת לא ידועה" },
      { status: 500 }
    );
  }
}
