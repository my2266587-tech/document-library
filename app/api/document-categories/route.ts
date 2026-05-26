import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("document_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[document-categories GET] supabase error:", error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    console.error("[document-categories GET] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "שם קטגוריה הוא שדה חובה" },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingErr } = await supabase
      .from("document_categories")
      .select("id")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error("[document-categories POST] dup-check error:", existingErr.message);
    }
    if (existing) {
      return NextResponse.json(
        { error: "קטגוריה בשם הזה כבר קיימת" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("document_categories")
      .insert({
        name,
        description: body.description?.trim() || null,
        color: body.color?.trim() || null,
        sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[document-categories POST] supabase error:", error.message);
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "קטגוריה בשם הזה כבר קיימת" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `שגיאת מסד נתונים: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, category: data }, { status: 201 });
  } catch (err) {
    console.error("[document-categories POST] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאת שרת לא ידועה" },
      { status: 500 }
    );
  }
}
