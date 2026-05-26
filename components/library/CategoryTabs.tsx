"use client";

import { X } from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { PROTECTED_CATEGORY_NAMES } from "@/lib/constants";
import { colorForName } from "@/lib/category-color";

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
    <div className="flex flex-wrap gap-1.5">
      {/* "All" tab — no dot */}
      <button
        onClick={() => onSelect("all")}
        className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition ${
          selected === "all"
            ? "bg-accent text-white border-accent shadow-sm"
            : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
        }`}
      >
        הכל
        {typeof counts?.all === "number" && (
          <CountBadge active={selected === "all"} value={counts.all} />
        )}
      </button>

      {categories.map((cat) => {
        const active = selected === cat.id;
        const isProtected = PROTECTED_CATEGORY_NAMES.includes(cat.name);
        const showDelete = !!onDelete && !isProtected;
        const dotColor = colorForName(cat.name);

        return (
          <div
            key={cat.id}
            className={`group inline-flex items-center rounded-full border text-sm font-medium transition ${
              active
                ? "bg-accent text-white border-accent shadow-sm"
                : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
            }`}
            title={cat.description || cat.name}
          >
            <button
              onClick={() => onSelect(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 ${
                showDelete ? "pe-2" : ""
              }`}
            >
              <span
                className={`size-2 rounded-full shrink-0 ${
                  active ? "ring-2 ring-white/70" : ""
                }`}
                style={{ backgroundColor: active ? "#ffffff" : dotColor }}
                aria-hidden="true"
              />
              <span className="truncate max-w-[180px] sm:max-w-[260px]">
                {cat.name}
              </span>
              {typeof counts?.[cat.id] === "number" && (
                <CountBadge active={active} value={counts[cat.id]} />
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

function CountBadge({ active, value }: { active: boolean; value: number }) {
  return (
    <span
      className={`ms-1.5 inline-flex items-center justify-center min-w-5 h-5 text-xs rounded-full px-1.5 ${
        active ? "bg-white/20 text-white" : "bg-accent-soft text-muted"
      }`}
    >
      {value}
    </span>
  );
}
