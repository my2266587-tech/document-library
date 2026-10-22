import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  contentDbErrorMessage,
  findMatchingParagraphs,
  normalizeForSearch,
} from "@/lib/content-search";
import type { ContentSearchHit, DocumentWithCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_RESULTS = 200;

// Finds the paragraphs (sentences) inside documents' read text that contain the query.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("category_id");
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (!normalizeForSearch(q)) return NextResponse.json({ results: [] });

    const supabase = getSupabaseAdmin();
    const results: ContentSearchHit[] = [];

    // Supabase caps a response at 1,000 rows, so read every page.
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("documents_library")
        .select(
          "id, title, original_file_name, file_path, file_type, file_size, category_id, notes, patient_id, uploaded_by, is_archived, created_at, updated_at, content_text, category:document_categories(id, name, color)"
        )
        .eq("is_archived", false)
        .not("content_text", "is", null)
        .neq("content_text", "")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (categoryId && categoryId !== "all") query = query.eq("category_id", categoryId);

      const { data, error } = await query;
      if (error) {
        console.error("[content-search] supabase error:", error);
        return NextResponse.json({ error: contentDbErrorMessage(error) }, { status: 500 });
      }

      // The joined category is not described in database.types, so type the rows here.
      const rows = (data ?? []) as unknown as (DocumentWithCategory & { content_text: string | null })[];
      for (const { content_text, ...doc } of rows) {
        const paragraphs = findMatchingParagraphs(content_text ?? "", q);
        if (paragraphs.length > 0) results.push({ doc, paragraphs });
      }
      if (rows.length < PAGE_SIZE) break;
    }

    return NextResponse.json({
      results: results.slice(0, MAX_RESULTS),
      truncated: results.length > MAX_RESULTS,
    });
  } catch (err) {
    console.error("[content-search] exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
