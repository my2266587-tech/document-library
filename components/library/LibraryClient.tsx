"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Upload,
  Files,
  FolderCog,
  Search,
  BookMarked,
  FileX,
  LayoutGrid,
  Rows3,
  X,
  Filter,
} from "lucide-react";
import type { DocumentCategory, DocumentWithCategory } from "@/lib/types";
import CategoryTabs from "./CategoryTabs";
import DocumentCard from "./DocumentCard";
import DocumentRow, { DocumentRowHeader } from "./DocumentRow";
import UploadModal from "./UploadModal";
import UploadManyModal from "./UploadManyModal";
import ManageCategoriesModal from "./ManageCategoriesModal";
import EditDocumentModal from "./EditDocumentModal";
import { ToastProvider, useToast } from "./Toast";
import { parseApiResponse, formatBytes } from "@/lib/utils";

export default function LibraryClient() {
  return (
    <ToastProvider>
      <LibraryInner />
    </ToastProvider>
  );
}

type SortKey = "created_desc" | "created_asc" | "title_asc" | "title_desc";
type ViewMode = "grid" | "list";

const VIEW_STORAGE_KEY = "library:view-mode";

function LibraryInner() {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [docs, setDocs] = useState<DocumentWithCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created_desc");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");

  const [showUpload, setShowUpload] = useState(false);
  const [showUploadMany, setShowUploadMany] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentWithCategory | null>(null);

  const toast = useToast();

  // Restore view preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {}
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {}
  }

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/document-categories", { cache: "no-store" });
      const data = await parseApiResponse<{ categories?: DocumentCategory[] }>(res);
      setCategories(data.categories ?? []);
    } catch (err) {
      console.error("[fetchCategories] error", err);
      toast.show(
        "error",
        `שגיאה בטעינת קטגוריות: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`
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
      const data = await parseApiResponse<{ documents?: DocumentWithCategory[] }>(res);
      setDocs(data.documents ?? []);
    } catch (err) {
      console.error("[fetchDocs] error", err);
      toast.show(
        "error",
        `שגיאה בטעינת מסמכים: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`
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

  const totalSize = useMemo(
    () => docs.reduce((sum, d) => sum + (d.file_size ?? 0), 0),
    [docs]
  );

  const hasActiveFilters =
    search.trim() !== "" || fileType !== "all" || selectedCat !== "all";

  function resetFilters() {
    setSearch("");
    setFileType("all");
    setSelectedCat("all");
  }

  async function handleView(doc: DocumentWithCategory) {
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ download: false }),
      });
      const data = await parseApiResponse<{ url: string }>(res);
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
      const data = await parseApiResponse<{ url: string; fileName?: string }>(res);
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
      await parseApiResponse(res);
      toast.show("success", "המסמך נמחק");
      fetchDocs();
    } catch (err) {
      toast.show("error", err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  }

  async function handleDeleteCategory(cat: DocumentCategory) {
    if (!confirm(`בטוחה למחוק את הקטגוריה "${cat.name}"?`)) return;
    try {
      const res = await fetch(`/api/document-categories/${cat.id}`, {
        method: "DELETE",
      });
      await parseApiResponse(res);
      toast.show("success", `הקטגוריה "${cat.name}" נמחקה`);
      if (selectedCat === cat.id) setSelectedCat("all");
      fetchCategories();
      fetchDocs();
    } catch (err) {
      console.error("[handleDeleteCategory] error", err);
      toast.show("error", err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-sm">
                <BookMarked className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
                  ספריית מסמכים
                </h1>
                <p className="text-muted mt-1 text-sm lg:text-base">
                  ניהול מסמכים, אבחונים וקבצים כלליים במקום אחד
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted">
                  <Stat label="מסמכים" value={docs.length.toLocaleString("he-IL")} />
                  <Dot />
                  <Stat label="קטגוריות" value={categories.length.toLocaleString("he-IL")} />
                  <Dot />
                  <Stat label="נפח כולל" value={formatBytes(totalSize)} />
                </div>
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
                onClick={() => setShowManageCategories(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-foreground font-medium hover:bg-accent-soft hover:border-border-strong transition"
              >
                <FolderCog className="size-4" />
                ניהול קטגוריות
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
            onDelete={handleDeleteCategory}
          />
        </div>

        {/* Toolbar */}
        <div className="mb-4 bg-surface border border-border rounded-2xl p-2.5 flex flex-col md:flex-row md:items-center gap-2.5">
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

          <div className="flex items-center gap-2 flex-wrap">
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

            {/* View toggle */}
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
              <ViewToggleBtn
                active={view === "grid"}
                onClick={() => changeView("grid")}
                icon={<LayoutGrid className="size-4" />}
                label="תצוגת כרטיסים"
              />
              <ViewToggleBtn
                active={view === "list"}
                onClick={() => changeView("list")}
                icon={<Rows3 className="size-4" />}
                label="תצוגת רשימה"
              />
            </div>
          </div>
        </div>

        {/* Active filters chip row */}
        {hasActiveFilters && !loading && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted flex-wrap">
            <Filter className="size-3.5" />
            <span>
              {docs.length === 0
                ? "אין תוצאות תואמות לסינון הנוכחי"
                : `מציג ${docs.length.toLocaleString("he-IL")} תוצאות`}
            </span>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-accent hover:text-accent-hover font-medium"
            >
              <X className="size-3.5" />
              נקה סינון
            </button>
          </div>
        )}

        {/* Documents area */}
        {loading ? (
          <SkeletonGrid view={view} />
        ) : docs.length === 0 ? (
          <EmptyState hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
        ) : view === "grid" ? (
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
        ) : (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <DocumentRowHeader />
            {docs.map((doc) => (
              <DocumentRow
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
      <ManageCategoriesModal
        open={showManageCategories}
        onClose={() => setShowManageCategories(false)}
        categories={categories}
        onChanged={() => {
          fetchCategories();
          if (
            selectedCat !== "all" &&
            !categories.find((c) => c.id === selectedCat)
          ) {
            setSelectedCat("all");
          }
          fetchDocs();
        }}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function Dot() {
  return <span className="size-1 rounded-full bg-border-strong" aria-hidden="true" />;
}

function ViewToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex items-center justify-center size-8 rounded-md transition ${
        active
          ? "bg-accent text-white shadow-sm"
          : "text-muted hover:text-foreground hover:bg-accent-soft/60"
      }`}
    >
      {icon}
    </button>
  );
}

function SkeletonGrid({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 animate-pulse"
          >
            <div className="size-9 rounded-lg bg-background" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-background rounded w-1/3" />
              <div className="h-2.5 bg-background rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-2xl p-4 animate-pulse"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="size-11 rounded-xl bg-background" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-background rounded w-3/4" />
              <div className="h-3 bg-background rounded w-1/2" />
            </div>
          </div>
          <div className="flex gap-1.5 mb-3">
            <div className="h-5 w-16 bg-background rounded-full" />
            <div className="h-5 w-12 bg-background rounded-full" />
          </div>
          <div className="h-3 bg-background rounded w-2/3 mb-2" />
          <div className="h-9 bg-background rounded mt-3" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasActiveFilters,
  onReset,
}: {
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="text-center py-16 bg-surface border border-dashed border-border-strong rounded-2xl">
      <div className="inline-flex size-14 rounded-2xl bg-accent-soft text-accent items-center justify-center mb-3">
        <FileX className="size-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {hasActiveFilters ? "אין תוצאות תואמות" : "אין מסמכים להצגה"}
      </h3>
      <p className="text-sm text-muted mt-1 mb-4">
        {hasActiveFilters
          ? "נסי לשנות את מסנני החיפוש או להתחיל מחדש"
          : "התחילי בהעלאת מסמך חדש"}
      </p>
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition"
        >
          <X className="size-4" />
          נקה את כל הסינונים
        </button>
      )}
    </div>
  );
}
