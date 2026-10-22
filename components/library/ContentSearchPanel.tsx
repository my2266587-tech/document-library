"use client";

import { useEffect, useState } from "react";
import { Eye, Download, Loader2, ScanText, SearchX, AlertCircle } from "lucide-react";
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

// Searches for a sentence inside the documents' text. Images whose text was
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
    <div className="space-y-4">
      {indexing && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-soft text-accent text-sm">
          <Loader2 className="size-4 animate-spin shrink-0" />
          <span>
            קוראת את הטקסט מתוך התמונות…
            {index?.categoryId === categoryId && index.indexed > 0 && (
              <> נקראו {index.indexed.toLocaleString("he-IL")}, נשארו {index.remaining.toLocaleString("he-IL")}</>
            )}
          </span>
        </div>
      )}
      {indexError && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-danger-soft text-danger text-sm">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{indexError}</span>
        </div>
      )}

      {!hasQuery ? (
        <Message icon={<ScanText className="size-7" />} title="חיפוש משפט בתוך המסמכים">
          הקלידי משפט או כמה מילים, ויוצגו המסמכים שבהם הוא מופיע יחד עם המשפט עצמו.
        </Message>
      ) : !current ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted text-sm">
          <Loader2 className="size-5 animate-spin" />
          מחפשת…
        </div>
      ) : current.error ? (
        <Message icon={<AlertCircle className="size-7" />} title="החיפוש נכשל">
          {current.error}
        </Message>
      ) : current.results.length === 0 ? (
        <Message icon={<SearchX className="size-7" />} title="המשפט לא נמצא">
          {indexing
            ? "עדיין קוראת חלק מהתמונות — התוצאות יתעדכנו כשהקריאה תסתיים."
            : "נסי לחפש חלק קצר יותר מהמשפט או מילה אחרת."}
        </Message>
      ) : (
        <>
          <p className="text-xs text-muted">
            נמצא ב-{current.results.length.toLocaleString("he-IL")} מסמכים
            {current.truncated && " (מוצגות התוצאות הראשונות בלבד)"}
          </p>
          <ul className="space-y-3">
            {current.results.map(({ doc, paragraphs }) => (
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
                    <IconButton label="צפייה" onClick={() => onView(doc)} icon={<Eye className="size-4" />} />
                    <IconButton label="הורדה" onClick={() => onDownload(doc)} icon={<Download className="size-4" />} />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {paragraphs.map((p, i) => (
                    <blockquote
                      key={i}
                      className="border-s-4 border-accent bg-background rounded-lg px-3 py-2 text-sm leading-relaxed text-foreground"
                    >
                      {highlightParts(p, trimmed).map((part, j) =>
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
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="text-center py-14 px-4 bg-surface border border-dashed border-border-strong rounded-2xl">
      <div className="inline-flex size-14 rounded-2xl bg-accent-soft text-accent items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted mt-1">{children}</p>
    </div>
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
