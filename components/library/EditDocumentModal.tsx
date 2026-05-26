"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { Save } from "lucide-react";
import type { DocumentCategory, DocumentWithCategory } from "@/lib/types";
import { useToast } from "./Toast";
import { parseApiResponse } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  doc: DocumentWithCategory | null;
  categories: DocumentCategory[];
  onSaved: () => void;
};

export default function EditDocumentModal({
  open,
  onClose,
  doc,
  categories,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (doc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(doc.title);
      setCategoryId(doc.category_id ?? "");
      setNotes(doc.notes ?? "");
    }
  }, [doc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    if (!title.trim()) {
      toast.show("error", "שם המסמך הוא חובה");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category_id: categoryId || null,
          notes: notes.trim() || null,
        }),
      });
      await parseApiResponse(res);

      toast.show("success", "המסמך עודכן");
      onSaved();
      onClose();
    } catch (err) {
      console.error("[EditDocumentModal] error", err);
      toast.show("error", err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="עריכת מסמך">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="שם מסמך" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <Field label="קטגוריה">
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

        <Field label="הערות">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent-soft transition"
            disabled={busy}
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-60"
          >
            <Save className="size-4" />
            {busy ? "שומר…" : "שמירה"}
          </button>
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
