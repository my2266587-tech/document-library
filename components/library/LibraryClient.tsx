"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Files, FolderPlus, Search, BookMarked, FileX } from "lucide-react";
import type { DocumentCategory, DocumentWithCategory } from "@/lib/types";
import CategoryTabs from "./CategoryTabs";
import DocumentCard from "./DocumentCard";
import UploadModal from "./UploadModal";
import UploadManyModal from "./UploadManyModal";
import NewCategoryModal from "./NewCategoryModal";
import EditDocumentModal from "./EditDocumentModal";
import { ToastProvider, useToast } from "./Toast";

export default function LibraryClient() {
  return (
    <ToastProvider>
      <LibraryInner />
    </ToastProvider>
  );
}

type SortKey = "created_desc" | "created_asc" | "title_asc" | "title_desc";

function LibraryInner() {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [docs, setDocs] = useState<DocumentWithCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created_desc");
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [showUploadMany, setShowUploadMany] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentWithCategory | null>(null);

  const toast = useToast();

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/document-categories", { cache: "no-store" });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("[fetchCategories]", res.status, data);
        toast.show("error", `שגיאה בטעינת קטגוריות: ${data.error ?? res.status}`);
        return;
      }
      setCategories((data.categories as DocumentCategory[] | undefined) ?? []);
    } catch (err) {
      console.error("[fetchCategories] exception", err);
      toast.show(
        "error",
        `שגיאה בטעינת קטגוריות: ${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }, [toast]);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCat !== "all") params.set("category_id", selectedCat);
    if (search.trim()) params.set("q", search.trim());
    if (fileType !== "all") params.set("file_type", fileType);
    params.set("sort", sort);

    try {
      const res = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("[fetchDocs]", res.status, data);
        toast.show("error", `שגיאה בטעינת מסמכים: ${data.error ?? res.status}`);
        setDocs([]);
        return;
      }
      setDocs((data.documents as DocumentWithCategory[] | undefined) ?? []);
    } catch (err) {
      console.error("[fetchDocs] exception", err);
      toast.show(
        "error",
        `שגיאה בטעינת מסמכים: ${err instanceof Error ? err.message : "Unknown"}`
      );
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCat, search, fileType, sort, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const t = setTimeout(fetchDocs, 250);
    return () => clearTimeout(t);
  }, [fetchDocs]);

  const fileTypes = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => d.file_type && set.add(d.file_type));
    return Array.from(set).sort();
  }, [docs]);

  async function handleView(doc: DocumentWithCategory) {
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ download: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.show("error", err instanceof Error ? err.message : "שגיאה בצפייה");
    }
  }

  async function handleDownload(doc: DocumentWithCategory) {
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ download: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה");
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.fileName ?? doc.original_file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.show("error", err instanceof Error ? err.message : "שגיאה בהורדה");
    }
  }

  async function handleDelete(doc: DocumentWithCategory) {
    if (!confirm(`למחוק את "${doc.title}"? פעולה זו אינה הפיכה.`)) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה");
      toast.show("success", "המסמך נמחק");
      fetchDocs();
    } catch (err) {
      toast.show("error", err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-sm">
                <BookMarked className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                  ספריית מסמכים
                </h1>
                <p className="text-muted mt-1 text-sm lg:text-base">
                  ניהול מסמכים, אבחונים וקבצים כלליים במקום אחד
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition shadow-sm"
              >
                <Upload className="size-4" />
                העלאת מסמך
              </button>
              <button
                onClick={() => setShowUploadMany(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-foreground font-medium hover:bg-accent-soft hover:border-border-strong transition"
              >
                <Files className="size-4" />
                העלאה מרובה
              </button>
              <button
                onClick={() => setShowNewCategory(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-foreground font-medium hover:bg-accent-soft hover:border-border-strong transition"
              >
                <FolderPlus className="size-4" />
                קטגוריה חדשה
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-5">
          <CategoryTabs
            categories={categories}
            selected={selectedCat}
            onSelect={setSelectedCat}
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 bg-surface border border-border rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם מסמך…"
              className="w-full rounded-lg border border-border bg-white pe-9 ps-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
            />
          </div>

          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
            aria-label="סינון לפי סוג קובץ"
          >
            <option value="all">כל סוגי הקבצים</option>
            {fileTypes.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
            aria-label="מיון"
          >
            <option value="created_desc">חדש לישן</option>
            <option value="created_asc">ישן לחדש</option>
            <option value="title_asc">שם א—ת</option>
            <option value="title_desc">שם ת—א</option>
          </select>
        </div>

        {/* Documents grid */}
        {loading ? (
          <div className="text-center py-16 text-muted">טוען…</div>
        ) : docs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {docs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onView={() => handleView(doc)}
                onDownload={() => handleDownload(doc)}
                onEdit={() => setEditDoc(doc)}
                onDelete={() => handleDelete(doc)}
              />
            ))}
          </div>
        )}
      </div>

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        categories={categories}
        defaultCategoryId={selectedCat !== "all" ? selectedCat : undefined}
        onUploaded={fetchDocs}
      />
      <UploadManyModal
        open={showUploadMany}
        onClose={() => setShowUploadMany(false)}
        categories={categories}
        defaultCategoryId={selectedCat !== "all" ? selectedCat : undefined}
        onUploaded={fetchDocs}
      />
      <NewCategoryModal
        open={showNewCategory}
        onClose={() => setShowNewCategory(false)}
        onCreated={fetchCategories}
      />
      <EditDocumentModal
        open={!!editDoc}
        doc={editDoc}
        categories={categories}
        onClose={() => setEditDoc(null)}
        onSaved={fetchDocs}
      />
    </div>
  );
}

async function safeJson(res: Response): Promise<{ error?: string; [k: string]: unknown }> {
  const text = await res.text();
  if (!text) {
    return {
      error: `Empty response (status ${res.status} ${res.statusText || ""})`.trim(),
    };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `Non-JSON response (status ${res.status}): ${text.slice(0, 200)}`,
    };
  }
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-surface border border-dashed border-border-strong rounded-2xl">
      <div className="inline-flex size-14 rounded-2xl bg-accent-soft text-accent items-center justify-center mb-3">
        <FileX className="size-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">אין מסמכים להצגה</h3>
      <p className="text-sm text-muted mt-1">
        העלו מסמך חדש או שנו את מסנני החיפוש
      </p>
    </div>
  );
}
