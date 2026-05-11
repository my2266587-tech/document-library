import { NextRequest, NextResponse } from "next/server";
import { DOCUMENTS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const download = Boolean(body?.download);
  const expiresIn =
    typeof body?.expiresIn === "number" && body.expiresIn > 0
      ? Math.min(body.expiresIn, 60 * 60 * 24)
      : 60 * 10;

  const supabase = getSupabaseAdmin();
  const { data: doc, error: fetchErr } = await supabase
    .from("documents_library")
    .select("file_path, original_file_name")
    .eq("id", id)
    .single();

  if (fetchErr || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_path, expiresIn, {
      download: download ? doc.original_file_name : undefined,
    });

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresIn,
    fileName: doc.original_file_name,
  });
}
