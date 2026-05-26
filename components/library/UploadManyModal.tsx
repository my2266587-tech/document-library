"use client";

import { useState } from "react";
import Modal from "./Modal";
import { Files, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { useToast } from "./Toast";
import { parseApiResponse, extOf } from "@/lib/utils";
import { uploadFileWithProgress } from "@/lib/upload-client";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { FileTypeIcon } from "@/lib/file-icons";

type FileStatus = "queued" | "uploading" | "saving" | "done" | "failed";

type FileItem = {
  file: File;
  status: FileStatus;
  percent: number;
  error?: string;
};

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
  const toast = useToast();

  function reset() {
    setItems([]);
    setNotes("");
    setCategoryId(defaultCategoryId ?? "");
    setFinished(false);
  }

  function closeAll() {
    if (busy) return;
    reset();
    onClose();
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    setItems(
      list.map((f) => ({ file: f, status: "queued", percent: 0 }))
    );
    setFinished(false);
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

    setBusy(true);
    setFinished(false);

    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < items.length; i++) {
      const ok = await uploadOne(i, items[i].file);
      if (ok) okCount++;
      else failCount++;
    }

    setBusy(false);
    setFinished(true);
    onUploaded();

    if (failCount === 0) {
      toast.show("success", `הועלו ${okCount} קבצים בהצלחה`);
    } else if (okCount === 0) {
      toast.show("error", `כל הקבצים נכשלו (${failCount})`);
    } else {
      toast.show("info", `הועלו ${okCount}, נכשלו ${failCount}`);
    }
  }

  const totalPercent = items.length
    ? Math.round(items.reduce((s, it) => s + it.percent, 0) / items.length)
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
                <FileRow key={i} item={it} />
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
              disabled={busy || items.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-60"
            >
              <Files className="size-4" />
              {busy
                ? `מעלה… ${totalPercent}%`
                : `העלה ${items.length || ""} קבצים`}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function FileRow({ item }: { item: FileItem }) {
  const { file, status, percent, error } = item;
  return (
    <li className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-surface border border-border">
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
  }
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
