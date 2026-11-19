"use client";

import type { DocumentCategory } from "@/lib/types";
import { colorForName } from "@/lib/category-color";

type Props = {
  categories: DocumentCategory[];
  selected: string;
  onSelect: (id: string) => void;
  counts?: Record<string, number>;
};

export default function CategoryTabs({
  categories,
  selected,
  onSelect,
  counts,
}: Props) {
  return (
    <>
      {/* Phones: one simple list instead of a wall of buttons */}
      <label className="sm:hidden block">
        <span className="block text-sm font-medium text-foreground mb-1">קטגוריה</span>
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full min-h-12 rounded-xl border border-border-strong bg-white px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
        >
          <option value="all">כל המסמכים</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden sm:flex flex-wrap gap-1.5">
        {/* "All" tab — no dot */}
        <button
          onClick={() => onSelect("all")}
          className={`min-h-11 px-4 rounded-full border text-sm font-medium transition ${
            selected === "all"
              ? "bg-accent text-white border-accent shadow-sm"
              : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
          }`}
        >
          כל המסמכים
          {typeof counts?.all === "number" && (
            <CountBadge active={selected === "all"} value={counts.all} />
          )}
        </button>

        {categories.map((cat) => {
          const active = selected === cat.id;
          const dotColor = colorForName(cat.name);

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`inline-flex items-center gap-2 min-h-11 px-4 rounded-full border text-sm font-medium transition ${
                active
                  ? "bg-accent text-white border-accent shadow-sm"
                  : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
              }`}
              title={cat.description || cat.name}
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
          );
        })}
      </div>
    </>
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
