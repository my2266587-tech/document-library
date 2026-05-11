import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("category_id");
    const search = url.searchParams.get("q")?.trim();
    const fileType = url.searchParams.get("file_type")?.trim();
    const sort = url.searchParams.get("sort") ?? "created_desc";

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("documents_library")
      .select(
        "id, title, original_file_name, file_path, file_type, file_size, category_id, notes, patient_id, uploaded_by, is_archived, created_at, updated_at, category:document_categories(id, name, color)"
      )
      .eq("is_archived", false);

    if (categoryId && categoryId !== "all") {
      query = query.eq("category_id", categoryId);
    }
    if (search) {
      query = query.ilike("title", `%${search}%`);
    }
    if (fileType && fileType !== "all") {
      query = query.eq("file_type", fileType);
    }

    switch (sort) {
      case "created_asc":
        query = query.order("created_at", { ascending: true });
        break;
      case "title_asc":
        query = query.order("title", { ascending: true });
        break;
      case "title_desc":
        query = query.order("title", { ascending: false });
        break;
      case "created_desc":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data, error } = await query;
    if (error) {
      console.error("[documents GET] supabase error:", error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    console.error("[documents GET] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
