"use client";

import type { DocumentCategory } from "@/lib/types";

type Props = {
  categories: DocumentCategory[];
  selected: string;
  onSelect: (id: string) => void;
  counts?: Record<string, number>;
};

export default function CategoryTabs({ categories, selected, onSelect, counts }: Props) {
  const items = [{ id: "all", name: "הכל" }, ...categories.map((c) => ({ id: c.id, name: c.name }))];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = selected === it.id;
        const count = counts?.[it.id];
        return (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
              active
                ? "bg-accent text-white border-accent shadow-sm"
                : "bg-surface text-foreground border-border hover:border-border-strong hover:bg-accent-soft/60"
            }`}
          >
            {it.name}
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
      })}
    </div>
  );
}
