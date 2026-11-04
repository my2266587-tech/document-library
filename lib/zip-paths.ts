// Folder/file names for the library ZIP download: one folder per category.

export const NO_CATEGORY_FOLDER = "ללא קטגוריה";
export const FAILED_LIST_NAME = "קבצים שלא הורדו.txt";

export type ZipSource = {
  id: string;
  original_file_name: string;
  title: string;
  file_type: string | null;
  category_name: string | null;
};

// Characters Windows/macOS don't allow in names, control characters, and
// trailing dots/spaces (Windows drops them).
export function safeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned.slice(0, 150);
}

function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

// Returns "folder/file" for every document, unique (case-insensitive, since
// Windows folders are), in the order given.
export function buildZipPaths(docs: ZipSource[]): Map<string, string> {
  const used = new Set<string>();
  const paths = new Map<string, string>();
  for (const doc of docs) {
    const folder = safeName(doc.category_name ?? "") || NO_CATEGORY_FOLDER;
    let file = safeName(doc.original_file_name) || safeName(doc.title) || doc.id;
    if (!splitExt(file)[1] && doc.file_type) file = `${file}.${doc.file_type}`;
    const [base, ext] = splitExt(file);
    let candidate = `${folder}/${file}`;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) {
      candidate = `${folder}/${base} (${n})${ext}`;
    }
    used.add(candidate.toLowerCase());
    paths.set(doc.id, candidate);
  }
  return paths;
}
