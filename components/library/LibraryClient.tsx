"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  FolderCog,
  FolderArchive,
  Search,
  BookMarked,
  FileX,
  LayoutGrid,
  Rows3,
  X,
  Mic,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { DocumentCategory, DocumentWithCategory } from "@/lib/types";
import { CategorySelect, CategorySidebar } from "./CategoryTabs";
import DocumentCard from "./DocumentCard";
import DocumentRow, { DocumentRowHeader } from "./DocumentRow";
import UploadManyModal from "./UploadManyModal";
import ManageCategoriesModal from "./ManageCategoriesModal";
import EditDocumentModal from "./EditDocumentModal";
import ContentSearchPanel from "./ContentSearchPanel";
import VoiceSearchButton from "./VoiceSearchButton";
import DownloadZipModal from "./DownloadZipModal";
import { ToastProvider, useToast } from "./Toast";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";
import { parseApiResponse } from "@/lib/utils";
import { colorForName } from "@/lib/category-color";

export default function LibraryClient() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <LibraryInner />
      </ConfirmProvider>
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
  const [listening, setListening] = useState(false);
  const [sort, setSort] = useState<SortKey>("created_desc");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");
  const [loadError, setLoadError] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | undefined>(undefined);

  const [showUpload, setShowUpload] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showDownloadZip, setShowDownloadZip] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentWithCategory | null>(null);

  const toast = useToast();
  const confirm = useConfirm();

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

  const query = search.trim();

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    if (selectedCat !== "all") params.set("category_id", selectedCat);
    if (query) params.set("q", query);
    params.set("sort", sort);

    try {
      const res = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" });
      const data = await parseApiResponse<{ documents?: DocumentWithCategory[] }>(res);
      const list = data.documents ?? [];
      setDocs(list);
      // The full, unfiltered list tells how many documents each category has.
      if (selectedCat === "all" && !query) {
        const next: Record<string, number> = { all: list.length };
        for (const d of list) if (d.category_id) next[d.category_id] = (next[d.category_id] ?? 0) + 1;
        setCounts(next);
      }
    } catch (err) {
      console.error("[fetchDocs] error", err);
      toast.show(
        "error",
        `שגיאה בטעינת מסמכים: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`
      );
      setDocs([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedCat, query, sort, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const t = setTimeout(fetchDocs, 250);
    return () => clearTimeout(t);
  }, [fetchDocs]);

  function showAll() {
    setSearch("");
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
      toast.show("error", err instanceof Error ? err.message : "שגיאה בפתיחת המסמך");
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
    const ok = await confirm({
      title: `למחוק את "${doc.title}"?`,
      message: "המסמך יימחק מהספרייה ולא יהיה אפשר לשחזר אותו.",
      confirmLabel: "מחיקה",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      await parseApiResponse(res);
      toast.show("success", "המסמך נמחק");
      fetchDocs();
    } catch (err) {
      toast.show("error", err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  }

  const docList =
    view === "grid" ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
    );

  const currentCat = selectedCat === "all" ? null : categories.find((c) => c.id === selectedCat) ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sm:sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            onClick={() => {
              showAll();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-label="חזרה לדף הבית"
            title="חזרה לדף הבית"
            className="flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <span className="size-10 shrink-0 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
              <BookMarked className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-bold text-foreground">ספריית מסמכים</span>
              <span className="hidden sm:block text-xs text-muted">כל המסמכים במקום אחד</span>
            </span>
          </Link>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
            <div className="grid grid-cols-3 sm:flex gap-2 order-2 sm:order-1">
              <HeaderLink href="/blank" icon={<Mic className="size-4" />} label="בלאנק מוקלט" />
              <div className="lg:hidden contents">
                <HeaderButton
                  onClick={() => setShowManageCategories(true)}
                  icon={<FolderCog className="size-4" />}
                  label="קטגוריות"
                />
              </div>
              <HeaderButton
                onClick={() => setShowDownloadZip(true)}
                icon={<FolderArchive className="size-4" />}
                label="הורדת הספרייה"
              />
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="order-1 sm:order-2 inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition shadow-sm"
            >
              <Upload className="size-5" />
              העלאת מסמכים
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8">
        {/* Categories — a side list on computers */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <CategorySidebar
              categories={categories}
              selected={selectedCat}
              onSelect={setSelectedCat}
              counts={counts}
              onManage={() => setShowManageCategories(true)}
            />
          </div>
        </aside>

        <main className="min-w-0">
        {/* Search — by name and inside the documents at once */}
        <div className="relative mb-4">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 size-5 text-muted pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={listening ? "מקשיבה… דברי עכשיו" : "חיפוש מסמך — לפי שם או לפי משפט מתוכו"}
            aria-label="חיפוש מסמך"
            className="w-full min-h-13 rounded-xl border border-border-strong bg-white ps-12 pe-24 py-3 text-base shadow-[0_1px_2px_rgba(47,42,37,0.05)] [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="ניקוי החיפוש"
              title="ניקוי החיפוש"
              className="absolute end-11 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-11 rounded-lg text-muted hover:text-foreground hover:bg-accent-soft transition"
            >
              <X className="size-5" />
            </button>
          )}
          <VoiceSearchButton onText={setSearch} onListeningChange={setListening} />
        </div>

        {/* Categories — one dropdown on phones and tablets */}
        <div className="mb-4 lg:hidden">
          <CategorySelect categories={categories} selected={selectedCat} onSelect={setSelectedCat} />
        </div>

        {/* Where am I + how many, and display options */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentCat && (
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colorForName(currentCat.name) }}
                  aria-hidden="true"
                />
              )}
              <h2 className="text-xl font-bold text-foreground truncate">
                {currentCat ? currentCat.name : "כל המסמכים"}
              </h2>
            </div>
          <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>
              {loading ? (
                "טוען…"
              ) : (
                <>
                  {docs.length.toLocaleString("he-IL")}{" "}
                  {query ? "מסמכים ששמם מתאים לחיפוש" : "מסמכים"}
                  {currentCat?.description && ` · ${currentCat.description}`}
                </>
              )}
            </span>
            {(query || selectedCat !== "all") && (
              <button
                onClick={showAll}
                className="inline-flex items-center gap-1 min-h-11 text-accent hover:text-accent-hover font-medium"
              >
                <X className="size-4" />
                הצגת כל המסמכים
              </button>
            )}
          </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="min-h-11 rounded-lg border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              aria-label="סדר המסמכים"
            >
              <option value="created_desc">החדשים קודם</option>
              <option value="created_asc">הישנים קודם</option>
              <option value="title_asc">לפי שם (א׳–ת׳)</option>
              <option value="title_desc">לפי שם (ת׳–א׳)</option>
            </select>
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5" role="group" aria-label="תצוגה">
              <ViewToggleBtn
                active={view === "grid"}
                onClick={() => changeView("grid")}
                icon={<LayoutGrid className="size-4" />}
                label="כרטיסים"
              />
              <ViewToggleBtn
                active={view === "list"}
                onClick={() => changeView("list")}
                icon={<Rows3 className="size-4" />}
                label="רשימה"
              />
            </div>
          </div>
        </div>

        {/* Documents */}
        {loading ? (
          <SkeletonGrid view={view} />
        ) : query ? (
          <div className="space-y-8">
            {docs.length > 0 ? (
              docList
            ) : (
              <p className="text-sm text-muted bg-surface border border-dashed border-border-strong rounded-2xl px-4 py-5 text-center">
                אין מסמך שהשם שלו מתאים ל״{query}״
              </p>
            )}
            <ContentSearchPanel
              categoryId={selectedCat}
              query={search}
              onView={handleView}
              onDownload={handleDownload}
            />
          </div>
        ) : loadError ? (
          <div className="text-center py-14 px-4 bg-surface border border-border rounded-2xl">
            <div className="inline-flex size-14 rounded-2xl bg-danger-soft text-danger items-center justify-center mb-3">
              <AlertCircle className="size-7" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">לא הצלחנו לטעון את המסמכים</h3>
            <p className="text-sm text-muted mt-1 mb-5">ייתכן שיש בעיה רגעית בחיבור. המסמכים עצמם שמורים.</p>
            <button
              onClick={fetchDocs}
              className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition"
            >
              <RefreshCw className="size-4" />
              נסי שוב
            </button>
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            inCategory={selectedCat !== "all"}
            onUpload={() => setShowUpload(true)}
            onShowAll={showAll}
          />
        ) : (
          docList
        )}
        </main>
      </div>

      <UploadManyModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        categories={categories}
        defaultCategoryId={selectedCat !== "all" ? selectedCat : undefined}
        onUploaded={fetchDocs}
      />
      <DownloadZipModal
        open={showDownloadZip}
        onClose={() => setShowDownloadZip(false)}
        selectedCategory={categories.find((c) => c.id === selectedCat) ?? null}
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

const secondaryBtnClass =
  "inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-12 px-2 sm:px-4 rounded-xl bg-surface border border-border text-foreground text-xs sm:text-sm font-medium text-center hover:bg-accent-soft hover:border-border-strong transition";

function HeaderButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={secondaryBtnClass}>
      {icon}
      {label}
    </button>
  );
}

function HeaderLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className={secondaryBtnClass}>
      {icon}
      {label}
    </Link>
  );
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
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-md text-sm font-medium transition ${
        active
          ? "bg-accent text-white shadow-sm"
          : "text-muted hover:text-foreground hover:bg-accent-soft/60"
      }`}
    >
      {icon}
      {label}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
  inCategory,
  onUpload,
  onShowAll,
}: {
  inCategory: boolean;
  onUpload: () => void;
  onShowAll: () => void;
}) {
  return (
    <div className="text-center py-14 px-4 bg-surface border border-dashed border-border-strong rounded-2xl">
      <div className="inline-flex size-14 rounded-2xl bg-accent-soft text-accent items-center justify-center mb-3">
        <FileX className="size-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {inCategory ? "אין עדיין מסמכים בקטגוריה הזו" : "אין עדיין מסמכים בספרייה"}
      </h3>
      <p className="text-sm text-muted mt-1 mb-5">אפשר להעלות מסמך עכשיו</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition"
        >
          <Upload className="size-4" />
          העלאת מסמכים
        </button>
        {inCategory && (
          <button
            onClick={onShowAll}
            className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl border border-border text-foreground hover:bg-accent-soft transition"
          >
            הצגת כל המסמכים
          </button>
        )}
      </div>
    </div>
  );
}
