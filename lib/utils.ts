export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

export function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  return name.slice(0, idx);
}

export function sanitizeFileName(name: string): string {
  const replaced = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
  return replaced || "file";
}

export function buildStoragePath(originalName: string): string {
  const safe = sanitizeFileName(originalName);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = crypto.randomUUID();
  return `${yyyy}/${mm}/${rand}_${safe}`;
}

/**
 * Safely read an API response. Always returns JSON-shaped data,
 * never throws on parse, and only throws on !response.ok with a clear
 * Hebrew message extracted from the server (or a fallback).
 */
export async function parseApiResponse<T = unknown>(
  response: Response
): Promise<T> {
  const text = await response.text().catch(() => "");
  let data: { error?: string; [k: string]: unknown } | null = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "שגיאת שרת לא מזוהה" };
  }

  if (!response.ok) {
    let message = data?.error;
    if (!message) {
      const lower = text.toLowerCase();
      if (
        response.status === 413 ||
        lower.includes("request entity too large") ||
        lower.includes("payload too large")
      ) {
        message = "הקובץ גדול מדי. נסי להעלות קובץ קטן יותר.";
      }
    }
    throw new Error(message || "הבקשה נכשלה");
  }

  return (data ?? ({} as T)) as T;
}
