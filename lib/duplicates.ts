import { parseApiResponse } from "./utils";

/** How an existing document resembles the file about to be uploaded. */
export type DuplicateMatchKind = "name_and_size" | "name" | "size_and_type";

export type DuplicateMatch = {
  id: string;
  title: string;
  original_file_name: string;
  file_size: number | null;
  created_at: string;
  category_name: string | null;
  match: DuplicateMatchKind;
};

export const MATCH_LABELS: Record<DuplicateMatchKind, string> = {
  name_and_size: "שם וגודל זהים",
  name: "שם קובץ זהה",
  size_and_type: "גודל וסוג קובץ זהים",
};

/**
 * Ask the server which of the given files already look like they exist in
 * the library. Returns one list of matches per input file (same order).
 */
export async function checkDuplicates(
  files: File[]
): Promise<DuplicateMatch[][]> {
  if (files.length === 0) return [];
  const res = await fetch("/api/documents/check-duplicates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map((f) => ({ name: f.name, size: f.size })),
    }),
  });
  const data = await parseApiResponse<{ results: DuplicateMatch[][] }>(res);
  return data.results;
}
