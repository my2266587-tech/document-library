"use client";

import { X } from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { PROTECTED_CATEGORY_NAMES } from "@/lib/constants";

type Props = {
  categories: DocumentCategory[];
  selected: string;
  onSelect: (id: string) => void;
  onDelete?: (cat: DocumentCategory) => void;
  counts?: Record<string, number>;
};

export default function CategoryTabs({
  categories,
  selected,
  onSelect,
  onDelete,
  counts,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <TabButton
        active={selected === "all"}
        onClick={() => onSelect("all")}
        label="הכל"
        count={counts?.all}
      />
      {categories.map((cat) => {
        const active = selected === cat.id;
        const isProtected = PROTECTED_CATEGORY_NAMES.includes(cat.name);
        const showDelete = !!onDelete && !isProtected;
        return (
          <div
            key={cat.id}
            className={`group inline-flex items-center rounded-full border text-sm font-medium transition ${
              active
                ? "bg-accent text-white border-accent shadow-sm"
                : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
            }`}
          >
            <button
              onClick={() => onSelect(cat.id)}
              className={`px-4 py-2 ${showDelete ? "pe-2" : ""}`}
            >
              {cat.name}
              {typeof counts?.[cat.id] === "number" && (
                <span
                  className={`ms-2 inline-flex items-center justify-center min-w-5 h-5 text-xs rounded-full px-1.5 ${
                    active ? "bg-white/20 text-white" : "bg-accent-soft text-muted"
                  }`}
                >
                  {counts[cat.id]}
                </span>
              )}
            </button>
            {showDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete!(cat);
                }}
                className={`flex items-center justify-center size-6 rounded-full me-1 transition ${
                  active
                    ? "text-white/80 hover:bg-white/15 hover:text-white"
                    : "text-muted hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus:opacity-100"
                }`}
                aria-label={`מחיקת קטגוריה ${cat.name}`}
                title={`מחיקת קטגוריה ${cat.name}`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
        active
          ? "bg-accent text-white border-accent shadow-sm"
          : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span
          className={`ms-2 inline-flex items-center justify-center min-w-5 h-5 text-xs rounded-full px-1.5 ${
            active ? "bg-white/20 text-white" : "bg-accent-soft text-muted"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
