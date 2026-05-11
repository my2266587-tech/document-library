"use client";

import { useState } from "react";
import Modal from "./Modal";
import { Files, CheckCircle2, AlertCircle } from "lucide-react";
import type { DocumentCategory, UploadResult } from "@/lib/types";
import { useToast } from "./Toast";

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
  const [files, setFiles] = useState<File[]>([]);
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const toast = useToast();

  function reset() {
    setFiles([]);
    setNotes("");
    setCategoryId(defaultCategoryId ?? "");
    setResults(null);
  }

  function closeAll() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      toast.show("error", "יש לבחור לפחות קובץ אחד");
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      if (categoryId) form.append("category_id", categoryId);
      if (notes.trim()) form.append("notes", notes.trim());

      const res = await fetch("/api/documents/upload-many", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה בהעלאה");

      const items: UploadResult[] = data.results ?? [];
      setResults(items);

      const okCount = items.filter((x) => x.ok).length;
      const failCount = items.length - okCount;
      if (failCount === 0) {
        toast.show("success", `הועלו ${okCount} קבצים בהצלחה`);
      } else if (okCount === 0) {
        toast.show("error", `כל הקבצים נכשלו (${failCount})`);
      } else {
        toast.show("info", `הועלו ${okCount}, נכשלו ${failCount}`);
      }
      onUploaded();
    } catch (err) {
      toast.show("error", err instanceof Error ? err.message : "שגיאה בהעלאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={closeAll} title="העלאה מרובה" widthClass="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="קבצים" required>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm file:me-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-accent file:text-white file:font-medium hover:file:bg-accent-hover cursor-pointer"
            required
          />
          {files.length > 0 && (
            <p className="text-xs text-muted mt-1.5">
              נבחרו {files.length} קבצים
            </p>
          )}
        </Field>

        <Field label="קטגוריה (משותפת לכל הקבצים)">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
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
          />
        </Field>

        {results && (
          <div className="rounded-xl border border-border bg-background p-3 max-h-56 overflow-y-auto">
            <h4 className="text-sm font-semibold mb-2">תוצאות העלאה</h4>
            <ul className="space-y-1.5">
              {results.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {r.ok ? (
                    <CheckCircle2 className="size-4 text-[var(--success)] shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 text-[var(--danger)] shrink-0" />
                  )}
                  <span className="truncate flex-1" title={r.fileName}>
                    {r.fileName}
                  </span>
                  {!r.ok && (
                    <span className="text-xs text-[var(--danger)] truncate" title={r.error}>
                      {r.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeAll}
            className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent-soft transition"
            disabled={busy}
          >
            {results ? "סגירה" : "ביטול"}
          </button>
          {!results && (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-60"
            >
              <Files className="size-4" />
              {busy ? "מעלה…" : `העלה ${files.length || ""} קבצים`}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition";

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
