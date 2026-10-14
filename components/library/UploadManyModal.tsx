"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import {
  Files,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Clock,
  SkipForward,
} from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { useToast } from "./Toast";
import { parseApiResponse, extOf } from "@/lib/utils";
import { uploadFileWithProgress } from "@/lib/upload-client";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { FileTypeIcon } from "@/lib/file-icons";
import { checkDuplicates, type DuplicateMatch } from "@/lib/duplicates";
import DuplicateMatches from "./DuplicateMatches";

type FileStatus =
  | "queued"
  | "uploading"
  | "saving"
  | "done"
  | "failed"
  | "skipped";

type FileItem = {
  file: File;
  status: FileStatus;
  percent: number;
  error?: string;
  /** Existing library documents that look like this file. */
  duplicates?: DuplicateMatch[];
  /** The same file was picked more than once in this batch. */
  repeatInBatch?: boolean;
  /** Don't upload this file (user's choice; defaults to true for duplicates). */
  skip: boolean;
};

function isDuplicate(it: FileItem): boolean {
  return !!it.repeatInBatch || (it.duplicates?.length ?? 0) > 0;
}

type Props = {
  open: boolean;
  onClose: () => void;
  categories: DocumentCategory[];
  defaultCategoryId?: string;
  onUploaded: () => void;
};

