import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: {
    title?: string;
    notes?: string | null;
    category_id?: string | null;
    updated_at?: string;
  } = {};
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.notes === "string" || body.notes === null)
    update.notes = body.notes?.trim() || null;
  if (typeof body.category_id === "string" || body.category_id === null)
    update.category_id = body.category_id || null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents_library")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ document: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = getSupabaseAdmin();

  const { data: doc, error: fetchErr } = await supabase
    .from("documents_library")
    .select("file_path")
    .eq("id", id)
    .single();

  if (fetchErr || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { error: storageErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.file_path]);

  if (storageErr) {
    console.error("Storage delete failed:", storageErr.message);
  }

  const { error: dbErr } = await supabase
    .from("documents_library")
    .delete()
    .eq("id", id);

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
