// Matching a typed sentence against text read from documents (OCR / PDF text).
// Shared by the search API, the indexing code and the results UI (for highlighting).

// Images are read on demand by the content-index API (fast enough per request).
export const IMAGE_CONTENT_TYPES = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];
// PDFs can take minutes (scanned pages need OCR), so only the scheduled
// indexing job (scripts/index-content.ts) reads them.
export const ALL_CONTENT_TYPES = [...IMAGE_CONTENT_TYPES, "pdf"];

// Shown until supabase/add-content-search.sql has been run (Postgres 42703 = undefined column).
export function contentDbErrorMessage(error: { code?: string; message: string }): string {
  return error.code === "42703"
    ? "חסרה עמודת תוכן במסד הנתונים. יש להריץ את הקובץ supabase/add-content-search.sql ב-Supabase."
    : `Database error: ${error.message}`;
}

// Niqqud and cantillation marks (the maqaf is kept: it separates words).
export function stripNiqqud(text: string): string {
  return text.replace(/[֑-ׇֽֿׁׂׅׄ]/g, "");
}

// Drop niqqud, treat punctuation (incl. maqaf) as spaces, collapse whitespace.
export function normalizeForSearch(text: string): string {
  return stripNiqqud(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

// Letters/digits only, so they are safe inside an ILIKE pattern. Stored text
// has its niqqud stripped, so every matching document contains every word.
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
  // The sentence may run over two lines that were kept apart.
  return paragraphs
    .slice(1)
    .map((p, i) => `${paragraphs[i]} ${p}`)
    .filter((pair) => paragraphMatches(pair, query));
}

function tokenHits(token: string, words: string[]): boolean {
  const norm = normalizeForSearch(token);
  return norm !== "" && words.some((w) => norm.includes(w) || (norm.length >= 2 && w.includes(norm)));
}

const EXCERPT_MAX_WORDS = 50;
const EXCERPT_CONTEXT_WORDS = 18;

// Long paragraphs (whole PDF pages, OCR blocks) are cut down to the words
// around the match.
export function excerptAround(paragraph: string, query: string): string {
  const tokens = paragraph.split(/\s+/).filter(Boolean);
  if (tokens.length <= EXCERPT_MAX_WORDS) return paragraph;
  const words = searchWords(query);
  const first = words.length > 0 ? tokens.findIndex((t) => tokenHits(t, [words[0]])) : -1;
  const anchor = first >= 0 ? first : Math.max(0, tokens.findIndex((t) => tokenHits(t, words)));
  const start = Math.max(0, anchor - EXCERPT_CONTEXT_WORDS);
  const end = Math.min(tokens.length, anchor + words.length + EXCERPT_CONTEXT_WORDS);
  return `${start > 0 ? "… " : ""}${tokens.slice(start, end).join(" ")}${end < tokens.length ? " …" : ""}`;
}

// Splits a paragraph into pieces, flagging the words that belong to the query.
export function highlightParts(paragraph: string, query: string): { text: string; hit: boolean }[] {
  const words = searchWords(query);
  return paragraph
    .split(/(\s+)/)
    .filter(Boolean)
    .map((token) => ({ text: token, hit: tokenHits(token, words) }));
}
