"use client";

import { useEffect, useState } from "react";
import { Eye, Download, Loader2, ScanText, AlertCircle } from "lucide-react";
import type { ContentSearchHit, DocumentWithCategory } from "@/lib/types";
import { highlightParts, normalizeForSearch } from "@/lib/content-search";
import { parseApiResponse } from "@/lib/utils";
import { FileTypeIcon } from "@/lib/file-icons";

type Props = {
  categoryId: string;
  query: string;
  onView: (doc: DocumentWithCategory) => void;
  onDownload: (doc: DocumentWithCategory) => void;
};

type IndexState = {
  categoryId: string;
  indexed: number;
  remaining: number;
  finished: boolean;
  error: string | null;
};

type SearchState = {
  key: string;
  results: ContentSearchHit[];
  truncated: boolean;
  error: string | null;
};

// Shown under the name results of the main search. Finds the sentence inside the documents' text. Images whose text was
// not read yet are read (OCR on the server) first, in rounds.
export default function ContentSearchPanel({ categoryId, query, onView, onDownload }: Props) {
  const [index, setIndex] = useState<IndexState | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);

  const indexing = !index || index.categoryId !== categoryId || !index.finished;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let indexed = 0;
      try {
        for (;;) {
          const res = await fetch("/api/documents/content-index", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: categoryId }),
          });
          const data = await parseApiResponse<{ indexed: number; remaining: number }>(res);
          if (cancelled) return;
          indexed += data.indexed;
          const finished = data.remaining === 0 || data.indexed === 0;
          setIndex({ categoryId, indexed, remaining: data.remaining, finished, error: null });
          if (finished) return;
        }
      } catch (err) {
        if (cancelled) return;
        setIndex({
          categoryId,
          indexed,
          remaining: 0,
          finished: true,
          error: err instanceof Error ? err.message : "שגיאה בקריאת הטקסט מהמסמכים",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const trimmed = query.trim();
  const hasQuery = normalizeForSearch(trimmed) !== "";
  // Re-search when a reading round finishes, so newly read images show up.
  const indexedSoFar = index?.categoryId === categoryId ? index.indexed : 0;
  const searchKey = `${categoryId}|${trimmed}|${indexedSoFar}|${indexing}`;

  useEffect(() => {
    if (!hasQuery) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ q: trimmed });
      if (categoryId !== "all") params.set("category_id", categoryId);
      try {
        const res = await fetch(`/api/documents/content-search?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await parseApiResponse<{ results?: ContentSearchHit[]; truncated?: boolean }>(res);
        if (!cancelled)
          setSearch({ key: searchKey, results: data.results ?? [], truncated: !!data.truncated, error: null });
      } catch (err) {
        if (!cancelled)
          setSearch({
            key: searchKey,
            results: [],
            truncated: false,
            error: err instanceof Error ? err.message : "שגיאה בחיפוש",
          });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hasQuery, trimmed, categoryId, searchKey]);

  const current = search?.key === searchKey ? search : null;
  const indexError = index?.categoryId === categoryId ? index.error : null;

  return (
    <EmbeddedResults
      hasQuery={hasQuery}
      current={current}
      indexing={indexing}
      indexError={indexError}
      query={trimmed}
      onView={onView}
      onDownload={onDownload}
    />
  );
}

function IconButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center size-11 sm:size-9 rounded-lg text-muted hover:text-accent hover:bg-accent-soft transition"
    >
      {icon}
    </button>
  );
}

function HitList({
  results,
  query,
  onView,
  onDownload,
}: {
  results: ContentSearchHit[];
  query: string;
  onView: (doc: DocumentWithCategory) => void;
  onDownload: (doc: DocumentWithCategory) => void;
}) {
  return (
    <ul className="space-y-3">
      {results.map(({ doc, paragraphs, totalPlaces }) => (
        <li key={doc.id} className="bg-surface border border-border rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <FileTypeIcon fileType={doc.file_type} size="sm" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate" title={doc.title}>
                {doc.title}
              </h3>
              {doc.category && <p className="text-xs text-muted truncate">{doc.category.name}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <IconButton label="פתיחה" onClick={() => onView(doc)} icon={<Eye className="size-4" />} />
              <IconButton label="הורדה" onClick={() => onDownload(doc)} icon={<Download className="size-4" />} />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {paragraphs.map((p, i) => (
              <blockquote
                key={i}
                className="border-s-4 border-accent bg-background rounded-lg px-3 py-2 text-sm leading-relaxed text-foreground"
              >
                {highlightParts(p, query).map((part, j) =>
                  part.hit ? (
                    <mark key={j} className="bg-accent-soft text-accent-hover font-semibold rounded px-0.5">
                      {part.text}
                    </mark>
                  ) : (
                    <span key={j}>{part.text}</span>
                  )
                )}
              </blockquote>
            ))}
            {totalPlaces > paragraphs.length && (
              <p className="text-xs text-muted">
                ועוד {(totalPlaces - paragraphs.length).toLocaleString("he-IL")} מקומות במסמך
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmbeddedResults({
  hasQuery,
  current,
  indexing,
  indexError,
  query,
  onView,
  onDownload,
}: {
  hasQuery: boolean;
  current: SearchState | null;
  indexing: boolean;
  indexError: string | null;
  query: string;
  onView: (doc: DocumentWithCategory) => void;
  onDownload: (doc: DocumentWithCategory) => void;
}) {
  if (!hasQuery) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <ScanText className="size-5 text-accent" />
        מופיע בתוך המסמכים
        {current && !current.error && current.results.length > 0 && (
          <span className="text-sm font-normal text-muted">
            ({current.results.length.toLocaleString("he-IL")}
            {current.truncated && "+"})
          </span>
        )}
      </h2>
      {indexError && (
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          {indexError}
        </p>
      )}
      {!current ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          מחפשת בתוך המסמכים…
        </p>
      ) : current.error ? (
        <p className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          החיפוש בתוך המסמכים נכשל: {current.error}
        </p>
      ) : current.results.length === 0 ? (
        <p className="text-sm text-muted">
          {indexing
            ? "עדיין קוראת חלק מהתמונות — התוצאות יתעדכנו בעוד רגע."
            : "לא נמצא בתוך המסמכים."}
        </p>
      ) : (
        <HitList results={current.results} query={query} onView={onView} onDownload={onDownload} />
      )}
      {indexing && current && current.results.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="size-3.5 animate-spin" />
          עדיין קוראת חלק מהתמונות — עוד תוצאות עשויות להופיע.
        </p>
      )}
    </section>
  );
}
