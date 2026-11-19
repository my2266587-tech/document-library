"use client";

import { useState } from "react";
import Modal from "./Modal";
import { FolderPlus, Trash2, Lock } from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";
import { parseApiResponse } from "@/lib/utils";
import { PROTECTED_CATEGORY_NAMES } from "@/lib/constants";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: DocumentCategory[];
  onChanged: () => void;
};

export default function ManageCategoriesModal({
  open,
  onClose,
  categories,
  onChanged,
}: Props) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.show("error", "שם קטגוריה הוא שדה חובה");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/document-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await parseApiResponse(res);
      toast.show("success", `הקטגוריה "${name}" נוספה`);
      setNewName("");
      onChanged();
    } catch (err) {
      console.error("[ManageCategoriesModal] add error", err);
      toast.show("error", err instanceof Error ? err.message : "שגיאה בהוספה");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(cat: DocumentCategory) {
    const ok = await confirm({
      title: `למחוק את הקטגוריה "${cat.name}"?`,
      message: "אפשר למחוק רק קטגוריה ריקה, בלי מסמכים.",
      confirmLabel: "מחיקה",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(cat.id);
    try {
      const res = await fetch(`/api/document-categories/${cat.id}`, {
        method: "DELETE",
      });
      await parseApiResponse(res);
      toast.show("success", `הקטגוריה "${cat.name}" נמחקה`);
      onChanged();
    } catch (err) {
      console.error("[ManageCategoriesModal] delete error", err);
      toast.show("error", err instanceof Error ? err.message : "שגיאה במחיקה");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ניהול קטגוריות" widthClass="max-w-xl">
      <div className="space-y-5">
        {/* Add */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            הוספת קטגוריה
          </h3>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="שם הקטגוריה החדשה"
              className="flex-1 min-h-11 rounded-lg border border-border bg-white px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
            />
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition disabled:opacity-60 whitespace-nowrap"
            >
              <FolderPlus className="size-4" />
              {adding ? "מוסיף…" : "הוסף קטגוריה"}
            </button>
          </form>
        </section>

        {/* List */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            קטגוריות קיימות ({categories.length})
          </h3>
          {categories.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center bg-background border border-dashed border-border rounded-lg">
              אין קטגוריות עדיין
            </p>
          ) : (
            <ul className="border border-border rounded-xl divide-y divide-border bg-background overflow-hidden">
              {categories.map((cat) => {
                const isProtected = PROTECTED_CATEGORY_NAMES.includes(cat.name);
                const isDeleting = deletingId === cat.id;
                return (
                  <li
                    key={cat.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {cat.name}
                    </span>
                    {isProtected ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted"
                        title="קטגוריה מוגנת — לא ניתנת למחיקה"
                      >
                        <Lock className="size-3.5" />
                        מוגן
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 min-h-11 text-sm text-danger hover:bg-danger-soft px-3 rounded-lg transition disabled:opacity-50"
                        aria-label={`מחיקת קטגוריה ${cat.name}`}
                      >
                        <Trash2 className="size-4" />
                        {isDeleting ? "מוחק…" : "מחיקה"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-4 rounded-lg border border-border text-foreground hover:bg-accent-soft transition"
          >
            סגירה
          </button>
        </div>
      </div>
    </Modal>
  );
}
