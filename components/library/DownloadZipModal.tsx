"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FolderArchive, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { formatBytes } from "@/lib/utils";
import { FAILED_LIST_NAME, safeName } from "@/lib/zip-paths";
import {
  buildLibraryZip,
  canSaveToDisk,
  fetchZipEntries,
  pickZipFile,
  saveBlob,
  type ZipEntry,
  type ZipProgress,
  type ZipResult,
} from "@/lib/zip-download";

// Above this, a browser that can't write straight to disk may run out of memory.
const IN_MEMORY_WARN_BYTES = 300 * 1024 * 1024;

type Scope = "all" | "category";

type Phase =
  | { kind: "idle" }
  | { kind: "running"; progress: ZipProgress | null }
  | { kind: "done"; result: ZipResult }
  | { kind: "error"; message: string };

type EntriesState = { key: string; entries: ZipEntry[] | null; error: string | null };

export default function DownloadZipModal({
  open,
  onClose,
  selectedCategory,
}: {
  open: boolean;
  onClose: () => void;
  selectedCategory: { id: string; name: string } | null;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [loaded, setLoaded] = useState<EntriesState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const effectiveScope: Scope = selectedCategory ? scope : "all";
  const categoryId = effectiveScope === "category" && selectedCategory ? selectedCategory.id : "all";
  const entriesKey = `${open}:${categoryId}`;
  const current = loaded?.key === entriesKey ? loaded : null;
  const entries = current?.entries ?? null;
  const totalSize = entries?.reduce((sum, e) => sum + (e.size ?? 0), 0) ?? 0;
  const running = phase.kind === "running";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchZipEntries(categoryId)
      .then((list) => !cancelled && setLoaded({ key: `${open}:${categoryId}`, entries: list, error: null }))
      .catch(
        (err) =>
          !cancelled &&
          setLoaded({
            key: `${open}:${categoryId}`,
            entries: null,
            error: err instanceof Error ? err.message : "שגיאה בטעינת רשימת הקבצים",
          })
      );
    return () => {
      cancelled = true;
    };
  }, [open, categoryId]);

  // Leaving the page stops the download; ask the browser to warn first.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  function close() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase({ kind: "idle" });
    onClose();
  }

  async function start() {
    if (!entries || entries.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const base = effectiveScope === "category" && selectedCategory ? safeName(selectedCategory.name) : "ספריית מסמכים";
    const fileName = `${base} ${date}.zip`;

    let output: WritableStream<Uint8Array> | null = null;
    if (canSaveToDisk()) {
      try {
        output = await pickZipFile(fileName);
        if (!output) return; // the user closed the save dialog
      } catch {
        output = null; // picker failed: build in memory instead
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "running", progress: null });
    try {
      const { result, blob } = await buildLibraryZip(
        entries,
        output,
        (p) => setPhase({ kind: "running", progress: p }),
        controller.signal
      );
      // A ZIP holding only the list of failed files isn't worth saving.
      if (blob && result.files > 0) saveBlob(blob, fileName);
      setPhase({ kind: "done", result });
    } catch (err) {
      if (controller.signal.aborted) return;
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "שגיאה לא ידועה",
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  return (
    <Modal open={open} title="הורדת הספרייה כקובץ ZIP" onClose={close}>
      <div className="space-y-4 text-sm">
        {phase.kind === "idle" && (
          <>
            <p className="text-muted">
              כל קטגוריה תהיה תיקייה נפרדת בתוך הקובץ, עם המסמכים בשמם המקורי.
            </p>

            {selectedCategory && (
              <fieldset className="space-y-2">
                <legend className="sr-only">מה להוריד</legend>
                <ScopeOption checked={scope === "all"} onChange={() => setScope("all")} label="כל הספרייה" />
                <ScopeOption
                  checked={scope === "category"}
                  onChange={() => setScope("category")}
                  label={`רק הקטגוריה "${selectedCategory.name}"`}
                />
              </fieldset>
            )}

            <div className="rounded-xl border border-border bg-background px-4 py-3">
              {current?.error ? (
                <p className="text-danger flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  {current.error}
                </p>
              ) : entries ? (
                <p>
                  <span className="font-semibold">{entries.length.toLocaleString("he-IL")}</span> קבצים ·{" "}
                  <span className="font-semibold">{formatBytes(totalSize)}</span>
                </p>
              ) : (
                <p className="text-muted flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  סופרת את הקבצים…
                </p>
              )}
            </div>

            {entries && !canSaveToDisk() && totalSize > IN_MEMORY_WARN_BYTES && (
              <p className="text-muted">
                בדפדפן הזה הקובץ נבנה בזיכרון עד שההורדה מתחילה. לקובץ גדול כזה עדיף כרום או אדג׳ במחשב, או להוריד
                קטגוריה אחת בכל פעם.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={close}
                className="min-h-11 px-4 rounded-xl border border-border text-foreground hover:bg-accent-soft transition"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={start}
                disabled={!entries || entries.length === 0}
                className="min-h-11 inline-flex items-center gap-2 px-4 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderArchive className="size-4" />
                הורדה
              </button>
            </div>
          </>
        )}

        {phase.kind === "running" && (
          <>
            <ProgressView progress={phase.progress} total={entries?.length ?? 0} />
            <p className="text-muted">אפשר להמשיך לעבוד בחלון אחר. אין לסגור את הדף עד שההורדה מסתיימת.</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="min-h-11 px-4 rounded-xl border border-border text-foreground hover:text-danger hover:border-danger/40 transition"
              >
                עצירת ההורדה
              </button>
            </div>
          </>
        )}

        {phase.kind === "done" && (
          <>
            {phase.result.files > 0 ? (
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-5 text-accent-hover shrink-0" />
                הקובץ נשמר. {phase.result.files.toLocaleString("he-IL")} קבצים בתוכו.
              </p>
            ) : (
              <p className="flex items-center gap-2 font-medium text-danger">
                <AlertCircle className="size-5 shrink-0" />
                אף קובץ לא הורד. ייתכן שסינון הרשת חוסם את ההורדה.
              </p>
            )}
            {phase.result.failed.length > 0 && phase.result.files > 0 && (
              <p className="text-muted">
                {phase.result.failed.length.toLocaleString("he-IL")} קבצים לא הורדו (ייתכן שסינון הרשת חסם אותם).
                הרשימה שלהם נמצאת בקובץ &quot;{FAILED_LIST_NAME}&quot; בתוך ה-ZIP.
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="min-h-11 px-4 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition"
              >
                סגירה
              </button>
            </div>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <p className="flex items-center gap-2 text-danger">
              <AlertCircle className="size-5 shrink-0" />
              ההורדה נכשלה: {phase.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="min-h-11 px-4 rounded-xl border border-border text-foreground hover:bg-accent-soft transition"
              >
                סגירה
              </button>
              <button
                type="button"
                onClick={() => setPhase({ kind: "idle" })}
                className="min-h-11 px-4 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition"
              >
                נסי שוב
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ScopeOption({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 min-h-11 px-3 rounded-xl border border-border cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft/50 transition">
      <input type="radio" name="zip-scope" checked={checked} onChange={onChange} className="accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function ProgressView({ progress, total }: { progress: ZipProgress | null; total: number }) {
  const done = progress?.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin" />
          מורידה ואורזת…
        </span>
        <span className="text-muted tabular-nums">
          {done.toLocaleString("he-IL")} מתוך {total.toLocaleString("he-IL")}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-accent-soft overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-muted text-xs tabular-nums">
        {formatBytes(progress?.bytes ?? 0)}
        {progress && progress.failed > 0 && ` · ${progress.failed.toLocaleString("he-IL")} לא הורדו`}
      </p>
    </div>
  );
}
