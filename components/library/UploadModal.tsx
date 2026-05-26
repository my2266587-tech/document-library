"use client";

import { useState } from "react";
import Modal from "./Modal";
import { Upload } from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { useToast } from "./Toast";
import { parseApiResponse, extOf, formatBytes } from "@/lib/utils";
import { uploadFileWithProgress } from "@/lib/upload-client";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { FileTypeIcon } from "@/lib/file-icons";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: DocumentCategory[];
  defaultCategoryId?: string;
  onUploaded: () => void;
};

export default function UploadModal({
  open,
  onClose,
  categories,
  defaultCategoryId,
  onUploaded,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const toast = useToast();

  function reset() {
    setFile(null);
    setTitle("");
    setNotes("");
    setCategoryId(defaultCategoryId ?? "");
    setProgress(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.show("error", "יש לבחור קובץ");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.show(
        "error",
        `הקובץ גדול מדי (${Math.round(file.size / 1024 / 1024)}MB). המגבלה היא ${MAX_FILE_SIZE_MB}MB.`
      );
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      // 1. Ask the server for a signed upload URL
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

      // 2. PUT the file directly to Supabase Storage with progress
      await uploadFileWithProgress(signed.signedUrl, file, (p) =>
        setProgress(p.percent)
      );

      // 3. Record metadata in the DB
      const recRes = await fetch("/api/documents/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: signed.path,
          original_file_name: file.name,
          file_type: extOf(file.name) || file.type?.split("/").pop() || null,
          file_size: file.size,
          title: title.trim() || undefined,
          category_id: categoryId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      await parseApiResponse(recRes);

      toast.show("success", "המסמך הועלה בהצלחה");
      reset();
      onUploaded();
      onClose();
    } catch (err) {
      console.error("[UploadModal] error", err);
      toast.show(
        "error",
        err instanceof Error
          ? err.message
          : "העלאת המסמך נכשלה. ייתכן שיש בעיית רשת או שרת."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="העלאת מסמך">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="קובץ" required>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:me-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-accent file:text-white file:font-medium hover:file:bg-accent-hover cursor-pointer"
            required
            disabled={busy}
          />
          <p className="text-xs text-muted mt-1.5">
            גודל מקסימלי לקובץ: {MAX_FILE_SIZE_MB}MB
          </p>
        </Field>

        {/* Selected file preview */}
        {file && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border">
            <FileTypeIcon fileType={extOf(file.name)} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {file.name}
              </p>
              <p className="text-xs text-muted">{formatBytes(file.size)}</p>
            </div>
          </div>
        )}

        <Field label="שם מסמך">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="אם ריק — ייקח משם הקובץ"
            className={inputClass}
            disabled={busy}
          />
        </Field>

        <Field label="קטגוריה">
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

        <Field label="הערות">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
            disabled={busy}
          />
        </Field>

        {/* Progress bar */}
        {busy && progress !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>מעלה…</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-background overflow-hidden border border-border">
              <div
                className="h-full bg-accent transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent-soft transition disabled:opacity-60"
            disabled={busy}
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-60"
          >
            <Upload className="size-4" />
            {busy ? "מעלה…" : "העלה"}
          </button>
        </div>
      </form>
    </Modal>
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