export default function UploadManyModal({
  open,
  onClose,
  categories,
  defaultCategoryId,
  onUploaded,
}: Props) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const checkSeq = useRef(0);
  const toast = useToast();

  function reset() {
    setItems([]);
    setNotes("");
    setCategoryId(defaultCategoryId ?? "");
    setFinished(false);
    checkSeq.current++;
    setChecking(false);
    setCheckFailed(false);
  }

  function closeAll() {
    if (busy) return;
    reset();
    onClose();
  }

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    const seen = new Set<string>();
    setItems(
      list.map((f) => {
        const key = `${f.name}\u0000${f.size}`;
        const repeatInBatch = seen.has(key);
        seen.add(key);
        return {
          file: f,
          status: "queued",
          percent: 0,
          repeatInBatch,
          skip: repeatInBatch,
        };
      })
    );
    setFinished(false);
    setCheckFailed(false);

    const seq = ++checkSeq.current;
    if (list.length === 0) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const results = await checkDuplicates(list);
      if (seq !== checkSeq.current) return;
      setItems((prev) =>
        prev.map((it, i) => {
          const duplicates = results[i] ?? [];
          return {
            ...it,
            duplicates,
            skip: it.skip || duplicates.length > 0,
          };
        })
      );
    } catch (err) {
      if (seq !== checkSeq.current) return;
      console.error("[UploadManyModal] duplicate check failed", err);
      setCheckFailed(true);
    } finally {
      if (seq === checkSeq.current) setChecking(false);
    }
  }

  function setSkip(idx: number, skip: boolean) {
    updateItem(idx, { skip });
  }

  function setSkipAllDuplicates(skip: boolean) {
    setItems((prev) =>
      prev.map((it) => (isDuplicate(it) ? { ...it, skip } : it))
    );
  }

  function updateItem(idx: number, patch: Partial<FileItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  async function uploadOne(idx: number, file: File): Promise<boolean> {
    try {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        updateItem(idx, {
          status: "failed",
          error: `גדול מ-${MAX_FILE_SIZE_MB}MB`,
        });
        return false;
      }

      updateItem(idx, { status: "uploading", percent: 0 });

      const signedRes = await fetch("/api/documents/signed-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      });
      const signed = await parseApiResponse<{
        path: string;
        signedUrl: string;
      }>(signedRes);

      await uploadFileWithProgress(signed.signedUrl, file, (p) =>
        updateItem(idx, { percent: p.percent })
      );

      updateItem(idx, { status: "saving", percent: 100 });

      const recRes = await fetch("/api/documents/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: signed.path,
          original_file_name: file.name,
          file_type: extOf(file.name) || file.type?.split("/").pop() || null,
          file_size: file.size,
          category_id: categoryId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      await parseApiResponse(recRes);

      updateItem(idx, { status: "done", percent: 100 });
      return true;
    } catch (err) {
      console.error("[UploadManyModal] item error", err);
      updateItem(idx, {
        status: "failed",
        error: err instanceof Error ? err.message : "שגיאה",
      });
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.show("error", "יש לבחור לפחות קובץ אחד");
      return;
    }
    if (checking) {
      toast.show("info", "בודק אילו קבצים כבר קיימים — רגע אחד");
      return;
    }
    if (toUploadCount === 0) {
      toast.show("info", "כל הקבצים סומנו לדילוג — לא הועלה דבר");
      return;
    }

    setBusy(true);
    setFinished(false);

    let okCount = 0;
    let failCount = 0;
    let skipCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].skip) {
        updateItem(i, { status: "skipped" });
        skipCount++;
        continue;
      }
      const ok = await uploadOne(i, items[i].file);
      if (ok) okCount++;
      else failCount++;
    }

    setBusy(false);
    setFinished(true);
    onUploaded();

    const skipped = skipCount ? ` · דולגו ${skipCount} שכבר קיימים` : "";
    if (failCount === 0) {
      toast.show("success", `הועלו ${okCount} קבצים בהצלחה${skipped}`);
    } else if (okCount === 0) {
      toast.show("error", `כל הקבצים נכשלו (${failCount})${skipped}`);
    } else {
      toast.show("info", `הועלו ${okCount}, נכשלו ${failCount}${skipped}`);
    }
  }

  const dupCount = items.filter(isDuplicate).length;
  const dupSkipped = items.filter((it) => isDuplicate(it) && it.skip).length;
  const toUploadCount = items.filter((it) => !it.skip).length;
  const canChoose = !busy && !finished;

  const active = items.filter((it) => !it.skip);
  const totalPercent = active.length
    ? Math.round(active.reduce((s, it) => s + it.percent, 0) / active.length)
    : 0;

  return (
    <Modal open={open} onClose={closeAll} title="העלאה מרובה" widthClass="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="קבצים" required>
          <input
            type="file"
            multiple
            onChange={(e) => onPickFiles(e.target.files)}
            className="block w-full text-sm file:me-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-accent file:text-white file:font-medium hover:file:bg-accent-hover cursor-pointer"
            required
            disabled={busy}
          />
          <p className="text-xs text-muted mt-1.5">
            {items.length > 0
              ? `נבחרו ${items.length} קבצים · מגבלה לכל קובץ: ${MAX_FILE_SIZE_MB}MB`
              : `מגבלה לכל קובץ: ${MAX_FILE_SIZE_MB}MB`}
          </p>
        </Field>

        <Field label="קטגוריה (משותפת לכל הקבצים)">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
            disabled={busy}
          >
            <option value="">— ללא קטגוריה —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="הערות כלליות (אופציונלי)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            disabled={busy}
          />
        </Field>

        {/* Duplicate check summary */}
        {checking && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            בודק אילו קבצים כבר קיימים במערכת…
          </p>
        )}
        {checkFailed && (
          <p className="text-xs text-muted">
            לא ניתן היה לבדוק אילו קבצים כבר קיימים. אפשר להעלות בכל זאת.
          </p>
        )}
        {!checking && dupCount > 0 && (
          <div
            role="alert"
            className="space-y-2 p-3 rounded-xl bg-accent-soft border border-border-strong"
          >
            <p className="flex items-start gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-accent" />
              {dupCount === 1
                ? "קובץ אחד כבר קיים במערכת"
                : `${dupCount} קבצים כבר קיימים במערכת`}
              {` (${dupSkipped} מסומנים לדילוג)`}
            </p>
            {canChoose && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSkipAllDuplicates(true)}
                  className="min-h-11 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground hover:bg-background transition"
                >
                  לדלג על כולם
                </button>
                <button
                  type="button"
                  onClick={() => setSkipAllDuplicates(false)}
                  className="min-h-11 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground hover:bg-background transition"
                >
                  להעלות את כולם שוב
                </button>
              </div>
            )}
          </div>
        )}

        {/* Files list */}
        {items.length > 0 && (
          <div className="rounded-xl border border-border bg-background p-2 max-h-72 overflow-y-auto">
            {busy && (
              <div className="px-2 pt-1 pb-2 mb-2 border-b border-border">
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>סך הכל</span>
                  <span className="font-mono">{totalPercent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-150"
                    style={{ width: `${totalPercent}%` }}
                  />
                </div>
              </div>
            )}
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <FileRow
                  key={i}
                  item={it}
                  onSkipChange={canChoose ? (skip) => setSkip(i, skip) : undefined}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeAll}
            className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent-soft transition disabled:opacity-60"
            disabled={busy}
          >
            {finished ? "סגירה" : "ביטול"}
          </button>
          {!finished && (
            <button
              type="submit"
              disabled={busy || checking || toUploadCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-60"
            >
              <Files className="size-4" />
              {busy
                ? `מעלה… ${totalPercent}%`
                : `העלה ${toUploadCount || ""} קבצים`}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function FileRow({
  item,
  onSkipChange,
}: {
  item: FileItem;
  onSkipChange?: (skip: boolean) => void;
}) {
  const { file, percent, error, duplicates, repeatInBatch, skip } = item;
  // Before the run, a skipped row shows as "skipped" so the choice is visible.
  const status: FileStatus =
    skip && item.status === "queued" ? "skipped" : item.status;
  const dup = isDuplicate(item);
  return (
    <li
      className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg border ${
        dup ? "bg-accent-soft border-border-strong" : "bg-surface border-border"
      }`}
    >
      <FileTypeIcon fileType={extOf(file.name)} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className="text-sm font-medium text-foreground truncate"
            title={file.name}
          >
            {file.name}
          </span>
          <StatusBadge status={status} percent={percent} />
        </div>
        {(status === "uploading" || status === "saving") && (
          <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {status === "failed" && error && (
          <p className="text-xs text-[var(--danger)] truncate" title={error}>
            {error}
          </p>
        )}
        {dup && (
          <div className="mt-1 space-y-1.5">
            {repeatInBatch && (
              <p className="text-xs text-muted">הקובץ נבחר פעמיים ברשימה הזו</p>
            )}
            {duplicates && duplicates.length > 0 && (
              <>
                <p className="text-xs font-medium text-foreground">
                  כבר קיים במערכת:
                </p>
                <DuplicateMatches matches={duplicates} max={2} />
              </>
            )}
            {onSkipChange && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <ChoiceButton active={skip} onClick={() => onSkipChange(true)}>
                  לא להעלות
                </ChoiceButton>
                <ChoiceButton active={!skip} onClick={() => onSkipChange(false)}>
                  להעלות שוב
                </ChoiceButton>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function StatusBadge({
  status,
  percent,
}: {
  status: FileStatus;
  percent: number;
}) {
  switch (status) {
    case "queued":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <Clock className="size-3.5" />
          ממתין
        </span>
      );
    case "uploading":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-accent font-mono">
          <Loader2 className="size-3.5 animate-spin" />
          {percent}%
        </span>
      );
    case "saving":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-accent">
          <Loader2 className="size-3.5 animate-spin" />
          שומר…
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
          <CheckCircle2 className="size-3.5" />
          הועלה
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--danger)]">
          <AlertCircle className="size-3.5" />
          נכשל
        </span>
      );
    case "skipped":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <SkipForward className="size-3.5" />
          דילוג
        </span>
      );
  }
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
        active
          ? "bg-accent text-white border-accent"
          : "bg-surface text-foreground border-border hover:bg-background"
      }`}
    >
      {children}
    </button>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition disabled:opacity-60";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1">
        {label}
        {required && <span className="text-[var(--danger)] ms-1">*</span>}
      </span>
      {children}
    </label>
  );
}
