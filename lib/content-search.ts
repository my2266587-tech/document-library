// Matching a typed sentence against text read (OCR) from documents.
// Shared by the search API and the results UI (for highlighting).

export const CONTENT_INDEXED_TYPES = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

// Shown until supabase/add-content-search.sql has been run (Postgres 42703 = undefined column).
export function contentDbErrorMessage(error: { code?: string; message: string }): string {
  return error.code === "42703"
    ? "חסרה עמודת תוכן במסד הנתונים. יש להריץ את הקובץ supabase/add-content-search.sql ב-Supabase."
    : `Database error: ${error.message}`;
}

// Drop niqqud/cantillation marks, treat punctuation (incl. maqaf) as spaces, collapse whitespace.
export function normalizeForSearch(text: string): string {
  return text
    .replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function searchWords(query: string): string[] {
  return normalizeForSearch(query).split(" ").filter(Boolean);
}

// A paragraph matches when it holds the whole phrase, or (OCR may break the
// word order or spacing) every word of the query.
export function paragraphMatches(paragraph: string, query: string): boolean {
  const para = normalizeForSearch(paragraph);
  const phrase = normalizeForSearch(query);
  if (!phrase) return false;
  if (para.includes(phrase)) return true;
  const words = phrase.split(" ");
  return words.length > 1 && words.every((w) => para.includes(w));
}

export function findMatchingParagraphs(contentText: string, query: string): string[] {
  const paragraphs = contentText
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const matches = paragraphs.filter((p) => paragraphMatches(p, query));
  if (matches.length > 0) return matches;
  // The sentence may run over two lines that OCR kept apart.
  return paragraphs
    .slice(1)
    .map((p, i) => `${paragraphs[i]} ${p}`)
    .filter((pair) => paragraphMatches(pair, query));
}

// Splits a paragraph into pieces, flagging the words that belong to the query.
export function highlightParts(paragraph: string, query: string): { text: string; hit: boolean }[] {
  const words = searchWords(query);
  return paragraph
    .split(/(\s+)/)
    .filter(Boolean)
    .map((token) => {
      const norm = normalizeForSearch(token);
      return { text: token, hit: norm !== "" && words.some((w) => norm.includes(w) || (norm.length >= 2 && w.includes(norm))) };
    });
}
