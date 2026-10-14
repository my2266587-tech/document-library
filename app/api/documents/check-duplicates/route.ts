import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { extOf } from "@/lib/utils";
import type { DuplicateMatch, DuplicateMatchKind } from "@/lib/duplicates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 500;
// Keep each `in (...)` filter short — Hebrew names get long once URL-encoded.
const CHUNK = 40;
const PAGE = 1000;

type Candidate = {
  id: string;
  title: string;
  original_file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  category: { name: string } | null;
};

const SELECT =
  "id, title, original_file_name, file_type, file_size, created_at, category:document_categories(name)";

function norm(name: string): string {
  return name.normalize("NFC").trim().toLowerCase();
}

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** Fetch every non-archived row whose `column` is in `values`, paging past the 1,000-row cap. */
async function fetchWhereIn(
  column: "original_file_name" | "file_size",
  values: (string | number)[]
): Promise<Candidate[]> {
  const supabase = getSupabaseAdmin();
  const rows: Candidate[] = [];
  for (const part of chunks(values)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("documents_library")
        .select(SELECT)
        .eq("is_archived", false)
        .in(column, part)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as unknown as Candidate[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  }
  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const raw: unknown = body?.files;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FILES) {
      return NextResponse.json(
        { error: `יש לשלוח רשימת קבצים (1 עד ${MAX_FILES})` },
        { status: 400 }
      );
    }

    const files = raw.map((f) => ({
      name: typeof f?.name === "string" ? f.name : "",
      size: typeof f?.size === "number" && f.size >= 0 ? f.size : null,
    }));

    const names = [...new Set(files.map((f) => f.name).filter(Boolean))];
    const sizes = [
      ...new Set(
        files.map((f) => f.size).filter((s): s is number => s !== null && s > 0)
      ),
    ];

    const [byName, bySize] = await Promise.all([
      names.length ? fetchWhereIn("original_file_name", names) : [],
      sizes.length ? fetchWhereIn("file_size", sizes) : [],
    ]);

    const candidates = new Map<string, Candidate>();
    for (const row of [...byName, ...bySize]) candidates.set(row.id, row);
    const all = [...candidates.values()];

    const results: DuplicateMatch[][] = files.map((f) => {
      const fname = norm(f.name);
      const fext = extOf(f.name);
      const matches: DuplicateMatch[] = [];
      for (const row of all) {
        const sameName = !!fname && norm(row.original_file_name) === fname;
        const sameSize = f.size !== null && f.size > 0 && row.file_size === f.size;
        const sameType =
          (row.file_type ?? extOf(row.original_file_name)).toLowerCase() === fext;

        let match: DuplicateMatchKind | null = null;
        if (sameName && sameSize) match = "name_and_size";
        else if (sameName) match = "name";
        else if (sameSize && sameType) match = "size_and_type";
        if (!match) continue;

        matches.push({
          id: row.id,
          title: row.title,
          original_file_name: row.original_file_name,
          file_size: row.file_size,
          created_at: row.created_at,
          category_name: row.category?.name ?? null,
          match,
        });
      }
      const rank: Record<DuplicateMatchKind, number> = {
        name_and_size: 0,
        name: 1,
        size_and_type: 2,
      };
      return matches.sort((a, b) => rank[a.match] - rank[b.match]);
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error(
      "[check-duplicates] error:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: "בדיקת כפילויות נכשלה" },
      { status: 500 }
    );
  }
}
