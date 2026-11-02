import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  contentDbErrorMessage,
  excerptAround,
  findMatchingParagraphs,
  searchWords,
} from "@/lib/content-search";
import type { ContentSearchHit, DocumentWithCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rows carry the full document text, so pages are kept small.
const PAGE_SIZE = 200;
const MAX_RESULTS = 200;
const MAX_PLACES_PER_DOC = 5;

// Finds the places (sentences/paragraphs) inside documents' read text that contain the query.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("category_id");
    const q = url.searchParams.get("q")?.trim() ?? "";
    const words = searchWords(q);
    if (words.length === 0) return NextResponse.json({ results: [] });

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
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      // Only documents holding every word can match, so the database narrows
      // them down first (words are letters/digits only, safe in a pattern).
      for (const w of words) query = query.ilike("content_text", `%${w}%`);
      if (categoryId && categoryId !== "all") query = query.eq("category_id", categoryId);

      const { data, error } = await query;
      if (error) {
        console.error("[content-search] supabase error:", error);
        return NextResponse.json({ error: contentDbErrorMessage(error) }, { status: 500 });
      }

      // The joined category is not described in database.types, so type the rows here.
      const rows = (data ?? []) as unknown as (DocumentWithCategory & { content_text: string | null })[];
      for (const { content_text, ...doc } of rows) {
        const places = findMatchingParagraphs(content_text ?? "", q);
        if (places.length === 0) continue;
        results.push({
          doc,
          paragraphs: places.slice(0, MAX_PLACES_PER_DOC).map((p) => excerptAround(p, q)),
          totalPlaces: places.length,
        });
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
