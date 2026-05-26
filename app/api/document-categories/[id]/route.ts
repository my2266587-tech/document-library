import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PROTECTED_CATEGORY_NAMES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    const { data: cat, error: fetchErr } = await supabase
      .from("document_categories")
      .select("id, name")
      .eq("id", id)
      .single();

    if (fetchErr || !cat) {
      return NextResponse.json(
        { error: "הקטגוריה לא נמצאה." },
        { status: 404 }
      );
    }

    if (PROTECTED_CATEGORY_NAMES.includes(cat.name)) {
      return NextResponse.json(
        { error: `אי אפשר למחוק את קטגוריית ${cat.name}.` },
        { status: 400 }
      );
    }

    const { count, error: countErr } = await supabase
      .from("documents_library")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countErr) {
      console.error("[document-categories DELETE] count error:", countErr.message);
      return NextResponse.json(
        { error: `שגיאה בבדיקת מסמכים בקטגוריה: ${countErr.message}` },
        { status: 500 }
      );
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "אי אפשר למחוק קטגוריה שיש בה מסמכים. קודם העבירי או מחקי את המסמכים.",
          documents_count: count,
        },
        { status: 409 }
      );
    }

    const { error: delErr } = await supabase
      .from("document_categories")
      .delete()
      .eq("id", id);

    if (delErr) {
      console.error("[document-categories DELETE] delete error:", delErr.message);
      return NextResponse.json(
        { error: `שגיאה במחיקה: ${delErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[document-categories DELETE] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאת שרת לא ידועה" },
      { status: 500 }
    );
  }
}
