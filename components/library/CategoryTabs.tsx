"use client";

import { FolderCog, LayoutList } from "lucide-react";
import type { DocumentCategory } from "@/lib/types";
import { colorForName } from "@/lib/category-color";

type Props = {
  categories: DocumentCategory[];
  selected: string;
  onSelect: (id: string) => void;
  /** Number of documents per category id, plus "all". Shown when known. */
  counts?: Record<string, number>;
};

/** Phones and tablets: one simple dropdown. */
export function CategorySelect({ categories, selected, onSelect }: Props) {
  return (
    <label className="block">
      <span className="sr-only">קטגוריה</span>
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
  );
}

/** Computers: a side list of categories, like folders. */
export function CategorySidebar({
  categories,
  selected,
  onSelect,
  counts,
  onManage,
}: Props & { onManage: () => void }) {
  return (
    <nav
      aria-label="קטגוריות"
      className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-7.5rem)]"
    >
      <div className="px-4 pt-4 pb-2 text-xs font-semibold text-muted tracking-wide">קטגוריות</div>
      <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        <li>
          <SidebarItem
            active={selected === "all"}
            onClick={() => onSelect("all")}
            label="כל המסמכים"
            count={counts?.all}
            marker={<LayoutList className="size-4" />}
          />
        </li>
        {categories.map((cat) => (
          <li key={cat.id}>
            <SidebarItem
              active={selected === cat.id}
              onClick={() => onSelect(cat.id)}
              label={cat.name}
              title={cat.description || cat.name}
              count={counts ? (counts[cat.id] ?? 0) : undefined}
              marker={
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: colorForName(cat.name) }}
                  aria-hidden="true"
                />
              }
            />
          </li>
        ))}
      </ul>
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onManage}
          className="w-full inline-flex items-center gap-2 min-h-11 px-3 rounded-lg text-sm text-muted hover:text-foreground hover:bg-accent-soft/60 transition"
        >
          <FolderCog className="size-4" />
          ניהול קטגוריות
        </button>
      </div>
    </nav>
  );
}

function SidebarItem({
  active,
  onClick,
  label,
  title,
  count,
  marker,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
  count?: number;
  marker: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={title}
      className={`w-full flex items-center gap-2.5 min-h-10 px-3 rounded-lg text-sm text-start transition ${
        active
          ? "bg-accent-soft text-foreground font-semibold"
          : "text-foreground/85 hover:bg-background"
      }`}
    >
      <span className={`size-4 shrink-0 inline-flex items-center justify-center ${active ? "text-accent" : "text-muted"}`}>
        {marker}
      </span>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {typeof count === "number" && (
        <span className={`text-xs tabular-nums ${active ? "text-accent-hover" : "text-muted"}`}>
          {count.toLocaleString("he-IL")}
        </span>
      )}
    </button>
  );
}
