// Builds the library ZIP in the browser: downloads each file with a signed
// link and streams it into the ZIP. Files that fail (blocked by a network
// filter, swapped for a placeholder, timed out) are left out and listed in a
// text file inside the ZIP instead.
import { makeZip } from "client-zip";
import { parseApiResponse } from "@/lib/utils";
import { FAILED_LIST_NAME } from "@/lib/zip-paths";

export type ZipEntry = { id: string; path: string; size: number | null };

export type ZipProgress = {
  done: number;
  total: number;
  bytes: number;
  failed: number;
};

export type ZipResult = { files: number; failed: string[] };

const PARALLEL_DOWNLOADS = 4;
const URL_BATCH = 50;
const FILE_TIMEOUT_MS = 3 * 60_000;

// Chrome/Edge on a computer can write the ZIP straight to disk; other
// browsers keep it in memory until the download starts.
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

function getSaveFilePicker(): SaveFilePicker | null {
  const w = window as unknown as { showSaveFilePicker?: SaveFilePicker };
  return typeof w.showSaveFilePicker === "function" ? w.showSaveFilePicker.bind(window) : null;
}

export function canSaveToDisk(): boolean {
  return typeof window !== "undefined" && getSaveFilePicker() !== null;
}

// Must be called straight from the click (the browser requires it).
// Returns null when the user cancels the save dialog.
export async function pickZipFile(suggestedName: string): Promise<WritableStream<Uint8Array> | null> {
  const picker = getSaveFilePicker();
  if (!picker) throw new Error("save picker unavailable");
  try {
    const handle = await picker({
      suggestedName,
      types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }],
    });
    return await handle.createWritable();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

export async function fetchZipEntries(categoryId: string): Promise<ZipEntry[]> {
  const params = categoryId !== "all" ? `?category_id=${encodeURIComponent(categoryId)}` : "";
  const res = await fetch(`/api/documents/export${params}`, { cache: "no-store" });
  const data = await parseApiResponse<{ entries?: ZipEntry[] }>(res);
  return data.entries ?? [];
}

async function signedUrls(ids: string[], signal: AbortSignal): Promise<Record<string, string>> {
  const res = await fetch("/api/documents/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    signal,
  });
  const data = await parseApiResponse<{ urls?: Record<string, string> }>(res);
  return data.urls ?? {};
}

async function downloadOne(url: string, expectedSize: number | null, signal: AbortSignal): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(FILE_TIMEOUT_MS);
  const res = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A filtered network may answer with a placeholder instead of the file.
  if (expectedSize != null && bytes.byteLength !== expectedSize) throw new Error("size mismatch");
  return bytes;
}

export async function buildLibraryZip(
  entries: ZipEntry[],
  output: WritableStream<Uint8Array> | null,
  onProgress: (p: ZipProgress) => void,
  signal: AbortSignal
): Promise<{ result: ZipResult; blob: Blob | null }> {
  const failed: string[] = [];
  const progress: ZipProgress = { done: 0, total: entries.length, bytes: 0, failed: 0 };
  // Links expire, so they are requested a batch at a time as the ZIP grows.
  // Downloads running in parallel share the request for their batch.
  const batches = new Map<number, Promise<Record<string, string>>>();

  async function urlFor(index: number): Promise<string | undefined> {
    const b = Math.floor(index / URL_BATCH);
    let batch = batches.get(b);
    if (!batch) {
      const ids = entries.slice(b * URL_BATCH, (b + 1) * URL_BATCH).map((e) => e.id);
      batch = signedUrls(ids, signal);
      batches.set(b, batch);
      batch.catch(() => batches.delete(b)); // retry on the next file
    }
    return (await batch)[entries[index].id];
  }

  async function fetchEntry(index: number): Promise<Uint8Array | null> {
    const entry = entries[index];
    try {
      const url = await urlFor(index);
      if (!url) throw new Error("no link");
      return await downloadOne(url, entry.size, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      return null;
    }
  }

  async function* files() {
    // Keep a few downloads running ahead while the ZIP is written in order.
    const pending: Promise<Uint8Array | null>[] = [];
    let next = 0;
    const fill = () => {
      while (pending.length < PARALLEL_DOWNLOADS && next < entries.length) {
        const p = fetchEntry(next++);
        p.catch(() => {}); // on cancel, downloads still queued reject unobserved
        pending.push(p);
      }
    };
    fill();
    for (let i = 0; i < entries.length; i++) {
      const bytes = await pending.shift()!;
      fill();
      if (bytes) {
        progress.bytes += bytes.byteLength;
        yield { name: entries[i].path, input: bytes };
      } else {
        failed.push(entries[i].path);
        progress.failed++;
      }
      progress.done++;
      onProgress({ ...progress });
    }
    if (failed.length > 0) {
      const text =
        "הקבצים האלה לא הורדו (ייתכן שסינון הרשת חסם אותם). אפשר להוריד אותם אחד-אחד מהספרייה.\r\n\r\n" +
        failed.join("\r\n") +
        "\r\n";
      // BOM so Windows Notepad shows the Hebrew correctly.
      yield { name: FAILED_LIST_NAME, input: "﻿" + text };
    }
  }

  const zip = makeZip(files());
  const result = (): ZipResult => ({ files: progress.done - progress.failed, failed });
  if (output) {
    await zip.pipeTo(output, { signal });
    return { result: result(), blob: null };
  }
  const blob = await new Response(zip).blob();
  if (signal.aborted) throw new DOMException("aborted", "AbortError");
  return { result: result(), blob: new Blob([blob], { type: "application/zip" }) };
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
