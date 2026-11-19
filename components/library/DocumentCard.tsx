"use client";

import { Eye, Download, Pencil, Trash2 } from "lucide-react";
import type { DocumentWithCategory } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { FileTypeIcon } from "@/lib/file-icons";
import { colorForName } from "@/lib/category-color";

type Props = {
  doc: DocumentWithCategory;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function DocumentCard({ doc, onView, onDownload, onEdit, onDelete }: Props) {
  return (
    <article className="group bg-surface border border-border rounded-xl shadow-[0_1px_2px_rgba(47,42,37,0.05)] hover:shadow-[0_6px_20px_rgba(47,42,37,0.08)] hover:border-border-strong transition flex flex-col">
      {/* Name — clicking it opens the document */}
      <button
        type="button"
        onClick={onView}
        className="flex items-start gap-3 text-start p-4 pb-3 rounded-t-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        title={`פתיחת ${doc.title}\n${doc.original_file_name}`}
      >
        <FileTypeIcon fileType={doc.file_type} size="md" />
        <span className="flex-1 min-w-0 font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.75em] group-hover:text-accent-hover transition">
          {doc.title}
        </span>
      </button>

      <div className="px-4 pb-3 flex flex-col gap-2 flex-1">
        {doc.category && (
          <span className="inline-flex items-center gap-1.5 max-w-full text-xs font-medium text-foreground/80">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: colorForName(doc.category.name) }}
              aria-hidden="true"
            />
            <span className="truncate">{doc.category.name}</span>
          </span>
        )}

        {doc.notes && (
          <p className="text-sm text-muted line-clamp-2 leading-snug" title={doc.notes}>
            {doc.notes}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 text-xs text-muted">
          {doc.file_type && <span className="uppercase font-medium tracking-wide">{doc.file_type}</span>}
          {doc.file_type && <span aria-hidden="true">·</span>}
          <span>{formatBytes(doc.file_size)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(doc.created_at)}</span>
        </div>
      </div>

      {/* Actions — the two everyday ones in words, editing and deleting as quiet icons */}
      <div className="flex items-center gap-1 px-2 py-2 border-t border-border">
        <TextBtn onClick={onView} icon={<Eye className="size-4" />} label="פתיחה" />
        <TextBtn onClick={onDownload} icon={<Download className="size-4" />} label="הורדה" />
        <IconBtn onClick={onEdit} icon={<Pencil className="size-4" />} label="עריכה" />
        <IconBtn onClick={onDelete} icon={<Trash2 className="size-4" />} label="מחיקה" danger />
      </div>
    </article>
  );
}

function TextBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent-soft transition"
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({
  onClick,
  icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`size-11 shrink-0 inline-flex items-center justify-center rounded-lg text-muted transition ${
        danger ? "hover:text-danger hover:bg-danger-soft" : "hover:text-foreground hover:bg-accent-soft"
      }`}
    >
      {icon}
    </button>
  );
}
